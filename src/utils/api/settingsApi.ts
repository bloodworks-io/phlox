import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

export const settingsApi = {
    fetchUserSettings: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/config/user");
                return universalFetch(url, { signal });
            },
            errorMessage: "Failed to fetch user settings",
        }),

    fetchPrompts: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/config/prompts");
                return universalFetch(url, { signal });
            },
            errorMessage: "Failed to fetch prompts",
        }),

    fetchDefaultPrompts: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/config/prompts/defaults");
                return universalFetch(url, { signal });
            },
            errorMessage: "Failed to fetch default prompts",
        }),

    fetchConfig: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/config/global");
                return universalFetch(url, { signal });
            },
            errorMessage: "Failed to fetch config",
        }),

    fetchOptions: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/config/options");
                return universalFetch(url, { signal });
            },
            errorMessage: "Failed to fetch options",
        }),

    // New method to fetch models for any LLM provider
    fetchLLMModels: async (providerType, baseUrl, apiKey = null) => {
        const params = new URLSearchParams({
            provider: providerType,
            baseUrl: baseUrl,
        });

        if (apiKey) {
            params.append("apiKey", apiKey);
        }

        const endpoint = `/api/config/llm/models?${params.toString()}`;

        return handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl(endpoint);
                return universalFetch(url, { signal });
            },
            errorMessage: `Failed to fetch ${providerType} models`,
        });
    },

    fetchWhisperModels: async (whisperBaseUrl) => {
        if (!whisperBaseUrl) {
            return Promise.resolve({ models: [], listAvailable: false });
        }
        const endpoint = `/api/config/whisper/models?whisperEndpoint=${encodeURIComponent(whisperBaseUrl)}`;
        return handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl(endpoint);
                return universalFetch(url, { signal });
            },
            errorMessage: "Failed to fetch models",
        });
    },

    savePrompts: async (prompts) =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/config/prompts");
                return universalFetch(url, {
                    signal,
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(prompts),
                });
            },
            errorMessage: "Failed to save prompts",
        }),

    saveConfig: async (config) =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/config/global");
                return universalFetch(url, {
                    signal,
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(config),
                });
            },
            errorMessage: "Failed to save config",
        }),

    saveOptions: async (category, options) =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl(
                    `/api/config/options/${category}`,
                );
                return universalFetch(url, {
                    signal,
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(options),
                });
            },
            errorMessage: `Failed to save options for ${category}`,
        }),

    saveUserSettings: async (userSettings) =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/config/user");
                return universalFetch(url, {
                    signal,
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        ...userSettings,
                        default_letter_template_id:
                            userSettings.default_letter_template_id || null,
                    }),
                });
            },
            errorMessage: "Failed to save user settings",
        }),

    fetchTemplates: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/templates");
                return universalFetch(url, { signal });
            },
            errorMessage: "Failed to fetch templates",
        }),

    saveTemplates: async (templates: Record<string, any>) =>
        handleApiRequest({
            apiCall: async (signal) => {
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

                const url = await buildApiUrl("/api/templates");
                return universalFetch(url, {
                    signal,
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(templatesArray), // Send array directly
                });
            },
            errorMessage: "Failed to save templates",
        }),

    setDefaultTemplate: async (templateKey) =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl(
                    `/api/templates/default/${templateKey}`,
                );
                return universalFetch(url, { signal, method: "POST" });
            },
            errorMessage: "Failed to set default template",
        }),

    getDefaultTemplate: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/templates/default");
                return universalFetch(url, { signal });
            },
            errorMessage: "Failed to get default template",
        }),

    saveLetterTemplateSetting: async (templateId) =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl(
                    `/api/letter-templates/default/${templateId}`,
                );
                return universalFetch(url, { signal, method: "POST" });
            },
            errorMessage: "Failed to set default letter template",
        }),

    resetOptionsToDefaults: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl(
                    "/api/config/options/reset-to-defaults",
                );
                return universalFetch(url, { signal, method: "POST" });
            },
            errorMessage: "Failed to reset options to defaults",
        }),

    clearDatabase: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/rag/clear-database");
                return universalFetch(url, { signal, method: "POST" });
            },
            errorMessage: "Failed to clear RAG database",
        }),

    validateUrl: async (type: string, url: string) => {
        if (!url) return false;
        const params = new URLSearchParams({
            url,
            type,
        });
        try {
            const data: any = await handleApiRequest({
                apiCall: async (signal) => {
                    const fullUrl = await buildApiUrl(
                        `/api/config/validate-url?${params.toString()}`,
                    );
                    return universalFetch(fullUrl, { signal });
                },
                errorMessage: `Failed to validate ${type} URL`,
            });
            return Boolean(data?.valid);
        } catch (error) {
            console.error(`Error validating ${type} URL:`, error);
            return false;
        }
    },

    markSplashCompleted: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl(
                    "/api/config/user/mark_splash_complete",
                );
                return universalFetch(url, { signal, method: "POST" });
            },
            errorMessage: "Failed to mark splash screen as complete",
        }),

    fetchServerStatus: async (signal?: AbortSignal) => {
        const url = await buildApiUrl("/api/config/status");
        const response = await universalFetch(url, { signal });
        if (!response.ok) {
            let detail;
            try {
                const errorData = await response.json();
                detail = errorData.detail || errorData.message;
            } catch {
                // No JSON body
            }
            throw new Error(
                detail || `HTTP error! status: ${response.status}`,
            );
        }
        return response.json();
    },
};
