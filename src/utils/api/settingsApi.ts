import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";
import { t } from "@/i18n";

export const settingsApi = {
    fetchUserSettings: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/config/user");
                return universalFetch(url, { signal });
            },
            errorMessage: t("api.settings.fetchUserSettingsFailed"),
        }),

    fetchPrompts: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/config/prompts");
                return universalFetch(url, { signal });
            },
            errorMessage: t("api.settings.fetchPromptsFailed"),
        }),

    fetchDefaultPrompts: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/config/prompts/defaults");
                return universalFetch(url, { signal });
            },
            errorMessage: t("api.settings.fetchDefaultPromptsFailed"),
        }),

    fetchConfig: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/config/global");
                return universalFetch(url, { signal });
            },
            errorMessage: t("api.settings.fetchConfigFailed"),
        }),

    fetchCapabilities: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/config/capabilities");
                return universalFetch(url, { signal });
            },
            errorMessage: t("api.settings.fetchCapabilitiesFailed"),
        }),

    fetchOptions: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/config/options");
                return universalFetch(url, { signal });
            },
            errorMessage: t("api.settings.fetchOptionsFailed"),
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
            errorMessage: t("api.settings.fetchModelsForFailed", { provider: providerType }),
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
            errorMessage: t("api.settings.fetchModelsFailed"),
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
            errorMessage: t("api.settings.savePromptsFailed"),
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
            errorMessage: t("api.settings.saveConfigFailed"),
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
            errorMessage: t("api.settings.saveOptionsForFailed", { category }),
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
            errorMessage: t("page.settings.toasts.saveUserError"),
        }),

    fetchTemplates: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/templates");
                return universalFetch(url, { signal });
            },
            errorMessage: t("api.templates.fetchFailed"),
        }),

    setDefaultTemplate: async (templateKey) =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl(
                    `/api/templates/default/${templateKey}`,
                );
                return universalFetch(url, { signal, method: "POST" });
            },
            errorMessage: t("page.settings.toasts.defaultTemplateError"),
        }),

    getDefaultTemplate: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/templates/default");
                return universalFetch(url, { signal });
            },
            errorMessage: t("api.settings.getDefaultTemplateFailed"),
        }),

    saveLetterTemplateSetting: async (templateId) =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl(
                    `/api/letter-templates/default/${templateId}`,
                );
                return universalFetch(url, { signal, method: "POST" });
            },
            errorMessage: t("api.settings.setDefaultLetterTemplateFailed"),
        }),

    resetOptionsToDefaults: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl(
                    "/api/config/options/reset-to-defaults",
                );
                return universalFetch(url, { signal, method: "POST" });
            },
            errorMessage: t("api.settings.resetOptionsFailed"),
        }),

    clearDatabase: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/rag/clear-database");
                return universalFetch(url, { signal, method: "POST" });
            },
            errorMessage: t("api.settings.clearRagDatabaseFailed"),
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
                errorMessage: t("api.settings.validateUrlForFailed", { type }),
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
            errorMessage: t("api.settings.markSplashFailed"),
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
                detail || t("api.error.httpStatus", { status: response.status }),
            );
        }
        return response.json();
    },
};
