import { Box, Flex, IconButton, Text, Collapsible, VStack, Tabs, HStack, Button, Switch } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import AnimatedChevron from "../common/icons/AnimatedChevron";
import {
    FaCog,
    FaDesktop,
    FaCloud,
    FaMicrophone,
    FaBrain,
    FaDatabase,
    FaPuzzlePiece,
    FaShieldAlt,
    FaUsers,
    FaComments,
    FaFileAlt,
} from "react-icons/fa";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import ToolsSettingsTab from "./ToolsSettingsTab";
import LocalModelManager from "./LocalModelManager";
import WhisperTab from "./WhisperTab";
import PromptEditorTab from "./PromptEditorTab";
import LlmTab from "./LlmTab";
import RagTab from "./RagTab";
import UsersTab from "./UsersTab";
import { localModelApi } from "../../utils/api/localModelApi";
import { buildApiUrl, isTauri } from "../../utils/helpers/apiConfig";
import { universalFetch } from "../../utils/helpers/apiHelpers";
import { isRagEnabled } from "../../utils/helpers/featureFlags";

const PolicyTab = ({ config, handleConfigChange }) => {
    const { t } = useTranslation();
    return (
    <VStack gap={3} align="stretch">
        <Flex justify="space-between" align="center">
            <Box>
                <Text fontSize="sm" fontWeight="medium">
                    {t("settings.policy.storeOriginalPdfs")}
                </Text>
                <Text fontSize="xs" className="pill-box-icons">
                    {t("settings.policy.storeOriginalPdfsDescription")}
                </Text>
            </Box>
            <Switch.Root
                size="sm"
                checked={!!config?.STORE_ORIGINAL_PDFS}
                onCheckedChange={({ checked }) =>
                    handleConfigChange("STORE_ORIGINAL_PDFS", checked)
                }
            >
                <Switch.HiddenInput />
                <Switch.Control>
                    <Switch.Thumb />
                </Switch.Control>
            </Switch.Root>
        </Flex>
        <Flex justify="space-between" align="center">
            <Box>
                <Text fontSize="sm" fontWeight="medium">
                    {t("settings.policy.requireScribeConsent")}
                </Text>
                <Text fontSize="xs" className="pill-box-icons">
                    {t("settings.policy.requireScribeConsentDescription")}
                </Text>
            </Box>
            <Switch.Root
                size="sm"
                checked={!!config?.REQUIRE_SCRIBE_CONSENT}
                onCheckedChange={({ checked }) =>
                    handleConfigChange("REQUIRE_SCRIBE_CONSENT", checked)
                }
            >
                <Switch.HiddenInput />
                <Switch.Control>
                    <Switch.Thumb />
                </Switch.Control>
            </Switch.Root>
        </Flex>
    </VStack>
    );
};

const AdminSettingsPanel = ({
    isCollapsed,
    setIsCollapsed,
    config,
    handleConfigChange,
    modelOptions,
    whisperModelOptions = [],
    whisperModelListAvailable = false,
    whisperModelsLoading = false,
    llmModelsLoading = false,
    urlStatus = { whisper: false, llm: false },
    embeddingModelOptions = [],
    handleReEmbed,
    prompts,
    handlePromptChange,
    handlePromptReset,
    letterTemperature,
    onLetterTemperatureChange,
    onOptionsReset,
}) => {
    const { t } = useTranslation();
    const [localStatus, setLocalStatus] = useState(null);
    const [isDocker, setIsDocker] = useState(false);

    // Determine if we're using local inference
    const isLocalInference = config?.LLM_PROVIDER === "local";

    const checkLocalStatus = async () => {
        try {
            const data = await localModelApi.checkLocalStatus();
            setLocalStatus(data);
        } catch (error) {
            console.error("Error checking local status:", error);
            setLocalStatus({
                available: false,
                reason: "Failed to check status",
            });
        }
    };

    const checkIfDocker = async () => {
        try {
            const response = await universalFetch(
                await buildApiUrl("/api/config/local/status"),
            );

            if (response.ok) {
                const data = await response.json();
                // Prefer explicit backend signal
                if (typeof data.is_docker === "boolean") {
                    setIsDocker(data.is_docker);
                } else {
                    // Fallback for older backend responses
                    setIsDocker(
                        !data.available && data.reason?.includes("Docker"),
                    );
                }
                return;
            }

            // Backward compatibility for older backend behavior
            if (response.status === 400) {
                const data = await response.json();
                if (data.detail?.includes("Tauri builds")) {
                    setIsDocker(true);
                }
            }
        } catch (error) {
            console.error("Error checking Docker status:", error);
        }
    };

    useEffect(() => {
        checkLocalStatus();
        checkIfDocker();
    }, []);

    const handleInferenceTypeChange = (isLocal) => {
        if (isLocal) {
            handleConfigChange("LLM_PROVIDER", "local");
            handleConfigChange("WHISPER_BASE_URL", "");
            handleConfigChange("WHISPER_MODEL", "whisper-1");
        } else {
            handleConfigChange("LLM_PROVIDER", "openai");
        }
    };

    return (
        <Box className="panels-bg" p="4" borderRadius="sm">
            <Flex align="center" justify="space-between">
                <Flex align="center">
                    <IconButton
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        aria-label={t("settings.toggleCollapse")}
                        variant="outline"
                        size="sm"
                        mr="2"
                        className="collapse-toggle"
                    >
                        <AnimatedChevron isOpen={!isCollapsed} />
                    </IconButton>
                    <FaCog size="1.2em" style={{ marginRight: "5px" }} />
                    <Text as="h3">{t("settings.admin.title")}</Text>
                </Flex>
            </Flex>
            <Collapsible.Root open={!isCollapsed}>
                <Collapsible.Content>
                    <VStack gap={4} align="stretch" mt={4}>
                        {/* Inference Type Selection - Desktop (Tauri) only and not in Docker */}
                        {isTauri() && !isDocker && (
                            <Box>
                                <Tooltip content={t("settings.admin.inferenceTypeTooltip")}>
                                    <Text
                                        fontSize="md"
                                        fontWeight="bold"
                                        mb="3"
                                    >
                                        {t("settings.admin.inferenceType")}
                                    </Text>
                                </Tooltip>
                                <Flex
                                    className="mode-selector"
                                    alignItems="center"
                                    p={1}
                                    width="100%"
                                >
                                    <Box
                                        className="mode-selector-indicator"
                                        left={
                                            isLocalInference
                                                ? "2px"
                                                : "calc(50% - 2px)"
                                        }
                                    />
                                    <Flex
                                        width="full"
                                        position="relative"
                                        zIndex={1}
                                    >
                                        <Tooltip content={t("settings.admin.localTooltip")}>
                                            <Button
                                                className={`mode-selector-button ${isLocalInference ? "active" : ""}`}
                                                onClick={() =>
                                                    handleInferenceTypeChange(
                                                        true,
                                                    )
                                                }
                                                disabled={
                                                    !isTauri() &&
                                                    !localStatus?.available
                                                }
                                            >
                                                <FaDesktop />
                                                {t("settings.admin.local")}
                                            </Button>
                                        </Tooltip>
                                        <Tooltip content={t("settings.admin.remoteTooltip")}>
                                            <Button
                                                className={`mode-selector-button ${!isLocalInference ? "active" : ""}`}
                                                onClick={() =>
                                                    handleInferenceTypeChange(
                                                        false,
                                                    )
                                                }
                                            >
                                                <FaCloud />
                                                {t("settings.admin.remote")}
                                            </Button>
                                        </Tooltip>
                                    </Flex>
                                </Flex>
                            </Box>
                        )}

                        {isLocalInference ? (
                            <Tabs.Root
                                variant="enclosed"
                                defaultValue="0"
                            >
                                <Tabs.List>
                                    <Tooltip content={t("settings.admin.tabModelsTooltip")}>
                                        <Tabs.Trigger
                                            className="tab-style"
                                            value="0"
                                        >
                                            <HStack>
                                                <FaDesktop />
                                                <Text>{t("settings.admin.tabModels")}</Text>
                                            </HStack>
                                        </Tabs.Trigger>
                                    </Tooltip>
                                    <Tooltip content={t("settings.prompt.chatSubtitle")}>
                                        <Tabs.Trigger
                                            className="tab-style"
                                            value="chat"
                                        >
                                            <HStack>
                                                <FaComments />
                                                <Text>{t("settings.admin.tabChat")}</Text>
                                            </HStack>
                                        </Tabs.Trigger>
                                    </Tooltip>
                                    <Tooltip content={t("settings.prompt.summarySubtitle")}>
                                        <Tabs.Trigger
                                            className="tab-style"
                                            value="summary"
                                        >
                                            <HStack>
                                                <FaFileAlt />
                                                <Text>{t("settings.admin.tabSummary")}</Text>
                                            </HStack>
                                        </Tabs.Trigger>
                                    </Tooltip>
                                    <Tooltip content={t("settings.admin.tabToolsTooltip")}>
                                        <Tabs.Trigger
                                            className="tab-style"
                                            value="1"
                                        >
                                            <HStack>
                                                <FaPuzzlePiece />
                                                <Text>{t("settings.admin.tabTools")}</Text>
                                            </HStack>
                                        </Tabs.Trigger>
                                    </Tooltip>
                                    <Tooltip content={t("settings.admin.tabPolicyTooltip")}>
                                        <Tabs.Trigger
                                            className="tab-style"
                                            value="2"
                                        >
                                            <HStack>
                                                <FaShieldAlt />
                                                <Text>{t("settings.admin.tabPolicy")}</Text>
                                            </HStack>
                                        </Tabs.Trigger>
                                    </Tooltip>
                                    {!isTauri() && (
                                        <Tooltip content={t("settings.admin.tabUsersTooltip")}>
                                            <Tabs.Trigger
                                                className="tab-style"
                                                value="3"
                                            >
                                                <HStack>
                                                    <FaUsers />
                                                    <Text>{t("settings.admin.tabUsers")}</Text>
                                                </HStack>
                                            </Tabs.Trigger>
                                        </Tooltip>
                                    )}
                                </Tabs.List>
                                <Tabs.Content
                                    className="floating-main"
                                    value="0"
                                >
                                    <LocalModelManager />
                                </Tabs.Content>
                                <Tabs.Content
                                    className="floating-main"
                                    value="chat"
                                >
                                    <PromptEditorTab
                                        title={t("settings.prompt.chatTitle")}
                                        subtitle={t("settings.prompt.chatSubtitle")}
                                        value={prompts?.chat?.system}
                                        onChange={(value) =>
                                            handlePromptChange(
                                                "chat",
                                                "system",
                                                value,
                                            )
                                        }
                                        onReset={() =>
                                            handlePromptReset &&
                                            handlePromptReset("chat")
                                        }
                                    />
                                </Tabs.Content>
                                <Tabs.Content
                                    className="floating-main"
                                    value="summary"
                                >
                                    <PromptEditorTab
                                        title={t("settings.prompt.summaryTitle")}
                                        subtitle={t("settings.prompt.summarySubtitle")}
                                        value={prompts?.summary?.system}
                                        onChange={(value) =>
                                            handlePromptChange(
                                                "summary",
                                                "system",
                                                value,
                                            )
                                        }
                                        onReset={() =>
                                            handlePromptReset &&
                                            handlePromptReset("summary")
                                        }
                                    />
                                </Tabs.Content>
                                <Tabs.Content
                                    className="floating-main"
                                    value="1"
                                >
                                    <ToolsSettingsTab />
                                </Tabs.Content>
                                <Tabs.Content
                                    className="floating-main"
                                    value="2"
                                >
                                    <PolicyTab
                                        config={config}
                                        handleConfigChange={handleConfigChange}
                                    />
                                </Tabs.Content>
                                {!isTauri() && (
                                    <Tabs.Content
                                        className="floating-main"
                                        value="3"
                                    >
                                        <UsersTab />
                                    </Tabs.Content>
                                )}
                            </Tabs.Root>
                        ) : (
                            <Tabs.Root
                                variant="enclosed"
                                defaultValue="0"
                            >
                                <Tabs.List>
                                    <Tooltip content={t("settings.admin.tabWhisperTooltip")}>
                                        <Tabs.Trigger
                                            className="tab-style"
                                            value="0"
                                        >
                                            <HStack>
                                                <FaMicrophone />
                                                <Text>{t("settings.admin.tabWhisper")}</Text>
                                            </HStack>
                                        </Tabs.Trigger>
                                    </Tooltip>
                                    <Tooltip content={t("settings.admin.tabLlmTooltip")}>
                                        <Tabs.Trigger
                                            className="tab-style"
                                            value="1"
                                        >
                                            <HStack>
                                                <FaBrain />
                                                <Text>{t("settings.admin.tabLlm")}</Text>
                                            </HStack>
                                        </Tabs.Trigger>
                                    </Tooltip>
                                    <Tooltip content={t("settings.prompt.chatSubtitle")}>
                                        <Tabs.Trigger
                                            className="tab-style"
                                            value="chat"
                                        >
                                            <HStack>
                                                <FaComments />
                                                <Text>{t("settings.admin.tabChat")}</Text>
                                            </HStack>
                                        </Tabs.Trigger>
                                    </Tooltip>
                                    <Tooltip content={t("settings.prompt.summarySubtitle")}>
                                        <Tabs.Trigger
                                            className="tab-style"
                                            value="summary"
                                        >
                                            <HStack>
                                                <FaFileAlt />
                                                <Text>{t("settings.admin.tabSummary")}</Text>
                                            </HStack>
                                        </Tabs.Trigger>
                                    </Tooltip>
                                    {isRagEnabled() && (
                                        <Tooltip content={t("settings.admin.tabRagTooltip")}>
                                            <Tabs.Trigger
                                                className="tab-style"
                                                value="2"
                                            >
                                                <HStack>
                                                    <FaDatabase />
                                                    <Text>{t("settings.admin.tabRag")}</Text>
                                                </HStack>
                                            </Tabs.Trigger>
                                        </Tooltip>
                                    )}
                                    <Tooltip content={t("settings.admin.tabToolsTooltip")}>
                                        <Tabs.Trigger
                                            className="tab-style"
                                            value="3"
                                        >
                                            <HStack>
                                                <FaPuzzlePiece />
                                                <Text>{t("settings.admin.tabTools")}</Text>
                                            </HStack>
                                        </Tabs.Trigger>
                                    </Tooltip>
                                    <Tooltip content={t("settings.admin.tabPolicyTooltip")}>
                                        <Tabs.Trigger
                                            className="tab-style"
                                            value="4"
                                        >
                                            <HStack>
                                                <FaShieldAlt />
                                                <Text>{t("settings.admin.tabPolicy")}</Text>
                                            </HStack>
                                        </Tabs.Trigger>
                                    </Tooltip>
                                    {!isTauri() && (
                                        <Tooltip content={t("settings.admin.tabUsersTooltip")}>
                                            <Tabs.Trigger
                                                className="tab-style"
                                                value="5"
                                            >
                                                <HStack>
                                                    <FaUsers />
                                                    <Text>{t("settings.admin.tabUsers")}</Text>
                                                </HStack>
                                            </Tabs.Trigger>
                                        </Tooltip>
                                    )}
                                </Tabs.List>
                                <Tabs.Content
                                    className="floating-main"
                                    value="0"
                                >
                                    <WhisperTab
                                        config={config}
                                        handleConfigChange={handleConfigChange}
                                        whisperModelOptions={
                                            whisperModelOptions
                                        }
                                        whisperModelListAvailable={
                                            whisperModelListAvailable
                                        }
                                        whisperModelsLoading={
                                            whisperModelsLoading
                                        }
                                        urlStatus={urlStatus}
                                    />
                                </Tabs.Content>
                                <Tabs.Content
                                    className="floating-main"
                                    value="1"
                                >
                                    <LlmTab
                                        config={config}
                                        handleConfigChange={handleConfigChange}
                                        modelOptions={modelOptions}
                                        llmModelsLoading={llmModelsLoading}
                                        urlStatus={urlStatus}
                                        letterTemperature={letterTemperature}
                                        onLetterTemperatureChange={
                                            onLetterTemperatureChange
                                        }
                                        onOptionsReset={onOptionsReset}
                                    />
                                </Tabs.Content>
                                <Tabs.Content
                                    className="floating-main"
                                    value="chat"
                                >
                                    <PromptEditorTab
                                        title={t("settings.prompt.chatTitle")}
                                        subtitle={t("settings.prompt.chatSubtitle")}
                                        value={prompts?.chat?.system}
                                        onChange={(value) =>
                                            handlePromptChange(
                                                "chat",
                                                "system",
                                                value,
                                            )
                                        }
                                        onReset={() =>
                                            handlePromptReset &&
                                            handlePromptReset("chat")
                                        }
                                    />
                                </Tabs.Content>
                                <Tabs.Content
                                    className="floating-main"
                                    value="summary"
                                >
                                    <PromptEditorTab
                                        title={t("settings.prompt.summaryTitle")}
                                        subtitle={t("settings.prompt.summarySubtitle")}
                                        value={prompts?.summary?.system}
                                        onChange={(value) =>
                                            handlePromptChange(
                                                "summary",
                                                "system",
                                                value,
                                            )
                                        }
                                        onReset={() =>
                                            handlePromptReset &&
                                            handlePromptReset("summary")
                                        }
                                    />
                                </Tabs.Content>
                                {isRagEnabled() && (
                                    <Tabs.Content
                                        className="floating-main"
                                        value="2"
                                    >
                                        <RagTab
                                            config={config}
                                            embeddingModelOptions={
                                                embeddingModelOptions
                                            }
                                            llmModelsLoading={llmModelsLoading}
                                            handleReEmbed={handleReEmbed}
                                        />
                                    </Tabs.Content>
                                )}
                                <Tabs.Content
                                    className="floating-main"
                                    value="3"
                                >
                                    <ToolsSettingsTab />
                                </Tabs.Content>
                                <Tabs.Content
                                    className="floating-main"
                                    value="4"
                                >
                                    <PolicyTab
                                        config={config}
                                        handleConfigChange={handleConfigChange}
                                    />
                                </Tabs.Content>
                                {!isTauri() && (
                                    <Tabs.Content
                                        className="floating-main"
                                        value="5"
                                    >
                                        <UsersTab />
                                    </Tabs.Content>
                                )}
                            </Tabs.Root>
                        )}
                    </VStack>
                </Collapsible.Content>
            </Collapsible.Root>
        </Box>
    );
};

export default AdminSettingsPanel;
