import { ragApi } from "../api/ragApi";
import { toaster } from "@/components/ui/toaster";
import { settingsApi } from "../api/settingsApi";
import { letterApi } from "../api/letterApi";
import { settingsHelpers } from "../helpers/settingsHelpers";

export const settingsService = {
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
                    null,
                    null,
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
                setModelOptions(response.models.map((model) => model.name));
            } else {
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

    fetchLetterTemplates: async () => {
        try {
            return await letterApi.fetchLetterTemplates();
        } catch (error) {
            console.error("Failed to fetch letter templates:", error);
            throw error;
        }
    },

    saveLetterTemplate: async (template) => {
        try {
            if (template.id) {
                await letterApi.updateLetterTemplate(template.id, template);
            } else {
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
            await settingsApi.clearDatabase();

            if (newEmbeddingModel) {
                await settingsApi.saveConfig({
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
            if (newEmbeddingModel) {
                await settingsApi.saveConfig({
                    ...config,
                    EMBEDDING_MODEL: newEmbeddingModel,
                });
            }

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

    saveAmbientMode: async (isAmbient) => {
        try {
            const userData = await settingsApi.fetchUserSettings();
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
            const defaults = await settingsApi.fetchDefaultPrompts();
            const currentPrompts = await settingsApi.fetchPrompts();
            const updatedPrompts = {
                ...currentPrompts,
                [promptType]: defaults[promptType],
            };
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
