// Port of server/nlp_tools/letter.py:generate_letter_content, minus the
// structured-output JSON wrapper (small local models handle plain text better).

import { PROMPTS, LETTER_TEMPERATURE } from "./defaults";
import { getUserSettings } from "./db";
import { chat } from "./llm";
import type { ChatMessage } from "./llm";

/** server/utils/helpers.py:calculate_age — full years between dob and today; "N/A" on bad input. */
export function calculateAge(dob: string | null | undefined): string {
  if (!dob) return "N/A";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob.trim());
  if (!match) return "N/A";
  const birth = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(birth.getTime())) return "N/A";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return String(age);
}

function titleCaseKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export interface GenerateLetterArgs {
  patientName: string;
  gender: string | null;
  dob: string | null;
  template_data: Record<string, unknown>;
  additional_instruction?: string | null;
  context?: ChatMessage[] | null;
}

export interface GeneratedLetter {
  letter: string;
  context: ChatMessage[];
}

export async function generateLetterContent(args: GenerateLetterArgs): Promise<GeneratedLetter> {
  const { patientName, gender, dob, template_data, additional_instruction, context } = args;

  const age = calculateAge(dob);

  let systemContent = PROMPTS.letter.system;

  const userSettings = getUserSettings();
  const doctorName = userSettings.name || "";
  const specialty = userSettings.specialty || "";
  if (doctorName || specialty) {
    let doctorContext = "Write the letter in the voice of ";
    doctorContext += doctorName ? `${doctorName}, ` : "";
    doctorContext += specialty ? `a ${specialty} specialist.` : "a specialist.";
    systemContent += `\n\n${doctorContext}`;
  }

  const requestBody: ChatMessage[] = [{ role: "system", content: systemContent }];

  const clinicNote = Object.entries(template_data ?? {})
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${titleCaseKey(key)}:\n${value}`)
    .join("\n\n");

  if (additional_instruction) {
    requestBody.push({
      role: "user",
      content: `Before we proceed with the task; please take note of the following additional instructions:\n${additional_instruction}`,
    });
  }
  requestBody.push({
    role: "user",
    content: `Patient Name: ${patientName}\nGender: ${gender ?? ""}\nAge: ${age}\n\nClinic Note:\n${clinicNote}`,
  });

  // Trim to the last 8 non-system messages (replaces backend token-budget truncation).
  const truncatedContext = (context ?? []).filter((m) => m.role !== "system").slice(-8);
  requestBody.push(...truncatedContext);

  const letter = await chat(requestBody, { temperature: LETTER_TEMPERATURE, max_new_tokens: 1024 });

  return { letter, context: truncatedContext };
}
