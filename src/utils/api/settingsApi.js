// API functions for fetching and saving settings configurations.
import { handleApiRequest } from "../helpers/apiHelpers";

export const settingsApi = {
    fetchUserSettings: () =>
        handleApiRequest({
            apiCall: () => fetch("/api/config/user"),
            errorMessage: "Failed to fetch user settings",
        }),

    fetchPrompts: () =>
        handleApiRequest({
            apiCall: () => fetch("/api/config/prompts"),
            errorMessage: "Failed to fetch prompts",
        }),

    fetchConfig: () =>
        handleApiRequest({
            apiCall: () => fetch("/api/config/global"),
            errorMessage: "Failed to fetch config",
        }),

    fetchOptions: () =>
        handleApiRequest({
            apiCall: () => fetch("/api/config/ollama"),
            errorMessage: "Failed to fetch options",
        }),

    fetchOllamaModels: (ollamaBaseUrl) => {
        const apiUrl = `/api/config/ollama/models?ollamaEndpoint=${encodeURIComponent(ollamaBaseUrl)}`;
        return handleApiRequest({
            apiCall: () => fetch(apiUrl),
            errorMessage: "Failed to fetch models",
        });
    },

    fetchWhisperModels: (whisperBaseUrl) => {
        if (!whisperBaseUrl) {
            return Promise.resolve({ models: [], listAvailable: false });
        }
        const apiUrl = `/api/config/whisper/models?whisperEndpoint=${encodeURIComponent(whisperBaseUrl)}`;
        return handleApiRequest({
            apiCall: () => fetch(apiUrl),
            errorMessage: "Failed to fetch Whisper models",
        });
    },

    savePrompts: (prompts) =>
        handleApiRequest({
            apiCall: () =>
                fetch("/api/config/prompts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(prompts),
                }),
            errorMessage: "Failed to save prompts",
        }),

    saveConfig: (config) =>
        handleApiRequest({
            apiCall: () =>
                fetch("/api/config/global", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(config),
                }),
            errorMessage: "Failed to save config",
        }),

    saveOptions: (category, options) =>
        handleApiRequest({
            apiCall: () =>
                fetch(`/api/config/ollama/${category}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(options),
                }),
            errorMessage: `Failed to save options for ${category}`,
        }),

    saveUserSettings: (userSettings) =>
        handleApiRequest({
            apiCall: () =>
                fetch("/api/config/user", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        ...userSettings,
                        default_letter_template_id:
                            userSettings.default_letter_template_id || null,
                    }),
                }),
            errorMessage: "Failed to save user settings",
        }),
    fetchTemplates: () =>
        handleApiRequest({
            apiCall: () => fetch("/api/templates"),
            errorMessage: "Failed to fetch templates",
        }),

    saveTemplates: (templates) =>
        handleApiRequest({
            apiCall: () => {
                // Convert templates object to array
                const templatesArray = Object.values(templates).map(
                    (template) => ({
                        template_key: template.template_key,
                        template_name: template.template_name,
                        fields: template.fields.map((field) => ({
                            field_key: field.field_key,
                            field_name: field.field_name,
                            field_type: field.field_type,
                            required: field.required,
                            persistent: field.persistent,
                            system_prompt: field.system_prompt,
                            initial_prompt: field.initial_prompt,
                            format_schema: field.format_schema,
                            refinement_rules: field.refinement_rules,
                        })),
                    }),
                );

                return fetch("/api/templates", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(templatesArray), // Send array directly
                });
            },
            errorMessage: "Failed to save templates",
        }),

    setDefaultTemplate: (templateKey) =>
        handleApiRequest({
            apiCall: () =>
                fetch(`/api/templates/default/${templateKey}`, {
                    method: "POST",
                }),
            errorMessage: "Failed to set default template",
        }),

    getDefaultTemplate: () =>
        handleApiRequest({
            apiCall: () => fetch("/api/templates/default"),
            errorMessage: "Failed to get default template",
        }),

    saveLetterTemplateSetting: (templateId) =>
        handleApiRequest({
            apiCall: () =>
                fetch(`/api/letter-templates/default/${templateId}`, {
                    method: "POST",
                }),
            errorMessage: "Failed to set default letter template",
        }),

    resetToDefaults: () =>
        handleApiRequest({
            apiCall: () =>
                fetch("/api/reset-to-defaults", {
                    method: "POST",
                }),
            errorMessage: "Failed to restore defaults",
        }),

    clearDatabase: () =>
        handleApiRequest({
            apiCall: () =>
                fetch("/api/rag/clear-database", {
                    method: "POST",
                }),
            errorMessage: "Failed to clear RAG database",
        }),

    updateConfig: (config) =>
        handleApiRequest({
            apiCall: () =>
                fetch("/api/config/global", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(config),
                }),
            errorMessage: "Failed to update config",
        }),
};
