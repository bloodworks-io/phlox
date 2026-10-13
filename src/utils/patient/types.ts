// Domain types for the patient encounter note.
export type ScribeMode = "agent" | "ambient" | "dictate";

export interface TemplateField {
    field_key: string;
    field_name: string;
    style_example?: string | null;
    system_prompt?: string | null;
    refinement_rules?: string[];
    adaptive_refinement_instructions?: string[];
}

export interface NoteTemplate {
    template_key: string;
    name?: string;
    is_active?: boolean;
    fields?: TemplateField[];
}

export interface ReasoningItem {
    critical?: boolean;
    [key: string]: unknown;
}

export interface ReasoningOutput {
    differentials?: ReasoningItem[];
    investigations?: ReasoningItem[];
    clinical_considerations?: ReasoningItem[];
}

export interface Patient {
    id: number | null;
    name: string;
    first_name?: string;
    last_name?: string;
    dob: string;
    gender: string;
    ur_number: string;
    encounter_date: string;
    template_key: string | null;
    template_data: Record<string, string>;
    raw_transcription: string | null;
    transcription_duration: number | null;
    process_duration: number | null;
    reasoning_output: ReasoningOutput | null;
    isNewEncounter?: boolean;
    previous_visit_summary?: string | null;
    previous_visit_summary_pending?: boolean;
    previous_visit_template_data?: Record<string, string> | null;
    previous_visit_template_key?: string | null;
    previous_visit_encounter_date?: string | null;
}

/** One transcription/extraction result applied to the patient note. */
export interface TranscriptionResult {
    fields?: Record<string, string>;
    rawTranscription?: string;
    transcriptionDuration?: number;
    processDuration?: number;
    isRestoration?: boolean;
    [key: string]: unknown;
}
