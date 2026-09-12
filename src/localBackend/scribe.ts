// Port of server/transcription/text.py:process_all_fields_concurrently.
// Single-call multi-field extraction. The backend's second per-field
// refine_field_content pass is deliberately dropped (halves local-model calls);
// its format_refined_response schema formatting is applied here instead.

import type { TemplateField } from "./defaults";
import { chat } from "./llm";

export interface PatientContext {
  name?: string | null;
  dob?: string | null;
  gender?: string | null;
  age?: string | null;
}

/** "Last, First" → "First Last"; "N/A" when missing (server/api/transcribe.py). */
export function formatPatientDisplayName(name: string | null | undefined): string {
  if (!name) return "N/A";
  const parts = name.split(",");
  const lastName = parts[0].trim();
  const firstName = parts.length > 1 ? parts[1].trim() : "";
  return `${firstName} ${lastName}`.trim() || "N/A";
}

/** server/transcription/text.py:_build_patient_context — verbatim. */
export function buildPatientContext(context: PatientContext): string {
  const parts: string[] = [];
  if (context.name) parts.push(`Patient name: ${context.name}`);
  if (context.age) parts.push(`Age: ${context.age}`);
  if (context.gender) parts.push(`Gender: ${context.gender}`);
  if (context.dob) parts.push(`DOB: ${context.dob}`);
  return parts.join(" ");
}

function capitalizeFirstChar(text: string): string {
  if (!text) return text;
  return text[0].toUpperCase() + text.slice(1);
}

export class TranscriptionProcessingError extends Error {
  constructor() {
    super("Error processing transcription");
  }
}

function buildSystemContent(
  fields: TemplateField[],
  patientContext: PatientContext,
  isAmbient: boolean,
  primaryCondition: string | null,
  introOverride?: string,
): string {
  const fieldInstructions = fields
    .map(
      (field) =>
        `FIELD: ${field.field_key}\nNAME: ${field.field_name}\nINSTRUCTIONS: ${(field.system_prompt || "").trim()}`,
    )
    .join("\n");

  const patientContextStr = buildPatientContext(patientContext);

  const intro = introOverride ?? (isAmbient
    ? "Extract relevant information for each of the following fields from the medical transcript."
    : "Extract and organize information from the clinician's direct dictation for each of the following fields.");

  const introSuffix = primaryCondition
    ? ` This is a returning patient who sees the clinician for ${primaryCondition}.`
    : "";

  return `${intro}${introSuffix}

${patientContextStr}

For each field, extract only the most relevant discussion points. If no relevant information is found for a field, return an empty list for that field.

FIELDS:
${fieldInstructions}

Output MUST be ONLY valid JSON with top-level key "field_summaries" (object mapping field_key to array of strings).`;
}

/** Strict JSON schema for the extraction contract — consumed by XGrammar in llm.ts. */
export function buildExtractionSchema(fields: TemplateField[]): string {
  return JSON.stringify({
    type: "object",
    properties: {
      field_summaries: {
        type: "object",
        properties: Object.fromEntries(
          fields.map((field) => [field.field_key, { type: "array", items: { type: "string" } }]),
        ),
        required: fields.map((field) => field.field_key),
        additionalProperties: false,
      },
    },
    required: ["field_summaries"],
    additionalProperties: false,
  });
}

function normalizeKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

export function parseFieldSummaries(content: string, fields: TemplateField[]): Record<string, string[]> {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in response");
  const parsed = JSON.parse(content.slice(start, end + 1)) as Record<string, unknown>;

  // Small models usually honor the "field_summaries" wrapper but sometimes
  // return the bare {field_key: [...]} mapping — accept both.
  const wrapped = parsed.field_summaries;
  const source: Record<string, unknown> =
    wrapped && typeof wrapped === "object" && !Array.isArray(wrapped)
      ? (wrapped as Record<string, unknown>)
      : parsed;
  if (wrapped === undefined && Object.keys(parsed).length > 0) {
    console.warn("[scribe] response missing field_summaries wrapper; accepting bare mapping");
  }

  // Keys resolve via field_key or the snake_cased field_name: small models
  // echo the NAME ("Current History" → current_history) instead of the key.
  const aliases = new Map<string, string>();
  for (const field of fields) {
    aliases.set(normalizeKey(field.field_key), field.field_key);
    aliases.set(normalizeKey(field.field_name), field.field_key);
  }

  const summaries: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(source)) {
    const resolved = aliases.get(key) ?? aliases.get(normalizeKey(key));
    if (!resolved) continue; // drop junk keys
    if (Array.isArray(value)) {
      summaries[resolved] = [...(summaries[resolved] ?? []), ...value.map((point) => String(point))];
    } else if (typeof value === "string" && value.trim()) {
      summaries[resolved] = [...(summaries[resolved] ?? []), value]; // single string instead of array — accept as one point
    }
  }
  if (Object.keys(summaries).length === 0) {
    throw new Error(`no recognized fields in extraction JSON (keys: ${Object.keys(source).slice(0, 8).join(", ")})`);
  }
  return summaries;
}

async function attemptExtraction(
  transcriptText: string,
  fields: TemplateField[],
  patientContext: PatientContext,
  isAmbient: boolean,
  primaryCondition: string | null,
  options: ExtractionOptions = {},
): Promise<Record<string, string>> {
  const content = await chat(
    [
      {
        role: "system",
        content:
          options.systemOverride ??
          buildSystemContent(fields, patientContext, isAmbient, primaryCondition, options.introOverride),
      },
      {
        role: "user",
        content: options.images?.length
          ? [...options.images.map(() => ({ type: "image" as const })), { type: "text" as const, text: transcriptText || "Extract the fields from the attached document." }]
          : transcriptText,
      },
    ],
    { temperature: 0.1, max_new_tokens: 1024, images: options.images, jsonSchema: buildExtractionSchema(fields) },
  );

  const summaries = parseFieldSummaries(content, fields);
  console.info(`[scribe] extraction fields: ${Object.keys(summaries).join(", ")}`);

  const formatted: Record<string, string> = {};
  for (const field of fields) {
    formatted[field.field_key] = formatPoints(summaries[field.field_key] ?? [], field);
  }
  return formatted;
}

/** server/transcription/refinement.py:format_refined_response — per-schema list formatting. */
function formatPoints(points: string[], field: TemplateField): string {
  const schema = field.format_schema as { type?: string; bullet_char?: string } | undefined;
  const formatType = schema?.type;

  if (formatType === "numbered") {
    return points
      .map((point, index) => {
        const cleaned = point.trim().replace(/^\d+\.\s*/, "");
        return `${index + 1}. ${capitalizeFirstChar(cleaned)}`;
      })
      .join("\n");
  }
  if (formatType === "bullet") {
    const bulletChar = schema?.bullet_char ?? "•";
    return points
      .map((point) => {
        const cleaned = point.trim().replace(/^[•\-*#]\s*/, "");
        return `${bulletChar} ${capitalizeFirstChar(cleaned)}`;
      })
      .join("\n");
  }
  return points.join("\n");
}

/**
 * Extract non-persistent template fields from a transcript.
 * Retries once on parse failure, then raises (backend matches with a 500).
 */
export interface ExtractionOptions {
  /** Replaces the mode intro line (document path keeps the field block). */
  introOverride?: string;
  /** Replaces the generated system prompt wholesale (visual document path). */
  systemOverride?: string;
  /** Data-URL page images for vision extraction. */
  images?: string[];
}

export async function extractFields(
  transcriptText: string,
  fields: TemplateField[],
  patientContext: PatientContext,
  isAmbient = true,
  primaryCondition: string | null = null,
  options: ExtractionOptions = {},
): Promise<Record<string, string>> {
  const targets = fields.filter((field) => !field.persistent);
  if (targets.length === 0) return {};

  const maxRetries = 1;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await attemptExtraction(transcriptText, targets, patientContext, isAmbient, primaryCondition, options);
    } catch (error) {
      // GPU-kernel failures (OOM / int overflow) won't fix themselves on
      // retry — rethrow so the router surfaces the actionable remedy.
      if (/Out of memory|Integer overflow/i.test(String(error))) throw error;
      if (attempt < maxRetries) {
        console.warn(`localBackend scribe attempt ${attempt + 1} failed: ${error}. Retrying...`);
        continue;
      }
      console.error(`localBackend scribe failed after ${maxRetries + 1} attempts: ${error}`);
      throw new TranscriptionProcessingError();
    }
  }
  throw new TranscriptionProcessingError();
}

/** process_transcription equivalent: extraction + timing. */
export async function processTranscription(
  transcriptText: string,
  fields: TemplateField[],
  patientContext: PatientContext,
  isAmbient = true,
  primaryCondition: string | null = null,
): Promise<{ fields: Record<string, string>; process_duration: number }> {
  const started = performance.now();
  const extracted = await extractFields(transcriptText, fields, patientContext, isAmbient, primaryCondition);
  return {
    fields: extracted,
    process_duration: Number(((performance.now() - started) / 1000).toFixed(2)),
  };
}
