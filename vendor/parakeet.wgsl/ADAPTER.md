# OmiMed encoder adapter — locked-down semantics

Source of truth for the fork's adapter execution. Cross-verified against three
independent implementations shipped by Omi-Health/omi-med-stt-runtime:

1. NeMo config (`model_cfg_after.yaml` in omi-health/omi-med-stt-v1):
   `encoder` targets `ConformerEncoderAdapter`; per-layer
   `adapters.medical_v1d_rank128` is NeMo `LinearAdapter(in_features=1024,
   dim=128, activation=swish, norm_position=pre)` with
   `ResidualAddAdapterStrategy` (stochastic depth disabled at inference).
2. MLX runtime re-implementation (`src/omi_stt/mlx_runtime.py`,
   `_install_omi_adapter_runtime`).
3. parakeet.cpp adapter patch (`parakeet-cpp-omi-adapter.patch`).

All three agree on the math below.

## Placement

Each of the 24 Conformer layers computes the stock Parakeet v2 block, then:

```
r = norm_out(x_conv_branch_out)          # stock final layer norm
r = r + Adapter(r)                       # adapter, AFTER norm_out
return r                                 # this is the layer output
```

The adapter is NOT inside any branch and NOT before norm_out.

## Adapter math

```
Adapter(x) = Up @ SiLU(Down @ LayerNorm(x))
output     = x + Adapter(x)              # residual scale exactly 1
```

- `LayerNorm`: torch.nn.LayerNorm(1024), elementwise affine, eps = 1e-5
  (torch default) — weight and bias both present (module.0).
- `Down`: Linear(1024 -> 128), **no bias** (module.1).
- `SiLU` = swish (module.2, parameterless).
- `Up`: Linear(128 -> 1024), **no bias** (module.3).
- No stochastic depth, no dropout, no residual scaling at inference.

## Tensor inventory (per layer, 4 tensors; 96 total)

| checkpoint name (NeMo)                                    | shape        | canonical name (this fork)                     |
|-----------------------------------------------------------|--------------|------------------------------------------------|
| `encoder.layers.N.adapter_layer.medical_v1d_rank128.module.0.weight` | (1024,)  | `encoder.layers.N.adapter.norm.weight`  |
| `encoder.layers.N.adapter_layer.medical_v1d_rank128.module.0.bias`   | (1024,)  | `encoder.layers.N.adapter.norm.bias`    |
| `encoder.layers.N.adapter_layer.medical_v1d_rank128.module.1.weight` | (128,1024)| `encoder.layers.N.adapter.down.weight`  |
| `encoder.layers.N.adapter_layer.medical_v1d_rank128.module.3.weight` | (1024,128)| `encoder.layers.N.adapter.up.weight`    |

Compact canonical names stay under the 64-byte tensor-name limit (mirrors the
parakeet.cpp convention).

## Mapping onto the parakeet.wgsl dispatch graph (as built)

Four dispatches per layer, appended after the `norm_out` dispatch, reusing the
dead `moduleScratch` / `feedForwardTemporary` arena slices:

1. LayerNorm dispatch (existing kernel): layer output → module scratch,
   weights `adapter.norm.*` (float32 "channel").
2. GEMM `encoder-layer-adapter-down`: inner 1024 → columns 256,
   `activation: "silu"`, tile-major palette5 weights, output feed-forward
   scratch.
3. GEMM `encoder-layer-adapter-up`: inner 256 → columns 1024, staged-B
   (row-major) palette5 weights — the direct-B tile kernel only supports
   K 1024/4096 — output module scratch.
4. `AdapterResidualKernel` (new, `kernels/adapter-residual.ts`): elementwise
   `accumulator += source` folding the adapter output into the layer output
   in place. WebGPU rejects binding one arena range as both a writable GEMM
   output and a read-only residual, and rejects mixing read-only and
   read-write usages of the single arena buffer within one compute pass, so
   both of this kernel's bindings are read_write typed.

Supporting constants that shift: 19 logical dispatches/layer, 6 layer-norm
passes, 27 compute passes, 10 palettized matrices/layer (244 per graph,
220 palette5), 939 retained tensors, transient palette pool 11 slots,
fp16 manifest pin = the OmiMed identity (207,734 bytes,
sha256 cf535dd1…fe39).

## Rank padding and quantization

The fp16 tile GEMM requires N%256==0 and K%32==0, so both projections are
zero-padded 128 -> 256 at conversion: silu(0)=0 keeps the padded lanes
exactly inert. The single shared 32-entry palette has no exact-zero centroid
for zero-mass groups, so padded lanes decode to ~1e-6-scale values
(verified: |pad| <= 4e-6, real-region quantization error <= 0.026) — a
systematic residual orders of magnitude below fp16 representation noise.

## Verification (2026-10-12, local)

- `verify_adapter_packing.py`: adapter tensors decode within palette bounds;
  norms byte-identical.
- Browser E2E (fp16/subgroups on Apple silicon): package loads from the
  local mirror, hash-verifies, and transcribes OmiMed's smoke clip to
  "The patient takes aspirin once daily." — an exact match with the
  `omi-med-stt` MLX (q8) reference transcript. Warm speedFactor ~8.4x.
- Reference: `/tmp/omimed_reference_smoke.json`.
