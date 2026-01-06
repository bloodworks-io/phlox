// Page component for configuring application settings.
import {
  Box,
  Text,
  VStack,
  useToast,
  Button,
  useDisclosure,
} from "@chakra-ui/react";
import { useState, useEffect, useCallback } from "react";
import { settingsService } from "../utils/settings/settingsUtils";
import UserSettingsPanel from "../components/settings/UserSettingsPanel";
import ModelSettingsPanel from "../components/settings/ModelSettingsPanel";
import PromptSettingsPanel from "../components/settings/PromptSettingsPanel";
import RagSettingsPanel from "../components/settings/RagSettingsPanel";
import LetterTemplatesPanel from "../components/settings/LetterTemplatesPanel";
import SettingsActions from "../components/settings/SettingsActions";
import { SPECIALTIES } from "../utils/constants/index.jsx";
import TemplateSettingsPanel from "../components/settings/TemplateSettingsPanel";
import ChatSettingsPanel from "../components/settings/ChatSettingsPanel";
import { templateService } from "../utils/services/templateService";
import LocalModelManagerModal from "../components/settings/LocalModelManagerModal";
import { localModelApi } from "../utils/api/localModelApi";

const Settings = () => {
  const [userSettings, setUserSettings] = useState({
    name: "",
    specialty: "",
    quick_chat_1_title: "Critique my plan",
    quick_chat_1_prompt: "Critique my plan",
    quick_chat_2_title: "Any additional investigations",
    quick_chat_2_prompt: "Any additional investigations",
    quick_chat_3_title: "Any differentials to consider",
    quick_chat_3_prompt: "Any differentials to consider",
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
  const [loading, setLoading] = useState(true);
  const [modelOptions, setModelOptions] = useState([]);
  const [whisperModelOptions, setWhisperModelOptions] = useState([]);
  const [whisperModelListAvailable, setWhisperModelListAvailable] =
    useState(false);

  const toast = useToast();
  const [urlStatus, setUrlStatus] = useState({
    whisper: false,
    ollama: false,
  });
  const localModelsDisclosure = useDisclosure();
  const [modelManagerRefreshKey, setModelManagerRefreshKey] = useState(0);
  const [collapseStates, setCollapseStates] = useState({
    userSettings: false,
    modelSettings: true,
    promptSettings: true,
    ragSettings: true,
    letterTemplates: true,
    templates: true,
    chatSettings: true,
    localModels: true,
  });
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const configData = await settingsService.fetchConfig();
      setConfig(configData);

      await Promise.all([
        settingsService.fetchPrompts(setPrompts),
        // Only fetch Ollama options if NOT using local models
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

      // Fetch and merge default template into user settings
      const defaultTemplate = await templateService.getDefaultTemplate();
      setUserSettings((prev) => ({
        ...prev,
        default_template: defaultTemplate.template_key,
      }));

      // Fetch models based on provider
      if (configData?.LLM_PROVIDER === "local") {
        // Fetch local downloaded models
        try {
          const localModels = await localModelApi.fetchLocalModels();
          const modelNames = localModels.models.map(
            (m) => m.name || m.filename,
          );
          setModelOptions(modelNames);
        } catch (error) {
          console.error("Error loading local models:", error);
        }
      } else if (configData?.LLM_BASE_URL) {
        await settingsService.fetchLLMModels(configData, setModelOptions);
      }

      if (configData?.WHISPER_BASE_URL) {
        await settingsService.fetchWhisperModels(
          configData.WHISPER_BASE_URL,
          setWhisperModelOptions,
          setWhisperModelListAvailable,
        );
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({
        title: "Error loading settings",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    const validateUrls = async () => {
      if (config?.WHISPER_BASE_URL) {
        const whisperValid = await settingsService.validateUrl(
          "whisper",
          config.WHISPER_BASE_URL,
        );
        setUrlStatus((prev) => ({ ...prev, whisper: whisperValid }));
      }

      if (config?.LLM_BASE_URL) {
        // Use provider type from config for URL validation
        const providerType = config?.LLM_PROVIDER || "ollama";
        const llmValid = await settingsService.validateUrl(
          providerType,
          config.LLM_BASE_URL,
        );
        setUrlStatus((prev) => ({ ...prev, llm: llmValid }));
      }
    };

    validateUrls();
  }, [config?.WHISPER_BASE_URL, config?.LLM_BASE_URL, config?.LLM_PROVIDER]);

  useEffect(() => {
    const fetchLetterTemplates = async () => {
      try {
        const response = await settingsService.fetchLetterTemplates();
        setLetterTemplates(response.templates);

        if (response.default_template_id !== null) {
          setUserSettings((prev) => ({
            ...prev,
            default_letter_template_id: response.default_template_id,
          }));
        }
      } catch (error) {
        console.error("Failed to fetch letter templates:", error);
      }
    };
    fetchLetterTemplates();
  }, []);

  const toggleCollapse = (section) => {
    setCollapseStates((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleSaveChanges = async () => {
    try {
      await settingsService.saveSettings({
        prompts,
        config,
        options,
        userSettings,
        toast,
      });

      // Fetch settings again after saving
      await fetchSettings();

      toast({
        title: "Settings saved and refreshed",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Error saving settings",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleRestoreDefaults = async () => {
    await settingsService.resetToDefaults(fetchSettings, toast);
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
    // Update local config state only
    setConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleClearDatabase = async (newEmbeddingModel) => {
    await settingsService.clearDatabase(newEmbeddingModel, config, toast);
    // Refresh settings after database clear
    await fetchSettings();
  };

  if (loading) {
    return <Box>Loading...</Box>;
  }
  return (
    <Box p="5" borderRadius="sm" w="100%">
      <Text as="h2" mb="4">
        Settings
      </Text>
      <VStack spacing="5" align="stretch">
        <UserSettingsPanel
          isCollapsed={collapseStates.userSettings}
          setIsCollapsed={() => toggleCollapse("userSettings")}
          userSettings={userSettings}
          setUserSettings={setUserSettings}
          specialties={SPECIALTIES}
          templates={templates}
          letterTemplates={letterTemplates}
          toast={toast}
        />

        <ModelSettingsPanel
          isCollapsed={collapseStates.modelSettings}
          setIsCollapsed={() => toggleCollapse("modelSettings")}
          config={config}
          handleConfigChange={handleConfigChange}
          modelOptions={modelOptions}
          whisperModelOptions={whisperModelOptions}
          whisperModelListAvailable={whisperModelListAvailable}
          urlStatus={urlStatus}
          onOpenLocalModelManager={localModelsDisclosure.onOpen}
          showLocalManagerButton
          modelManagerRefreshKey={modelManagerRefreshKey}
        />

        <PromptSettingsPanel
          isCollapsed={collapseStates.promptSettings}
          setIsCollapsed={() => toggleCollapse("promptSettings")}
          prompts={prompts}
          handlePromptChange={handlePromptChange}
          options={options}
          handleOptionChange={handleOptionChange}
          config={config}
        />

        <RagSettingsPanel
          isCollapsed={collapseStates.ragSettings}
          setIsCollapsed={() => toggleCollapse("ragSettings")}
          config={config}
          modelOptions={modelOptions}
          handleClearDatabase={handleClearDatabase}
          handleConfigChange={handleConfigChange}
        />

        <TemplateSettingsPanel
          isCollapsed={collapseStates.templates}
          setIsCollapsed={() => toggleCollapse("templates")}
          templates={templates}
          setTemplates={setTemplates}
        />

        <LetterTemplatesPanel
          isCollapsed={collapseStates.letterTemplates}
          setIsCollapsed={() => toggleCollapse("letterTemplates")}
        />

        <ChatSettingsPanel
          isCollapsed={collapseStates.chatSettings}
          setIsCollapsed={() => toggleCollapse("chatSettings")}
          userSettings={userSettings}
          setUserSettings={setUserSettings}
        />

        <SettingsActions
          onSave={handleSaveChanges}
          onRestoreDefaults={handleRestoreDefaults}
        />
      </VStack>

      <LocalModelManagerModal
        isOpen={localModelsDisclosure.isOpen}
        onClose={async () => {
          localModelsDisclosure.onClose();
          // Refresh model list based on provider
          if (config?.LLM_PROVIDER === "local") {
            try {
              const localModels = await localModelApi.fetchLocalModels();
              const modelNames = localModels.models.map(
                (m) => m.name || m.filename,
              );
              setModelOptions(modelNames);
            } catch (error) {
              console.error("Error loading local models:", error);
            }
          } else if (config?.LLM_BASE_URL) {
            await settingsService.fetchLLMModels(config, setModelOptions);
          }
          // Trigger refresh in ModelSettingsPanel for Whisper model
          setModelManagerRefreshKey((prev) => prev + 1);
        }}
      />
    </Box>
  );
};

export default Settings;
