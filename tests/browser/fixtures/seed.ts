export const SEED_DATE = "2026-07-23";
export const PREVIOUS_DATE = "2026-06-23";

const templateField = (fieldKey: string, fieldName: string, persistent = false) => ({
    field_key: fieldKey,
    field_name: fieldName,
    field_type: "text",
    persistent,
    required: fieldKey === "plan",
    initial_prompt: `${fieldName}:\n`,
    system_prompt: `Extract ${fieldName}.`,
});

export const seedTemplate = {
    template_key: "phlox_01",
    template_name: "Phlox",
    fields: [
        templateField("primary_history", "Primary Medical History", true),
        templateField("additional_history", "Other Active Problems", true),
        templateField("investigations", "Investigations", true),
        templateField("clinical_history", "Current History"),
        templateField("impression", "Impression", true),
        templateField("plan", "Plan"),
    ],
};

export const seedTemplateData = {
    primary_history: "# Iron-deficiency anaemia\n- Diagnosed two years ago\n- Oral iron supplementation",
    additional_history: "# Hypertension\n# Type 2 diabetes",
    investigations: "FBE Hb 132 WCC 7.5 Plt 220\nUEC Na 138 K 4.0 Cr 72",
    clinical_history:
        "- Reports improved energy\n- No new bleeding symptoms\n- Highly compliant with iron therapy\n- Exercise-related chest tightness\n- Haemoglobin improved to 132 g/L\n- Family history of coeliac disease",
    impression: "Stable iron-deficiency anaemia, improving on oral iron.",
    plan: "1. Continue oral iron supplementation\n2. Repeat FBE in three months\n3. Review in four months",
};

export const seedTranscript = [
    "S1: Good morning John. How have you been since the last visit?",
    "S2: Much better, with more energy.",
    "S2: I have not missed a dose of iron.",
    "S2: I have noticed some bruising on my arms lately.",
    "S2: I get chest tightness when climbing stairs.",
    "S1: Your haemoglobin is now 132, up from 105.",
    "S1: Continue iron each morning.",
    "S1: We will repeat the blood count in three months.",
    "S1: I will review you again in four months.",
].join("\n");

export const seedCitations = {
    transcript_line_count: 9,
    resolved: [],
    fields: {
        clinical_history: [
            {
                line_index: 0,
                text: "- Reports improved energy",
                sources: [1],
                contradicts: [],
                verdict: "supported",
            },
            {
                line_index: 1,
                text: "- No new bleeding symptoms",
                sources: [],
                contradicts: [3],
                verdict: "conflict",
            },
            {
                line_index: 2,
                text: "- Highly compliant with iron therapy",
                sources: [2],
                contradicts: [],
                verdict: "supported",
            },
            {
                line_index: 3,
                text: "- Exercise-related chest tightness",
                sources: [4],
                contradicts: [],
                verdict: "supported",
            },
            {
                line_index: 4,
                text: "- Haemoglobin improved to 132 g/L",
                sources: [5],
                contradicts: [],
                verdict: "supported",
            },
            {
                line_index: 5,
                text: "- Family history of coeliac disease",
                sources: [],
                contradicts: [],
                verdict: "unverified",
            },
        ],
        plan: [
            {
                line_index: 0,
                text: "1. Continue oral iron supplementation",
                sources: [6],
                contradicts: [],
                verdict: "supported",
            },
            {
                line_index: 1,
                text: "2. Repeat FBE in three months",
                sources: [7],
                contradicts: [],
                verdict: "supported",
            },
            {
                line_index: 2,
                text: "3. Review in four months",
                sources: [8],
                contradicts: [],
                verdict: "supported",
            },
        ],
    },
};

export const seedReasoning = {
    summary: "Stable iron-deficiency anaemia with improving haemoglobin and one exercise-related symptom requiring review.",
    thinking:
        "The documented improvement is supported by the repeated blood count. The reported bruising conflicts with the recorded absence of bleeding symptoms.",
    citations: [],
    differentials: [
        {
            suggestion: "Stable iron-deficiency anaemia",
            rationale: ["Haemoglobin improved from 105 to 132 g/L [5]."],
            critical: false,
        },
        {
            suggestion: "Investigate exertional chest tightness",
            rationale: ["The transcript mentions chest tightness during exertion [4]."],
            critical: true,
        },
    ],
    investigations: [
        {
            suggestion: "Repeat FBE in three months",
            rationale: ["A repeat blood count was planned [7]."],
            critical: false,
        },
    ],
    clinical_considerations: [
        {
            suggestion: "Confirm adherence to iron therapy",
            rationale: ["The patient reports no missed doses [2]."],
            critical: false,
        },
    ],
};

export const seedJobs = [
    { id: 1, job: "Repeat FBE in three months", completed: false },
    { id: 2, job: "Review in four months", completed: false },
    { id: 3, job: "Check coeliac antibodies", completed: true },
];

export const seedPatient = {
    id: 1,
    ur_number: "UR00001",
    name: "Smith, John",
    first_name: "John",
    last_name: "Smith",
    dob: "1975-03-15",
    gender: "M",
    address: null,
    phone: null,
    encounter_date: SEED_DATE,
    template_key: seedTemplate.template_key,
    template_data: seedTemplateData,
    raw_transcription: seedTranscript,
    note_citations: seedCitations,
    transcription_duration: 8.5,
    process_duration: 12.25,
    jobs_list: JSON.stringify(seedJobs),
    all_jobs_completed: false,
    final_letter:
        "Dear Doctor,\n\nThank you for referring Mr John Smith. His iron-deficiency anaemia continues to improve on oral iron.\n\nKind regards,\nDr Seed",
    primary_condition: "Iron-deficiency anaemia",
    encounter_summary:
        "50-year-old male with improving iron-deficiency anaemia and exertional chest tightness requiring review.",
    reasoning_output: seedReasoning,
    previous_visit_template_data: {
        primary_history: "# Iron-deficiency anaemia\n- Haemoglobin 105 g/L",
        additional_history: "# Hypertension",
        impression: "Iron-deficiency anaemia at diagnosis",
    },
    previous_visit_template_key: seedTemplate.template_key,
    previous_visit_encounter_date: PREVIOUS_DATE,
};

export const secondPatientSummary = {
    id: 2,
    name: "Johnson, Emily",
    ur_number: "UR00002",
};

export const basicPatients = [secondPatientSummary, seedPatient];

export const detailedPatients = [
    {
        id: seedPatient.id,
        name: seedPatient.name,
        ur_number: seedPatient.ur_number,
        dob: seedPatient.dob,
        jobs_list: seedPatient.jobs_list,
        encounter_summary: seedPatient.encounter_summary,
        reasoning: seedReasoning,
    },
    {
        id: secondPatientSummary.id,
        name: secondPatientSummary.name,
        ur_number: secondPatientSummary.ur_number,
        dob: "1988-11-22",
        jobs_list: JSON.stringify([
            { id: 1, job: "Monitor platelet count", completed: false },
            { id: 2, job: "Report unusual bleeding", completed: true },
        ]),
        encounter_summary: "37-year-old female with stable mild thrombocytopenia.",
        reasoning: {
            ...seedReasoning,
            summary: "Stable mild thrombocytopenia, likely benign.",
            differentials: [
                {
                    suggestion: "Continue observation",
                    rationale: ["Platelets remain stable."],
                    critical: false,
                },
            ],
        },
    },
];

export const outstandingPatients = [
    {
        ...detailedPatients[0],
        encounter_date: SEED_DATE,
    },
    {
        ...detailedPatients[1],
        encounter_date: PREVIOUS_DATE,
    },
];

export const seedUserSettings = {
    name: "Dr Seed",
    specialty: "General practice",
    quick_chat_1_title: "Review my plan",
    quick_chat_1_prompt: "Review my plan",
    quick_chat_2_title: "Additional points to review",
    quick_chat_2_prompt: "Additional points to review",
    quick_chat_3_title: "Other conditions worth reviewing",
    quick_chat_3_prompt: "Other conditions worth reviewing",
    default_template_key: seedTemplate.template_key,
    default_letter_template_id: 1,
    has_completed_splash_screen: true,
    preferred_language: "en",
};

export const seedGlobalConfig = {
    LLM_PROVIDER: "openai",
    LLM_BASE_URL: "http://127.0.0.1:11434",
    LLM_API_KEY: null,
    PRIMARY_MODEL: "seed-clinical-model",
    SECONDARY_MODEL: "seed-clinical-model",
    REASONING_MODEL: "seed-clinical-model",
    WHISPER_BASE_URL: "http://127.0.0.1:8080",
    WHISPER_MODEL: "seed-whisper",
    WHISPER_KEY: null,
    DOCUMENT_IMAGE_PROCESSING_MODE: "auto",
    VISION_MODEL_CAPABLE: false,
    REQUIRE_SCRIBE_CONSENT: true,
    COMPANION_ENABLED: false,
    STORE_ORIGINAL_PDFS: true,
    DISABLED_TOOLS: [],
};

export const seedLetterTemplates = {
    templates: [
        {
            id: 1,
            name: "Standard referral",
            instructions: "Write a concise specialist referral.",
            created_at: `${PREVIOUS_DATE}T09:00:00`,
        },
    ],
    default_template_id: 1,
};

export const seedTodos = [
    { id: 1, task: "Order FBE", completed: false },
    { id: 2, task: "Review iron results", completed: false },
    { id: 3, task: "Send referral letter", completed: true },
];

export const seedPrompts = {
    chat: "You are a concise clinical assistant.",
    rag: "Answer using the supplied literature.",
    summary: "Summarise the encounter accurately.",
};

export const seedOptions = {
    letter: {
        temperature: 0.2,
    },
};

export const seedUsers = [
    { id: 1, username: "seed", role: "admin", disabled: false },
    { id: 2, username: "clinic-user", role: "user", disabled: false },
];

export const seedRagCollections = {
    files: ["Clinical Guidelines"],
};

export const seedRagCollectionFiles = {
    files: [
        {
            filename: "anaemia-guideline.pdf",
            title: "Anaemia guideline",
            source: "Haematology Society",
            focus_area: "guidelines",
            has_pdf: true,
        },
        {
            filename: "iron-therapy.pdf",
            title: null,
            source: null,
            focus_area: null,
            has_pdf: false,
        },
    ],
};

// Letter-size page (612×792 pt); field geometry is absolute PDF points
// with the origin at the page's bottom-left corner.
export const seedPdfFormTemplate = {
    id: "seed-form",
    name: "Specialist referral",
    description: "Seed referral form",
    pdf_file_name: "seed-referral.pdf",
    page_count: 1,
    page_heights: [792],
    created_at: `${PREVIOUS_DATE}T09:00:00`,
    updated_at: `${PREVIOUS_DATE}T09:00:00`,
    fields: [
        {
            id: "field-1",
            name: "Patient name",
            field_type: "text",
            page_number: 1,
            x: 72,
            y: 640,
            width: 300,
            height: 18,
            font_size: 12,
        },
        {
            id: "field-2",
            name: "Urgent",
            field_type: "checkbox",
            page_number: 1,
            x: 72,
            y: 500,
            width: 14,
            height: 14,
            font_size: 12,
        },
    ],
};
