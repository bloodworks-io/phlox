import { settingsApi } from "../api/settingsApi";
import { letterApi } from "../api/letterApi";
import { settingsHelpers } from "../helpers/settingsHelpers";
import { templateService } from "../templates/templateService";
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
            const response = await fetch("/api/config/user");
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
                // This case should ideally not happen if components pass setters.
                // For safety, or if direct data return is still needed elsewhere (unlikely for this specific function based on Settings.js)
                // console.warn("fetchUserSettings called without a setter. Returning data directly.");
                return userData; // Or throw an error if setter is always mandatory
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

    // New consolidated method to fetch LLM models - works for both Ollama and OpenAI-compatible
    // New consolidated method to fetch LLM models - works for Ollama, OpenAI-compatible, and Local
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
            const apiKey = config.LLM_API_KEY || "";

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

    // Keep the old method for backward compatibility, but use the new one internally
    fetchOllamaModels: (ollamaBaseUrl, setModelOptions) => {
        return settingsApi
            .fetchOllamaModels(ollamaBaseUrl)
            .then((data) =>
                setModelOptions(data.models.map((model) => model.name)),
            )
            .catch((error) => {
                console.error("Error fetching Ollama models:", error);
                setModelOptions([]);
            });
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

    saveSettings: async ({ prompts, config, options, userSettings, toast }) => {
        try {
            await settingsApi.savePrompts(prompts);
            await settingsApi.saveConfig(config);

            for (const [category, categoryOptions] of Object.entries(options)) {
                await settingsApi.saveOptions(category, categoryOptions);
            }
            await settingsApi.saveUserSettings({
                ...userSettings,
                default_letter_template_id:
                    userSettings.default_letter_template_id || null,
            });

            // Save default template selection
            if (userSettings.default_template) {
                await templateService.setDefaultTemplate(
                    userSettings.default_template,
                    toast,
                );
            }

            settingsHelpers.showSuccessToast(
                toast,
                "All settings saved successfully",
            );
        } catch (error) {
            settingsHelpers.showErrorToast(
                toast,
                "Failed to save some settings",
            );
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

    resetLetterTemplates: async (toast) => {
        try {
            await letterApi.resetLetterTemplates();
            toast({
                title: "Success",
                description: "Letter templates reset to defaults",
                status: "success",
                duration: 3000,
                isClosable: true,
            });
        } catch (error) {
            console.error("Failed to reset letter templates:", error);
            toast({
                title: "Error",
                description: "Failed to reset letter templates",
                status: "error",
                duration: 3000,
                isClosable: true,
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
                toast({
                    title: "Success",
                    description:
                        "RAG database cleared and embedding model updated",
                    status: "success",
                    duration: 3000,
                    isClosable: true,
                });
            }
        } catch (error) {
            if (toast) {
                toast({
                    title: "Error",
                    description: "Failed to clear RAG database",
                    status: "error",
                    duration: 3000,
                    isClosable: true,
                });
            }
            throw error;
        }
    },

    saveGlobalConfig: async (configData) => {
        const response = await fetch("/api/config/global", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(configData),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || "Failed to save global config");
        }
        return await response.json();
    },

    markSplashCompleted: async () => {
        const response = await fetch("/api/config/user/mark_splash_complete", {
            method: "POST",
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
                errorData.detail || "Failed to mark splash screen as complete",
            );
        }
        return await response.json();
    },
};
