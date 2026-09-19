export const KEYS = {
    TEMPLATES: ["templates"],
    LETTER_TEMPLATES: ["letterTemplates"],
    USER_SETTINGS: ["userSettings"],
    GLOBAL_CONFIG: ["globalConfig"],
    OPTIONS: ["options"],
    PROMPTS: ["prompts"],
    DEFAULT_TEMPLATE: ["defaultTemplate"],
    outstandingJobs: (scope) => ["outstandingJobs", scope ?? "all"],
    incompleteJobsCount: (scope) => ["incompleteJobsCount", scope ?? "all"],
    TODOS: ["todos"],
    TOOL_SERVERS: ["toolServers"],

    noteList: (date, detailed = true, scope) => ["noteList", date, detailed, scope ?? "all"],
    scribeConsent: (urNumber) => ["scribeConsent", urNumber],
    llmModels: (mode, baseUrl, provider, hasKey) =>
        ["llmModels", mode, baseUrl, provider, hasKey],
    whisperModels: (mode, baseUrl) => ["whisperModels", mode, baseUrl],
    extractJobs: (planText) => ["extractJobs", planText],
};
