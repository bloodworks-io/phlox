// Application-wide constants, such as API endpoints, default configurations, and data defaults
export const API_ENDPOINTS = {
    PATIENT: {
        SAVE: "/api/save-patient",
        SEARCH: "/api/search-patient",
        DETAILS: "/api/patient",
        LETTER: "/api/fetch-letter",
        SAVE_LETTER: "/api/save-letter",
        UPDATE_JOBS: "/api/update-jobs-list",
    },
    CHAT: {
        SEND: "/api/chat",
        GENERATE_LETTER: "/api/generate-letter",
    },
    RAG: {
        FILES: "/api/rag/files",
        COLLECTION_FILES: "/api/rag/collection_files",
        MODIFY: "/api/rag/modify",
        DELETE_COLLECTION: "/api/rag/delete-collection",
        DELETE_FILE: "/api/rag/delete-file",
        EXTRACT_PDF: "/api/rag/extract-pdf-info",
        COMMIT: "/api/rag/commit-to-vectordb",
    },
    SETTINGS: {
        USER: "/api/user-settings",
        PROMPTS: "/api/prompts",
        CONFIG: "/api/config",
        OPTIONS: "/api/options",
    },
};

export const DEFAULT_TOAST_CONFIG = {
    duration: 3000,
    isClosable: true,
    position: "bottom",
};

export const MODEL_DEFAULTS = {
    PRIMARY: {
        num_ctx: 2048,
        temperature: 0.7,
    },
    SECONDARY: {
        num_ctx: 1024,
        temperature: 0.5,
    },
};

export const SPECIALTIES = [
    "Anaesthetics",
    "Cardiology",
    "Dermatology",
    "Emergency Medicine",
    "Endocrinology",
    "Family Medicine",
    "Gastroenterology",
    "General Practice",
    "General Surgery",
    "Geriatrics",
    "Haematology",
    "Internal Medicine",
    "Neurology",
    "Obstetrics and Gynaecology",
    "Oncology",
    "Ophthalmology",
    "Orthopaedics",
    "Paediatrics",
    "Psychiatry",
    "Radiology",
    "Respiratory Medicine",
    "Rheumatology",
    "Urology",
];
