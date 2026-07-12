import { ragApi } from "../api/ragApi";
import { toaster } from "@/components/ui/toaster";
import { settingsApi } from "../api/settingsApi";
import { letterApi } from "../api/letterApi";
import { settingsHelpers } from "../helpers/settingsHelpers";
import { buildApiUrl } from "../../utils/helpers/apiConfig";
import { universalFetch } from "../helpers/apiHelpers";

export const settingsService = {
    fetchConfig: async () => {
        const response = await settingsApi.fetchConfig();
        return response; // Just return the data, don't try to use setConfig here
    },

    fetchPrompts: (setPrompts) => {
        return settingsApi.fetchPrompts().then((data) => setPrompts(data));
    },

    async fetchUserSettings(setter) {
        // Changed: Re-add setter argument
        try {
            const response = await universalFetch(
                await buildApiUrl("/api/config/user"),
            );
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.detail || "Failed to fetch user settings",
                );
            }
            const userData = await response.json();
            if (setter) {
                // Added check for setter
                setter(userData); // Call the setter with fetched data
            } else {
                return userData;
            }
        } catch (error) {
            console.error("Error in fetchUserSettings:", error);
            // Re-throw or handle as appropriate, perhaps by calling setter with default/error state
            throw error;
        }
    },

    fetchOptions: (setOptions) => {
        return settingsApi
            .fetchOptions()
            .then((data) =>
                setOptions(settingsHelpers.processOptionsData(data)),
            );
    },

    fetchLLMModels: async (config, setModelOptions) => {
        try {
            const providerType = config.LLM_PROVIDER || "ollama";

            // For local models, we don't need base URL
            if (providerType === "local") {
                const response = await settingsApi.fetchLLMModels(
                    providerType,
                    null, // No base URL needed for local
                    null, // No API key needed for local
                );
                setModelOptions(response.models || []);
                return;
            }

            // For remote providers, base URL is required
            if (!config.LLM_BASE_URL) {
                setModelOptions([]);
                return;
            }

            const baseUrl = config.LLM_BASE_URL;

            const rawKey = config.LLM_API_KEY || "";
            const apiKey = rawKey.includes("•") ? null : rawKey;

            const response = await settingsApi.fetchLLMModels(
                providerType,
                baseUrl,
                apiKey,
            );

            if (providerType === "ollama") {
                // Format for Ollama response
                setModelOptions(response.models.map((model) => model.name));
            } else {
                // Format for OpenAI-compatible response
                setModelOptions(response.models || []);
            }
        } catch (error) {
            console.error(
                `Error fetching ${config.LLM_PROVIDER} models:`,
                error,
            );
            setModelOptions([]);
        }
    },

    fetchWhisperModels: async (
        whisperBaseUrl,
        setWhisperModelOptions,
        setWhisperModelListAvailable,
    ) => {
        try {
            const response =
                await settingsApi.fetchWhisperModels(whisperBaseUrl);
            setWhisperModelOptions(response.models);
            if (setWhisperModelListAvailable) {
                setWhisperModelListAvailable(response.listAvailable);
            }
            return response;
        } catch (error) {
            console.error("Error fetching whisper models:", error);
            return { models: [], listAvailable: false };
        }
    },

    validateUrl: async (type, url) => {
        if (!url) {
            return false;
        }

        try {
            const response = await universalFetch(
                await buildApiUrl(
                    `/api/config/validate-url?url=${encodeURIComponent(url)}&type=${type}`,
                ),
            );
            if (response.ok) {
                const data = await response.json();
                return data.valid;
            }
            return false;
        } catch (error) {
            console.error(`Error validating ${type} URL:`, error);
            return false;
        }
    },

    fetchTemplates: async (setTemplates) => {
        const response = await universalFetch(
            await buildApiUrl("/api/templates"),
        );
        if (!response.ok) {
            throw new Error("Failed to fetch templates");
        }
        const data = await response.json();
        setTemplates(data);
        return data;
    },

    getDefaultTemplate: async () => {
        try {
            const response = await settingsApi.getDefaultTemplate();
            return response;
        } catch (error) {
            console.error("Failed to get default template:", error);
            throw error;
        }
    },

    setDefaultTemplate: async (templateKey, toast) => {
        try {
            await settingsApi.setDefaultTemplate(templateKey);
            if (toast) {
                settingsHelpers.showSuccessToast(
                    toast,
                    "Default template updated successfully",
                );
            }
        } catch (error) {
            if (toast) {
                settingsHelpers.showErrorToast(
                    toast,
                    "Failed to set default template",
                );
            }
            throw error;
        }
    },

    saveLetterTemplateSetting: async (templateId, toast) => {
        try {
            await settingsApi.saveLetterTemplateSetting(templateId);
            if (toast) {
                settingsHelpers.showSuccessToast(
                    toast,
                    "Default letter template updated successfully",
                );
            }
        } catch (error) {
            if (toast) {
                settingsHelpers.showErrorToast(
                    toast,
                    "Failed to set default letter template",
                );
            }
            throw error;
        }
    },

    saveUserSettings: async (userSettings) => {
        try {
            return await settingsApi.saveUserSettings(userSettings);
        } catch (error) {
            console.error("Error saving user settings:", error);
            throw error;
        }
    },

    updateConfig: async (config, key, value) => {
        // Simply return new config without API call
        return {
            ...config,
            [key]: value,
        };
    },
    fetchLetterTemplates: async () => {
        try {
            const response = await letterApi.fetchLetterTemplates();
            return response; // Return the whole response with templates and default_template_id
        } catch (error) {
            console.error("Failed to fetch letter templates:", error);
            throw error;
        }
    },

    saveLetterTemplate: async (template) => {
        try {
            if (template.id) {
                // Update existing template
                await letterApi.updateLetterTemplate(template.id, template);
            } else {
                // Create new template
                await letterApi.createLetterTemplate(template);
            }
        } catch (error) {
            console.error("Failed to save letter template:", error);
            throw error;
        }
    },

    deleteLetterTemplate: async (templateId) => {
        try {
            await letterApi.deleteLetterTemplate(templateId);
        } catch (error) {
            console.error("Failed to delete letter template:", error);
            throw error;
        }
    },

    resetLetterTemplates: async () => {
        try {
            await letterApi.resetLetterTemplates();
            toaster.create({
                title: "Success",
                description: "Letter templates reset to defaults",
                type: "success",
                duration: 3000,
            });
        } catch (error) {
            console.error("Failed to reset letter templates:", error);
            toaster.create({
                title: "Error",
                description: "Failed to reset letter templates",
                type: "error",
                duration: 3000,
            });
            throw error;
        }
    },
    clearDatabase: async (newEmbeddingModel, config, toast) => {
        try {
            // Clear the database
            await settingsApi.clearDatabase();

            // Update config with new embedding model
            if (newEmbeddingModel) {
                await settingsApi.updateConfig({
                    ...config,
                    EMBEDDING_MODEL: newEmbeddingModel,
                });
            }

            if (toast) {
                toaster.create({
                    title: "Success",
                    description:
                        "RAG database cleared and embedding model updated",
                    type: "success",
                    duration: 3000,
                });
            }
        } catch (error) {
            if (toast) {
                toaster.create({
                    title: "Error",
                    description: "Failed to clear RAG database",
                    type: "error",
                    duration: 3000,
                });
            }
            throw error;
        }
    },

    reEmbed: async (newEmbeddingModel, config, toast, onProgress = null) => {
        try {
            // Update config with new embedding model first
            if (newEmbeddingModel) {
                await settingsApi.updateConfig({
                    ...config,
                    EMBEDDING_MODEL: newEmbeddingModel,
                });
            }

            // Stream re-embed progress
            let result = null;
            for await (const event of ragApi.streamReEmbed()) {
                if (event.type === "error") {
                    throw new Error(event.message || "Re-embedding failed");
                }

                onProgress?.(event);

                if (event.type === "complete") {
                    result = event;
                }
            }

            if (toast && result) {
                toaster.create({
                    title: "Success",
                    description: `Re-embedded ${result.total_chunks_re_embedded || "all"} chunks with new model`,
                    type: "success",
                    duration: 3000,
                });
            }

            return result;
        } catch (error) {
            if (toast) {
                toaster.create({
                    title: "Error",
                    description: "Failed to re-embed documents",
                    type: "error",
                    duration: 3000,
                });
            }
            throw error;
        }
    },

    saveGlobalConfig: async (configData) => {
        try {
            const response = await universalFetch(
                await buildApiUrl("/api/config/global"),
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(configData),
                },
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.detail || "Failed to save global config",
                );
            }
            return await response.json();
        } catch (error) {
            console.error("Error saving global config:", error);
            throw error;
        }
    },

    markSplashCompleted: async () => {
        try {
            const response = await universalFetch(
                await buildApiUrl("/api/config/user/mark_splash_complete"),
                {
                    method: "POST",
                },
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.detail ||
                        "Failed to mark splash screen as complete",
                );
            }
            return await response.json();
        } catch (error) {
            console.error("Error marking splash completed:", error);
            throw error;
        }
    },

    saveAmbientMode: async (isAmbient) => {
        try {
            const response = await universalFetch(
                await buildApiUrl("/api/config/user"),
            );
            if (!response.ok) throw new Error("Failed to fetch user settings");
            const userData = await response.json();

            return await settingsApi.saveUserSettings({
                ...userData,
                scribe_is_ambient: isAmbient,
            });
        } catch (error) {
            console.error("Error saving ambient mode setting:", error);
            throw error;
        }
    },

    resetIndividualPrompt: async (promptType) => {
        try {
            // Fetch defaults
            const defaults = await settingsApi.fetchDefaultPrompts();

            // Get current prompts
            const currentPrompts = await settingsApi.fetchPrompts();

            // Merge: replace only the specified prompt with default
            const updatedPrompts = {
                ...currentPrompts,
                [promptType]: defaults[promptType],
            };

            // Save updated prompts
            await settingsApi.savePrompts(updatedPrompts);

            return updatedPrompts;
        } catch (error) {
            console.error("Error resetting prompt:", error);
            throw error;
        }
    },

    resetOptionsToDefaults: async (toast) => {
        try {
            await settingsApi.resetOptionsToDefaults();
            if (toast) {
                settingsHelpers.showSuccessToast(
                    toast,
                    "Advanced options reset to defaults",
                );
            }
        } catch (error) {
            console.error("Error resetting options:", error);
            if (toast) {
                settingsHelpers.showErrorToast(
                    toast,
                    "Failed to reset advanced options",
                );
            }
            throw error;
        }
    },
};
