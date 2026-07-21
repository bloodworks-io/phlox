export const KEYS = {
    TEMPLATES: ["templates"],
    LETTER_TEMPLATES: ["letterTemplates"],
    USER_SETTINGS: ["userSettings"],
    OPTIONS: ["options"],
    PROMPTS: ["prompts"],
    DEFAULT_TEMPLATE: ["defaultTemplate"],
    OUTSTANDING_JOBS: ["outstandingJobs"],
    INCOMPLETE_JOBS_COUNT: ["incompleteJobsCount"],
    TODOS: ["todos"],
    TOOL_SERVERS: ["toolServers"],

    noteList: (date, detailed = true) => ["noteList", date, detailed],
    scribeConsent: (urNumber) => ["scribeConsent", urNumber],
    llmModels: (mode, baseUrl, provider, hasKey) =>
        ["llmModels", mode, baseUrl, provider, hasKey],
    whisperModels: (mode, baseUrl) => ["whisperModels", mode, baseUrl],
    extractJobs: (planText) => ["extractJobs", planText],
};
