// Page component for configuring application settings.
import {
    Box,
    Text,
    VStack,
    Center,
    Spinner,
} from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useCallback } from "react";
import { settingsService } from "../utils/settings/settingsUtils";
import { settingsApi } from "../utils/api/settingsApi";
import { authApi } from "../utils/api/authApi";
import { settingsHelpers } from "../utils/helpers/settingsHelpers";
import { syncLanguage } from "../i18n";
import { UI_LANGUAGES } from "../utils/i18n/languages";
import UserSettingsPanel from "../components/settings/UserSettingsPanel";
import AdminSettingsPanel from "../components/settings/AdminSettingsPanel";
import { SPECIALTIES } from "../utils/constants";
import { useTemplate } from "../utils/templates/templateContext";
import { localModelApi } from "../utils/api/localModelApi";
import { useDebounce } from "../utils/hooks/useDebounce";
import { useAutosave } from "../utils/hooks/useAutosave";

const Settings = () => {
    const { t } = useTranslation();
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
        letter: { temperature: 0 },
    });
    const [letterTemplates, setLetterTemplates] = useState([]);

    // Template list comes from the app-wide template store so edits and
    // default changes made here are visible everywhere immediately.
    const {
        templates: providerTemplates,
        setDefaultTemplate: persistDefaultTemplate,
    } = useTemplate();

    const [config, setConfig] = useState(null);
    const [coreLoading, setCoreLoading] = useState(true);
    const [showSpinner, setShowSpinner] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
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
        localModels: true,
    });

    const fetchCoreSettings = useCallback(async () => {
        try {
            setCoreLoading(true);
            // Fail-closed: unknown identity sees no admin panels
            authApi
                .fetchMe()
                .then((me) => setIsAdmin(me?.role === "admin"))
                .catch(() => setIsAdmin(false));

            const configData = await settingsApi.fetchConfig();
            setConfig(configData);

            // Letter templates fetched here instead of a separate useEffect
            const [letterResponse, prompts, optionsData, userSettings] = await Promise.all([
                settingsService.fetchLetterTemplates().catch((error) => {
                    console.error(
                        "Failed to fetch letter templates:",
                        error,
                    );
                    return { templates: [], default_template_id: null };
                }),
                settingsApi.fetchPrompts(),
                configData?.LLM_PROVIDER !== "local"
                    ? settingsApi.fetchOptions()
                    : Promise.resolve(null),
                settingsApi.fetchUserSettings(),
            ]);

            setPrompts(prompts);
            if (optionsData) {
                setOptions(settingsHelpers.processOptionsData(optionsData));
            } else {
                setOptions({
                    letter: { temperature: 0 },
                });
            }
            // Coerce a stored language without a UI locale (pre-localisation
            // picks) to English so the dropdown never holds an unlisted value.
            if (!UI_LANGUAGES.some((l) => l.code === userSettings.preferred_language)) {
                userSettings.preferred_language = "en";
            }
            setUserSettings(userSettings);

            // Sync the preferred language to the localStorage mirror and i18n
            // so locale-aware formatting tracks the clinic language.
            syncLanguage(userSettings.preferred_language);

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

            // Fetch the default template key for the dropdown's initial value
            const defaultTemplate = await settingsApi.getDefaultTemplate();
            setUserSettings((prev) => ({
                ...prev,
                default_template: defaultTemplate.template_key,
            }));
        } catch (error) {
            console.error("Error loading settings:", error);
            toaster.create({
                title: t("page.settings.toasts.loadError"),
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
                const whisperValid = await settingsApi.validateUrl(
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
                const llmValid = await settingsApi.validateUrl(
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
        // default_template persists immediately via handleDefaultTemplateChange
        const {
            default_template: _defaultTemplate,
            default_template_key: _defaultTemplateKey,
            ...rest
        } = newSettings;
        try {
            await settingsApi.saveUserSettings({
                ...rest,
                default_letter_template_id:
                    newSettings.default_letter_template_id || null,
            });
        } catch (error) {
            toaster.create({
                title: t("toast.error"),
                description: t("page.settings.toasts.saveUserError"),
                type: "error",
                duration: 3000,
            });
            throw error;
        }
    };

    const handleDefaultTemplateChange = async (templateKey) => {
        setUserSettings((prev) => ({ ...prev, default_template: templateKey }));
        try {
            await persistDefaultTemplate(templateKey);
        } catch (error) {
            console.error("Failed to set default template:", error);
            toaster.create({
                title: t("toast.error"),
                description: t("page.settings.toasts.defaultTemplateError"),
                type: "error",
                duration: 3000,
            });
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
                title: t("toast.success"),
                description: t("page.settings.toasts.promptReset", {
                    promptType,
                }),
                type: "success",
                duration: 3000,
            });
        } catch {
            toaster.create({
                title: t("toast.error"),
                description: t("page.settings.toasts.promptResetError"),
                type: "error",
                duration: 3000,
            });
        }
    };

    const handleOptionsReset = async () => {
        try {
            await settingsService.resetOptionsToDefaults();
            const optionsData = await settingsApi.fetchOptions();
            setOptions(settingsHelpers.processOptionsData(optionsData));
            toaster.create({
                title: t("toast.success"),
                description: t("page.settings.toasts.optionsReset"),
                type: "success",
                duration: 3000,
            });
        } catch {
            toaster.create({
                title: t("toast.error"),
                description: t("page.settings.toasts.optionsResetError"),
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

    useEffect(() => {
        if (!coreLoading) return;
        const timer = setTimeout(() => setShowSpinner(true), 150);
        return () => clearTimeout(timer);
    }, [coreLoading]);

    if (coreLoading) {
        return (
            <Center h="100dvh">
                {showSpinner && <Spinner size="xl" />}
            </Center>
        );
    }
    return (
        <Box p="5" borderRadius="sm" w="100%">
            <Text as="h2" mb="4">
                {t("page.settings.title")}
            </Text>
            <VStack gap="5" align="stretch">
                <UserSettingsPanel
                    isCollapsed={collapseStates.userSettings}
                    setIsCollapsed={() => toggleCollapse("userSettings")}
                    userSettings={userSettings}
                    setUserSettings={setUserSettings}
                    specialties={SPECIALTIES}
                    templates={providerTemplates || []}
                    letterTemplates={letterTemplates}
                    onDefaultTemplateChange={handleDefaultTemplateChange}
                />

                {isAdmin && (
                    <Box
                        className="anim-fade-slide-up"
                        css={{ animationDuration: "0.2s" }}
                    >
                        <AdminSettingsPanel
                            isCollapsed={collapseStates.modelSettings}
                            setIsCollapsed={() =>
                                toggleCollapse("modelSettings")
                            }
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
                            prompts={prompts}
                            handlePromptChange={handlePromptChange}
                            handlePromptReset={handlePromptReset}
                            letterTemperature={options?.letter?.temperature}
                            onLetterTemperatureChange={(value) =>
                                handleOptionChange(
                                    "letter",
                                    "temperature",
                                    value,
                                )
                            }
                            onOptionsReset={handleOptionsReset}
                        />
                    </Box>
                )}
            </VStack>
        </Box>
    );
};

export default Settings;
