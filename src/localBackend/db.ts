// localStorage-backed JSON store for the browser-only demo.
// Key prefix "phlox_demo_" isolates demo data from any other local state.

const PREFIX = "phlox_demo_";

export interface StoredPatient {
  id: number;
  first_name: string;
  last_name: string;
  name: string;
  dob: string;
  gender: string;
  ur_number: string;
  encounter_date: string;
  template_key: string;
  template_data: Record<string, string>;
  raw_transcription?: string | null;
  transcription_duration?: number | null;
  process_duration?: number | null;
  final_letter?: string | null;
  encounter_summary?: string | null;
  primary_condition?: string | null;
  jobs_list?: JobItem[] | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface JobItem {
  id?: number;
  job: string;
  completed: boolean;
}

export interface UserSettings {
  has_completed_splash_screen: boolean;
  name: string;
  specialty: string;
  scribe_is_ambient: boolean;
  [key: string]: unknown;
}

export interface ScribeConsent {
  scribe_consent_at: string | null;
  scribe_consent_declined_at: string | null;
}

export const KEYS = {
  patients: `${PREFIX}patients`,
  userSettings: `${PREFIX}user_settings`,
  defaultTemplateKey: `${PREFIX}default_template_key`,
  defaultLetterTemplateId: `${PREFIX}default_letter_template_id`,
  model: `${PREFIX}model`,
  asrModel: `${PREFIX}asr_model`,
  scribeConsent: `${PREFIX}scribe_consent`,
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// --- patients ---

export function getPatients(): StoredPatient[] {
  return read<StoredPatient[]>(KEYS.patients, []);
}

export function savePatients(patients: StoredPatient[]): void {
  write(KEYS.patients, patients);
}

export function nextPatientId(patients: StoredPatient[]): number {
  return patients.reduce((max, p) => Math.max(max, p.id), 0) + 1;
}

export function getPatientById(id: number): StoredPatient | undefined {
  const n = Number(id);
  return getPatients().find((p) => p.id === n);
}

export function upsertPatient(row: StoredPatient): StoredPatient {
  const patients = getPatients();
  const idx = patients.findIndex((p) => p.id === row.id);
  const now = new Date().toISOString();
  if (idx >= 0) {
    row.updated_at = now;
    patients[idx] = row;
  } else {
    row.created_at = now;
    row.updated_at = now;
    patients.push(row);
  }
  savePatients(patients);
  return row;
}

export function updatePatientFields(
  id: number,
  fields: Partial<StoredPatient>,
): StoredPatient | undefined {
  const patients = getPatients();
  const idx = patients.findIndex((p) => p.id === Number(id));
  if (idx < 0) return undefined;
  patients[idx] = { ...patients[idx], ...fields, updated_at: new Date().toISOString() };
  savePatients(patients);
  return patients[idx];
}

// --- user settings ---

const DEFAULT_USER_SETTINGS: UserSettings = {
  has_completed_splash_screen: true,
  name: "",
  specialty: "",
  scribe_is_ambient: true,
};

export function getUserSettings(): UserSettings {
  return { ...DEFAULT_USER_SETTINGS, ...read<Partial<UserSettings>>(KEYS.userSettings, {}) };
}

export function saveUserSettings(settings: UserSettings): void {
  write(KEYS.userSettings, settings);
}

// --- defaults ---

export function getDefaultTemplateKey(): string {
  return read<string>(KEYS.defaultTemplateKey, "phlox_01");
}

export function setDefaultTemplateKey(key: string): void {
  write(KEYS.defaultTemplateKey, key);
}

export function getDefaultLetterTemplateId(): number {
  return read<number>(KEYS.defaultLetterTemplateId, 1);
}

export function setDefaultLetterTemplateId(id: number): void {
  write(KEYS.defaultLetterTemplateId, Number(id));
}

// --- model selection ---

export function getModelId(): string {
  return read<string>(KEYS.model, "onnx-community/Qwen3.5-2B-ONNX-OPT");
}

export function setModelId(id: string): void {
  write(KEYS.model, id);
}

export function getAsrModelId(): string {
  return read<string>(KEYS.asrModel, "onnx-community/whisper-base.en");
}

export function setAsrModelId(id: string): void {
  write(KEYS.asrModel, id);
}

// --- scribe consent ---

export function getConsentMap(): Record<string, ScribeConsent> {
  return read<Record<string, ScribeConsent>>(KEYS.scribeConsent, {});
}

export function getConsent(urNumber: string): ScribeConsent {
  return getConsentMap()[urNumber] ?? { scribe_consent_at: null, scribe_consent_declined_at: null };
}

export function setConsent(urNumber: string, consented: boolean): ScribeConsent {
  const map = getConsentMap();
  const now = new Date().toISOString();
  map[urNumber] = consented
    ? { scribe_consent_at: now, scribe_consent_declined_at: null }
    : { scribe_consent_at: null, scribe_consent_declined_at: now };
  write(KEYS.scribeConsent, map);
  return map[urNumber];
}

// --- maintenance ---

export function resetDemoData(): void {
  const doomed: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX)) doomed.push(key);
  }
  doomed.forEach((key) => localStorage.removeItem(key));
}

export function storageUsageBytes(): number {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX)) {
      total += key.length + (localStorage.getItem(key)?.length ?? 0);
    }
  }
  // UTF-16 chars → bytes
  return total * 2;
}

export interface DemoExport {
  format: "phlox-demo-export";
  version: 1;
  exported_at: string;
  user: UserSettings;
  patients: StoredPatient[];
}

/**
 * Full-data envelope for importing into a full (server-backed) Phlox instance.
 * Patient rows map 1:1 onto the backend encounters/patient_profiles schema:
 * demographics + template_data + raw_transcription + final_letter +
 * encounter_summary + jobs_list (native array).
 */
export function buildDemoExport(): DemoExport {
  return {
    format: "phlox-demo-export",
    version: 1,
    exported_at: new Date().toISOString(),
    user: getUserSettings(),
    patients: getPatients(),
  };
}
