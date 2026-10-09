// WebLLM spike for phlox-0.8b (dev only): /webllm-spike.html
// Measures load, prefill, decode tok/s, and schema-constrained scribe output
// against the same prompt as the transformers.js path.
import { CreateMLCEngine } from "@mlc-ai/web-llm";

const $ = (id) => document.getElementById(id);
const log = (m) => { $("log").textContent += m + "\n"; };
$("status").textContent = "idle";

const SCRIBE_SCHEMA = {
  type: "object",
  properties: {
    field_summaries: {
      type: "object",
      properties: {
        clinical_history: { type: "array", items: { type: "string" } },
        plan: { type: "array", items: { type: "string" } },
      },
      required: ["clinical_history", "plan"],
      additionalProperties: false,
    },
  },
  required: ["field_summaries"],
  additionalProperties: false,
};

// Prefilled from a real scribe dev example (phlox_01)
const EXAMPLE = { system: "Extract relevant information for each of the following fields from the medical transcript.\n\nPatient name: Randy Parker Gender: M DOB: 2007-06-25\n\nFor each field, extract only the most relevant discussion points. If no relevant information is found for a field, return an empty list for that field.\n\nFIELDS:\nFIELD: interval_history\nNAME: Interval History\nINSTRUCTIONS: You are a professional transcript summarisation assistant. The user will send you a raw transcript with which you will perform the following:\n1. Extract and summarize events, treatments, and changes since the previous encounter.\n2. Include a clear timeline of when events occurred, with specific dates or timeframes when mentioned.\n3. Document any interventions received, including medications, procedures, or therapies.\n4. Note any complications, new symptoms, or adverse events that occurred during the interval.\n5. The target audience of the text is medical professionals so use jargon and common medical abbreviations where appropriate.\n6. Present the information chronologically to show the progression of events since last seen.\nFIELD: current_status\nNAME: Current Status\nINSTRUCTIONS: You are a professional transcript summarisation assistant. The user will send you a raw transcript with which you will perform the following:\n1. Describe the patient's current clinical condition at the time of this encounter.\n2. Include current symptom status, functional status, and quality of life indicators.\n3. Document any active physical examination findings with specific details.\n4. Note any ongoing concerns, residual issues, or problems requiring attention.\n5. Include relevant negative findings when they provide important context.\n6. The target audience of the text is medical professionals so use jargon and common medical abbreviations where appropriate.\n7. Aim for 4-6 bullet points that capture the patient's present state comprehensively.\nFIELD: plan\nNAME: Plan\nINSTRUCTIONS: You are a professional transcript summarisation assistant. The user will send you a raw transcript with which you will perform the following:\n1. Extract the action items mentioned in the transcript by the doctor.\n2. The plan should include at least 2 actions from the appointment\n3. Only items for actioning are to be included. Do not add extraneous or irrelevant information.\n4. The target audience of the text is medical professionals so use jargon and common medical abbreviations.\n5. If a follow-up appointment or investigation is mentioned, be sure to include it in the plan.\n\nOutput MUST be ONLY valid JSON with top-level key \"field_summaries\" (object mapping field_key to array of strings).", user: "Hi there good to see you I think we last saw you four months ago on 12/05/26 for low BMD review is that right How's uni going Yeah um yeah May that's right Uni's alright busy but like I've got I've got more energy these days feeling better overall Good good So thinking aloud here low bone mineral density in a 19-year-old male we started calcium 600mg plus vit D 1000IU daily as advised last time are you still taking those tolerating supplements well Yep taking them every morning no worries at all like no no stomach issues or anything Oh and I started that supervised resistance program 3x/week since June with a trainer at the gym Excellent adherence And any interval issues any fragility fractures falls or bone pain reported Any back pain height loss or deformity noted Nah nothing like that No broken bones no falls no achy bones or back pain I don't think I've shrunk or anything bent out of shape haha I'm even playing social soccer 1x/week without injury so that's cool Great staying active is key for osteogenesis What about smoking excess alcohol or steroid use since last visit any of those No no smoking I barely drink like just a beer now and then and definitely no no steroids or anything like that Perfect Let me examine you quickly hmm no Cushingoid features no goitre no bony tenderness on palpation normal posture and gait BMI is 221 today and ECOG PS 0 fully active so that's reassuring I also have your recent labs from 28/08/26 Vit D 68 nmol/L Ca 238 mmol/L both nicely in range Oh nice so um so those numbers mean my vitamin D and calcium are okay now Like I don't need a higher dose Exactly you're replete for now So plan going forward let's think 1 repeat DXA lumbar spine + hip in 6 months to monitor BMD trajectory 2 continue Ca/vit D recheck 25-OH vit D in 3 months 3 refer to dietitian for bone-health diet optimisation A dietitian Like like to sort out what I should eat for my bones and stuff Precisely calcium-rich foods adequate protein that sort of thing And 4 FU in endocrinology clinic in 6 months with results we'll review the DXA together then Sound good Yeah sounds good thanks Dr Alvarez" };
$("sys").value = EXAMPLE.system;
$("usr").value = EXAMPLE.user;

let engine = null;

$("load").onclick = async () => {
  $("status").textContent = "loading…";
  const t0 = performance.now();
  try {
    engine = await CreateMLCEngine(
      "Qwen3.5-0.8B-q4f16_1-MLC",
      {
        appConfig: {
          model_list: [
            {
              // prebuilt record from web-llm src/config.ts (v0_2_84/base):
              // proves WebLLM speed for this architecture; swap in local
              // phlox weights + lib after MLC conversion.
              model: "https://huggingface.co/mlc-ai/Qwen3.5-0.8B-q4f16_1-MLC",
              model_id: "Qwen3.5-0.8B-q4f16_1-MLC",
              model_lib:
                "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Qwen3.5-0.8B-q4f16_1_cs1k-webgpu.wasm",
              vram_required_MB: 1629,
              low_resource_required: true,
              overrides: { context_window_size: 4096, max_history_size: 1 },
            },
          ],
        },
        initProgressCallback: (p) => { $("status").textContent = p.text; },
      },
    );
    $("status").textContent = `ready in ${((performance.now() - t0) / 1000).toFixed(1)}s`;
    $("run").disabled = false;
  } catch (e) {
    $("status").textContent = `load failed: ${e}`;
    log(String(e));
  }
};

$("run").onclick = async () => {
  if (!engine) return;
  const messages = [
    { role: "system", content: $("sys").value },
    { role: "user", content: $("usr").value },
  ];
  const useSchema = $("schema").checked;
  const t0 = performance.now();
  let first = null;
  let chunks = 0;
  const out = await engine.chat.completions.create({
    messages,
    temperature: 0.1,
    max_tokens: 512,
    stream: true,
    ...(useSchema
      ? { response_format: { type: "json_schema", json_schema: { name: "scribe", schema: SCRIBE_SCHEMA } } }
      : {}),
  });
  let text = "";
  for await (const c of out) {
    const d = c.choices?.[0]?.delta?.content ?? "";
    if (d) {
      if (first === null) first = performance.now();
      chunks += 1;
      text += d;
      $("out").textContent = text;
    }
  }
  const t1 = performance.now();
  const ttft = first !== null ? (first - t0) / 1000 : 0;
  const total = (t1 - t0) / 1000;
  const decodeS = total - ttft;
  const ntok = text.length ? chunks : 0; // chunks ≈ tokens for delta streams
  $("metrics").textContent =
    `schema=${useSchema}\nttft(prefill+1st)=${ttft.toFixed(2)}s\ntotal=${total.toFixed(2)}s\n` +
    `decode≈${ntok} tok / ${decodeS.toFixed(2)}s = ${(ntok / Math.max(decodeS, 1e-6)).toFixed(1)} tok/s\nchars=${text.length}`;
  log(`[run] schema=${useSchema} ttft=${ttft.toFixed(2)}s total=${total.toFixed(2)}s tok/s≈${(ntok / Math.max(decodeS, 1e-6)).toFixed(1)}`);
};
