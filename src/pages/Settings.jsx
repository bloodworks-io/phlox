// Page component for configuring application settings.
import {
    Box,
    Text,
    VStack,
} from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { useState, useEffect, useCallback, useRef } from "react";
import { settingsService } from "../utils/settings/settingsUtils";
import { settingsApi } from "../utils/api/settingsApi";
import UserSettingsPanel from "../components/settings/UserSettingsPanel";
import ModelSettingsPanel from "../components/settings/ModelSettingsPanel";
import PromptSettingsPanel from "../components/settings/PromptSettingsPanel";
import { SPECIALTIES } from "../utils/constants";
import { templateService } from "../utils/services/templateService";
import { localModelApi } from "../utils/api/localModelApi";
import { useDebounce } from "../utils/hooks/useDebounce";
import { useAutosave } from "../utils/hooks/useAutosave";

const Settings = () => {
    const [userSettings, setUserSettings] = useState({
        name: "",
        specialty: "",
        quick_chat_1_title: "Review my plan",
        quick_chat_1_prompt: "Review my plan",
        quick_chat_2_title: "Additional points to review",
        quick_chat_2_prompt: "Additional points to review",
        quick_chat_3_title: "Other conditions worth reviewing",
        quick_chat_3_prompt: "Other conditions worth reviewing",
    });
    const [prompts, setPrompts] = useState(null);
    const [options, setOptions] = useState({
        general: { num_ctx: 0 },
        secondary: { num_ctx: 0 },
        letter: { temperature: 0 },
    });
    const [templates, setTemplates] = useState({});
    const [letterTemplates, setLetterTemplates] = useState([]);

    const [config, setConfig] = useState(null);
    const [coreLoading, setCoreLoading] = useState(true);
    const [llmModelsLoading, setLlmModelsLoading] = useState(false);
    const [whisperModelsLoading, setWhisperModelsLoading] = useState(false);
    const [modelOptions, setModelOptions] = useState([]);
    const [whisperModelOptions, setWhisperModelOptions] = useState([]);
    const [whisperModelListAvailable, setWhisperModelListAvailable] =
        useState(false);

    const [urlStatus, setUrlStatus] = useState({
        whisper: false,
        llm: false,
    });
    const [collapseStates, setCollapseStates] = useState({
        userSettings: false,
        modelSettings: true,
        promptSettings: true,
        localModels: true,
    });

    // Track default_template separately — it persists via a different endpoint
    const lastDefaultTemplateRef = useRef(null);

    const fetchCoreSettings = useCallback(async () => {
        try {
            setCoreLoading(true);
            const configData = await settingsService.fetchConfig();
            setConfig(configData);

            // Letter templates fetched here instead of a separate useEffect
            const [letterResponse] = await Promise.all([
                settingsService.fetchLetterTemplates().catch((error) => {
                    console.error(
                        "Failed to fetch letter templates:",
                        error,
                    );
                    return { templates: [], default_template_id: null };
                }),
                settingsService.fetchPrompts(setPrompts),
                // Only fetch model options if NOT using local models
                configData?.LLM_PROVIDER !== "local"
                    ? settingsService.fetchOptions(setOptions)
                    : Promise.resolve(
                          setOptions({
                              general: { num_ctx: 0 },
                              secondary: { num_ctx: 0 },
                              letter: { temperature: 0 },
                          }),
                      ),
                settingsService.fetchUserSettings(setUserSettings),
                settingsService.fetchTemplates(setTemplates),
            ]);

            // Set letter templates from parallel fetch
            if (letterResponse) {
                setLetterTemplates(letterResponse.templates);
                if (letterResponse.default_template_id !== null) {
                    setUserSettings((prev) => ({
                        ...prev,
                        default_letter_template_id:
                            letterResponse.default_template_id,
                    }));
                }
            }

            // Fetch and merge default template into user settings
            const defaultTemplate = await templateService.getDefaultTemplate();
            setUserSettings((prev) => ({
                ...prev,
                default_template: defaultTemplate.template_key,
            }));
            lastDefaultTemplateRef.current = defaultTemplate.template_key;
        } catch (error) {
            console.error("Error loading settings:", error);
            toaster.create({
                title: "Error loading settings",
                description: error.message,
                type: "error",
                duration: 3000,
            });
        } finally {
            setCoreLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCoreSettings();
    }, [fetchCoreSettings]);

    const debouncedWhisperUrl = useDebounce(config?.WHISPER_BASE_URL, 500);
    const debouncedLlmBaseUrl = useDebounce(config?.LLM_BASE_URL, 500);
    const debouncedLlmProvider = useDebounce(config?.LLM_PROVIDER, 500);
    const debouncedLlmApiKey = useDebounce(config?.LLM_API_KEY, 500);

    useEffect(() => {
        const validateUrls = async () => {
            if (debouncedWhisperUrl) {
                const whisperValid = await settingsService.validateUrl(
                    "whisper",
                    debouncedWhisperUrl,
                );
                setUrlStatus((prev) => ({ ...prev, whisper: whisperValid }));
            } else {
                setUrlStatus((prev) => ({ ...prev, whisper: false }));
            }

            if (debouncedLlmBaseUrl) {
                // Use provider type from config for URL validation
                const providerType = debouncedLlmProvider || "openai";
                const llmValid = await settingsService.validateUrl(
                    providerType,
                    debouncedLlmBaseUrl,
                );
                setUrlStatus((prev) => ({ ...prev, llm: llmValid }));
            } else {
                setUrlStatus((prev) => ({ ...prev, llm: false }));
            }
        };

        validateUrls();
    }, [debouncedWhisperUrl, debouncedLlmBaseUrl, debouncedLlmProvider]);

    useEffect(() => {
        const refreshWhisperModels = async () => {
            // Guard: don't clear existing models during debounce settling
            if (!debouncedWhisperUrl) {
                return;
            }

            setWhisperModelsLoading(true);
            try {
                await settingsService.fetchWhisperModels(
                    debouncedWhisperUrl,
                    setWhisperModelOptions,
                    setWhisperModelListAvailable,
                );
            } catch (error) {
                console.error("Error refreshing Whisper models:", error);
                setWhisperModelOptions([]);
                setWhisperModelListAvailable(false);
            } finally {
                setWhisperModelsLoading(false);
            }
        };

        refreshWhisperModels();
    }, [debouncedWhisperUrl]);

    useEffect(() => {
        const refreshLlmModels = async () => {
            // Local mode uses local model manager, not remote model listing
            if ((config?.LLM_PROVIDER || "openai") === "local") {
                return;
            }

            // Guard: don't clear existing models during debounce settling
            if (!debouncedLlmBaseUrl) {
                return;
            }

            setLlmModelsLoading(true);
            try {
                await settingsService.fetchLLMModels(
                    {
                        LLM_PROVIDER: debouncedLlmProvider || "openai",
                        LLM_BASE_URL: debouncedLlmBaseUrl,
                        LLM_API_KEY: debouncedLlmApiKey,
                    },
                    setModelOptions,
                );
            } catch (error) {
                console.error("Error refreshing LLM models:", error);
                setModelOptions([]);
            } finally {
                setLlmModelsLoading(false);
            }
        };

        refreshLlmModels();
    }, [
        debouncedLlmBaseUrl,
        debouncedLlmProvider,
        debouncedLlmApiKey,
        config?.LLM_PROVIDER,
    ]);

    // Load local models when provider is "local"
    useEffect(() => {
        if (config?.LLM_PROVIDER !== "local") return;

        const fetchLocalModels = async () => {
            setLlmModelsLoading(true);
            try {
                const localModels = await localModelApi.fetchLocalModels();
                const modelNames = localModels.models.map(
                    (m) => m.name || m.filename,
                );
                setModelOptions(modelNames);
            } catch (error) {
                console.error("Error loading local models:", error);
                setModelOptions([]);
            } finally {
                setLlmModelsLoading(false);
            }
        };

        fetchLocalModels();
    }, [config?.LLM_PROVIDER]);

    const toggleCollapse = (section) => {
        setCollapseStates((prev) => ({
            ...prev,
            [section]: !prev[section],
        }));
    };

    const saveUserSettingsFn = async (newSettings) => {
        const { disabled_tools: _dt, default_template, ...rest } = newSettings;
        await settingsApi.saveUserSettings({
            ...rest,
            default_letter_template_id:
                newSettings.default_letter_template_id || null,
        });
        if (
            default_template &&
            default_template !== lastDefaultTemplateRef.current
        ) {
            await templateService.setDefaultTemplate(default_template);
            lastDefaultTemplateRef.current = default_template;
        }
    };

    const savePromptsFn = async (newPrompts) => {
        if (newPrompts) await settingsApi.savePrompts(newPrompts);
    };

    const saveConfigFn = async (newConfig) => {
        if (newConfig) await settingsApi.saveConfig(newConfig);
    };

    const saveOptionsFn = async (newOptions) => {
        for (const [category, categoryOptions] of Object.entries(newOptions)) {
            await settingsApi.saveOptions(category, categoryOptions);
        }
    };

    const autosaveEnabled = !coreLoading;
    const userAutosave = useAutosave(
        userSettings,
        saveUserSettingsFn,
        800,
        autosaveEnabled,
    );
    const promptsAutosave = useAutosave(
        prompts,
        savePromptsFn,
        1200,
        autosaveEnabled,
    );
    const configAutosave = useAutosave(
        config,
        saveConfigFn,
        800,
        autosaveEnabled,
    );
    const optionsAutosave = useAutosave(
        options,
        saveOptionsFn,
        800,
        autosaveEnabled,
    );

    const isDirty =
        userAutosave.isDirty ||
        promptsAutosave.isDirty ||
        configAutosave.isDirty ||
        optionsAutosave.isDirty;

    useEffect(() => {
        const handler = (e) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [isDirty]);

    const handlePromptReset = async (promptType) => {
        try {
            const updatedPrompts =
                await settingsService.resetIndividualPrompt(promptType);
            setPrompts(updatedPrompts);
            toaster.create({
                title: "Success",
                description: `${promptType} prompt reset to default`,
                type: "success",
                duration: 3000,
            });
        } catch {
            toaster.create({
                title: "Error",
                description: "Failed to reset prompt",
                type: "error",
                duration: 3000,
            });
        }
    };

    const handleOptionsReset = async () => {
        try {
            await settingsService.resetOptionsToDefaults();
            await settingsService.fetchOptions(setOptions);
            toaster.create({
                title: "Success",
                description: "Advanced options reset to defaults",
                type: "success",
                duration: 3000,
            });
        } catch {
            toaster.create({
                title: "Error",
                description: "Failed to reset advanced options",
                type: "error",
                duration: 3000,
            });
        }
    };

    const handlePromptChange = (promptType, field, value) => {
        setPrompts((prev) => ({
            ...prev,
            [promptType]: {
                ...prev[promptType],
                [field]: value,
            },
        }));
    };

    const handleOptionChange = (category, key, value) => {
        setOptions((prev) => ({
            ...prev,
            [category]: {
                ...prev[category],
                [key]: value,
            },
        }));
    };
    const handleConfigChange = (key, value) => {
        setConfig((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const handleReEmbed = async (newEmbeddingModel, onProgress = null) => {
        await settingsService.reEmbed(
            newEmbeddingModel,
            config,
            true,
            onProgress,
        );
        await fetchCoreSettings();
    };

    if (coreLoading) {
        return <Box>Loading...</Box>;
    }
    return (
        <Box p="5" borderRadius="sm" w="100%">
            <Text as="h2" mb="4">
                Settings
            </Text>
            <VStack gap="5" align="stretch">
                <UserSettingsPanel
                    isCollapsed={collapseStates.userSettings}
                    setIsCollapsed={() => toggleCollapse("userSettings")}
                    userSettings={userSettings}
                    setUserSettings={setUserSettings}
                    specialties={SPECIALTIES}
                    templates={templates}
                    letterTemplates={letterTemplates}
                    setTemplates={setTemplates}
                />

                <ModelSettingsPanel
                    isCollapsed={collapseStates.modelSettings}
                    setIsCollapsed={() => toggleCollapse("modelSettings")}
                    config={config}
                    handleConfigChange={handleConfigChange}
                    modelOptions={modelOptions}
                    embeddingModelOptions={modelOptions}
                    whisperModelOptions={whisperModelOptions}
                    whisperModelListAvailable={whisperModelListAvailable}
                    whisperModelsLoading={whisperModelsLoading}
                    llmModelsLoading={llmModelsLoading}
                    urlStatus={urlStatus}
                    handleReEmbed={handleReEmbed}
                />

                <PromptSettingsPanel
                    isCollapsed={collapseStates.promptSettings}
                    setIsCollapsed={() => toggleCollapse("promptSettings")}
                    prompts={prompts}
                    handlePromptChange={handlePromptChange}
                    handlePromptReset={handlePromptReset}
                    options={options}
                    handleOptionChange={handleOptionChange}
                    handleOptionsReset={handleOptionsReset}
                    config={config}
                />
            </VStack>
        </Box>
    );
};

export default Settings;
