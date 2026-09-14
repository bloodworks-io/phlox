"""train.py — the Colab notebook as a single headless script for a local GPU VM (e.g. 3090).

  pip install -U transformers peft bitsandbytes accelerate optimum onnx onnxruntime
  # Speed kernels are OPTIONAL — if they fail to import (known: conda py3.10 breaks fla
  # on every triton), training still runs correctly on the ~15s/step reference path.
  # Fresh py3.11+ venv gives the best odds: pip install "flash-linear-attention==0.4.2" causal-conv1d
  # conda python + causal-conv1d needs: LD_PRELOAD=/usr/lib/libstdc++.so.6
  LD_PRELOAD=/usr/lib/libstdc++.so.6 CUDA_VISIBLE_DEVICES=0 python train.py
  python train.py                       # trains, merges, evals, exports
  python train.py --skip-train          # redo eval/export on an existing merge
Inputs : training/data/sft_train.jsonl, sft_dev.jsonl, eval.py (this dir)
Outputs: training/out/qwen-phlox-merged/, training/out/onnx/..., eval_*.json
"""

from __future__ import annotations

import os

os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")  # must precede torch import

import argparse
import json
import subprocess
import sys
from pathlib import Path

import torch

# Pre-import the Qwen3.5 kernels BEFORE transformers: if fla/causal_conv1d fail to
# import inside a training process, transformers silently falls back to the ~13s/step
# reference path. Importing here surfaces the real error and caches the module.
for _kern in ("fla", "causal_conv1d"):
    try:
        __import__(_kern)
        print(f"[train] { _kern } kernel available")
    except Exception:
        import traceback

        traceback.print_exc()
        print(f"[train] WARNING: {_kern} import failed — training will use the slow reference kernel")
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, Trainer, TrainingArguments
from peft import LoraConfig, get_peft_model

HERE = Path(__file__).parent
DATA = HERE / "data"
OUT = HERE / "out"
BASE = "Qwen/Qwen3.5-0.8B"
MAX_LEN = 3072  # refinement episodes + long notes exceed 2048; 24GB QLoRA handles 3072 easily
BF16 = torch.cuda.is_bf16_supported()  # 3090 (Ampere): True -> bf16; older: fp16 fallback


def load_examples(path: Path) -> list[dict]:
    tok = TOK
    rows, dropped = [], 0
    for line in path.open():
        ex = json.loads(line)
        try:
            prompt = tok.apply_chat_template(ex["prompt"], add_generation_prompt=True, enable_thinking=False, tokenize=False)
        except TypeError:
            prompt = tok.apply_chat_template(ex["prompt"], add_generation_prompt=True, tokenize=False)
        prompt_ids = tok(prompt, add_special_tokens=False)["input_ids"]
        comp_ids = tok(ex["completion"], add_special_tokens=False)["input_ids"] + [tok.eos_token_id]
        if len(prompt_ids) + len(comp_ids) > MAX_LEN:
            dropped += 1
            continue
        rows.append({"input_ids": prompt_ids + comp_ids, "labels": [-100] * len(prompt_ids) + comp_ids})
    print(f"{path.name}: {len(rows)} kept, {dropped} dropped (> {MAX_LEN} tok)")
    return rows


class SFT(torch.utils.data.Dataset):
    def __init__(self, rows):
        self.rows = rows

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, i):
        return self.rows[i]


def collate(batch):
    maxlen = max(len(b["input_ids"]) for b in batch)
    pad = TOK.eos_token_id
    input_ids, labels, attn = [], [], []
    for b in batch:
        n = len(b["input_ids"])
        input_ids.append(b["input_ids"] + [pad] * (maxlen - n))
        labels.append(b["labels"] + [-100] * (maxlen - n))
        attn.append([1] * n + [0] * (maxlen - n))
    return {"input_ids": torch.tensor(input_ids), "labels": torch.tensor(labels), "attention_mask": torch.tensor(attn)}


class ChunkedLossTrainer(Trainer):
    """Never materialize [bs, seq, vocab] logits (fp32 upcast = 15.6GiB at bs8x3072).
    Runs the decoder trunk, then lm_head + CE in 1024-position chunks."""

    def compute_loss(self, model, inputs, return_outputs=False, *args, **kwargs):
        labels = inputs.pop("labels")
        base = model.get_base_model() if hasattr(model, "get_base_model") else model
        out = base.model(input_ids=inputs["input_ids"], attention_mask=inputs["attention_mask"])
        shift_h = out.last_hidden_state[:, :-1, :].reshape(-1, out.last_hidden_state.size(-1))
        shift_labels = labels[:, 1:].reshape(-1)
        keep = shift_labels != -100
        total, n = shift_h.new_zeros((), dtype=torch.float32), 0
        for i in range(0, shift_h.size(0), 1024):
            sl = slice(i, i + 1024)
            if keep[sl].any():
                logits = base.lm_head(shift_h[sl]).float()
                total = total + torch.nn.functional.cross_entropy(
                    logits, shift_labels[sl], ignore_index=-100, reduction="sum")
                n += int(keep[sl].sum())
        loss = total / max(n, 1)  # ponytail: mean-of-microbatch-means across accum steps; token counts are near-uniform here
        return (loss, out) if return_outputs else loss


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-train", action="store_true")
    args = ap.parse_args()

    global TOK
    TOK = AutoTokenizer.from_pretrained(BASE)
    OUT.mkdir(exist_ok=True)
    merged_dir = OUT / "qwen-phlox-merged"

    if not args.skip_train:
        train_rows = load_examples(DATA / "sft_train.jsonl")
        bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                                 bnb_4bit_compute_dtype=torch.bfloat16 if BF16 else torch.float16)
        model = AutoModelForCausalLM.from_pretrained(BASE, quantization_config=bnb, device_map={"": 0})
        for name, p in model.named_parameters():  # text-only training; freeze any vision tower
            if "visual" in name.lower() or "vision" in name.lower():
                p.requires_grad_(False)
        model = get_peft_model(model, LoraConfig(
            r=16, lora_alpha=32, lora_dropout=0.05, bias="none", task_type="CAUSAL_LM",
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]))
        model.print_trainable_parameters()

        # bs16x3072 OOMs in Qwen3.5's delta-rule kernel (its chunk intermediates ignore
        # grad checkpointing); bs8x2 + expandable_segments fits a 24GB card comfortably
        per_bs, accum = 8, 2
        total_steps = (len(train_rows) // (per_bs * accum) + 1) * 2
        targs = TrainingArguments(
            output_dir=str(OUT / "ckpt"), per_device_train_batch_size=per_bs, gradient_accumulation_steps=accum,
            num_train_epochs=2, learning_rate=1e-4, lr_scheduler_type="cosine", warmup_steps=max(10, int(0.03 * total_steps)),
            logging_steps=50, save_strategy="no", report_to=[], bf16=BF16, fp16=not BF16,
            gradient_checkpointing=True, dataloader_num_workers=2, seed=42,
        )
        ChunkedLossTrainer(model=model, args=targs, train_dataset=SFT(train_rows), data_collator=collate).train()

        merged = model.merge_and_unload().to(torch.bfloat16 if BF16 else torch.float16)
        merged.save_pretrained(merged_dir)
        TOK.save_pretrained(merged_dir)
        print(f"merged -> {merged_dir}")

    dev = str(DATA / "sft_dev.jsonl")
    for tag, model in (("base", BASE), ("tuned", str(merged_dir))):
        subprocess.run([sys.executable, str(HERE / "eval.py"), "--model", model, "--dev", dev,
                        "--limit", "250", "--out", str(OUT / f"eval_{tag}.json")], check=False)

    onnx_dir = OUT / "onnx" / "phlox-0.8b"
    subprocess.run([sys.executable, "-m", "optimum.exporters.onnx", "--model", str(merged_dir),
                    "--task", "text-generation-with-past", str(onnx_dir)], check=True)
    from onnxruntime.quantization import quantize_dynamic, QuantType

    q8_dir = OUT / "onnx" / "phlox-0.8b-q8"
    q8_dir.mkdir(parents=True, exist_ok=True)
    for f in onnx_dir.glob("*.onnx"):
        quantize_dynamic(str(f), str(q8_dir / f.name), weight_type=QuantType.QInt8)
    print(f"export -> {onnx_dir} + {q8_dir}\nq4/webgpu packaging happens repo-side")


if __name__ == "__main__":
    main()
