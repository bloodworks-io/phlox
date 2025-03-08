import { settingsApi } from "../api/settingsApi";
import { letterApi } from "../api/letterApi";
import { settingsHelpers } from "../helpers/settingsHelpers";
import { templateService } from "../templates/templateService";
export const settingsService = {
    fetchConfig: async () => {
        const response = await settingsApi.fetchConfig();
        return response; // Just return the data, don't try to use setConfig here
    },

    fetchPrompts: (setPrompts) => {
        return settingsApi.fetchPrompts().then((data) => setPrompts(data));
    },

    fetchUserSettings: (setUserSettings) => {
        return settingsApi.fetchUserSettings().then((data) => {
            setUserSettings(data);
            return data;
        });
    },

    fetchOptions: (setOptions) => {
        return settingsApi
            .fetchOptions()
            .then((data) =>
                setOptions(settingsHelpers.processOptionsData(data)),
            );
    },

    fetchOllamaModels: (ollamaBaseUrl, setModelOptions) => {
        return settingsApi
            .fetchOllamaModels(ollamaBaseUrl)
            .then((data) =>
                setModelOptions(data.models.map((model) => model.name)),
            );
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
            const response = await fetch(
                `/api/config/validate-url?url=${encodeURIComponent(url)}&type=${type}`,
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
        const response = await fetch("/api/templates");
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
};
