import { Box, Flex, IconButton, Text, Collapsible, Input, NativeSelect, VStack, InputGroup, Tabs, HStack, Badge, Button, Alert, Spinner, Dialog, Portal } from "@chakra-ui/react";
import { useToast } from "@/utils/useToastShim";
import { Tooltip } from '@/components/ui/tooltip';
import {
    ChevronRightIcon,
    ChevronDownIcon,
    CheckCircleIcon,
} from "../common/icons";
import {
    FaCog,
    FaDesktop,
    FaCloud,
    FaDatabase,
    FaMicrophone,
    FaBrain,
    FaPuzzlePiece,
} from "react-icons/fa";
import { useState, useEffect } from "react";

import ToolsSettingsTab from "./ToolsSettingsTab";
import { ReEmbedProgress } from "../common/ReEmbedProgress";
import { universalFetch } from "../../utils/helpers/apiHelpers";
import { buildApiUrl, isTauri } from "../../utils/helpers/apiConfig";
import { isRagEnabled } from "../../utils/helpers/featureFlags";
import { chatApi } from "../../utils/api/chatApi";

const ModelSettingsPanel = ({
    isCollapsed,
    setIsCollapsed,
    config,
    handleConfigChange,
    modelOptions,
    selectedLocalModel = "",
    whisperModelOptions = [],
    whisperModelListAvailable = false,
    whisperModelsLoading = false,
    llmModelsLoading = false,
    urlStatus = { whisper: false, llm: false },
    onOpenLocalModelManager,
    showLocalManagerButton,
    modelManagerRefreshKey = 0,
    embeddingModelOptions = [],
    handleClearDatabase,
    handleReEmbed,
}) => {
    const [localStatus, setLocalStatus] = useState(null);
    const [isDocker, setIsDocker] = useState(false);
    const [downloadedWhisperModel, setDownloadedWhisperModel] = useState(null);
    const [tabIndex, setTabIndex] = useState("0");
    const [isEmbeddingModelModalOpen, setIsEmbeddingModelModalOpen] =
        useState(false);
    const [pendingEmbeddingModel, setPendingEmbeddingModel] = useState(null);
    const [isReEmbedding, setIsReEmbedding] = useState(false);
    const [reEmbedProgress, setReEmbedProgress] = useState(null);
    const [isProbingVision, setIsProbingVision] = useState(false);
    const [visionProbeDetail, setVisionProbeDetail] = useState("");
    const [visionProbeStatus, setVisionProbeStatus] = useState("info");
    const [currentVisionCapability, setCurrentVisionCapability] =
        useState(null);
    const toast = useToast();

    // Determine if we're using local inference
    const isLocalInference = config?.LLM_PROVIDER === "local";

    useEffect(() => {
        checkLocalStatus();
        checkIfDocker();
        loadCurrentVisionCapability();

        if (isTauri()) {
            fetchDownloadedWhisperModel();
        }
    }, []);

    useEffect(() => {
        loadCurrentVisionCapability();
    }, [config?.LLM_PROVIDER, config?.LLM_BASE_URL, config?.PRIMARY_MODEL]);

    useEffect(() => {
        // Refresh Whisper model when model manager closes (desktop only)
        if (isTauri() && modelManagerRefreshKey > 0) {
            fetchDownloadedWhisperModel();
        }
    }, [modelManagerRefreshKey]);

    const fetchDownloadedWhisperModel = async () => {
        try {
            const response = await universalFetch(
                await buildApiUrl(
                    "/api/config/local/whisper/models/downloaded",
                ),
            );
            if (response.ok) {
                const data = await response.json();
                // Set the downloaded model (there should only be one)
                if (data.models && data.models.length > 0) {
                    setDownloadedWhisperModel(data.models[0].id);
                }
            }
        } catch (error) {
            console.error("Error fetching downloaded Whisper model:", error);
        }
    };

    const checkLocalStatus = async () => {
        try {
            const response = await universalFetch(
                await buildApiUrl("/api/config/local/status"),
            );
            if (response.ok) {
                const data = await response.json();
                setLocalStatus(data);
            }
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

    const loadCurrentVisionCapability = async () => {
        try {
            const result = await chatApi.getCurrentVisionCapability();
            setCurrentVisionCapability(result || null);
        } catch (error) {
            console.error("Error loading current vision capability:", error);
            setCurrentVisionCapability(null);
        }
    };

    const handleInferenceTypeChange = (isLocal) => {
        if (isLocal) {
            handleConfigChange("LLM_PROVIDER", "local");
            // When switching to local, also set Whisper to local (placeholder for future implementation)
            // For now, we'll just clear the Whisper URL to indicate local usage
            handleConfigChange("WHISPER_BASE_URL", "");
            handleConfigChange("WHISPER_MODEL", "whisper-1"); // Default local model
        } else {
            handleConfigChange("LLM_PROVIDER", "openai"); // Use OpenAI-compatible provider for remote
        }
    };

    const handleEmbeddingModelChange = (value) => {
        setPendingEmbeddingModel(value);
        setIsEmbeddingModelModalOpen(true);
    };

    const handleConfirmEmbeddingChange = async () => {
        setIsReEmbedding(true);
        setReEmbedProgress({ percentage: 0 });
        try {
            await handleReEmbed(pendingEmbeddingModel, (event) => {
                if (event.type === "batch_progress" || event.type === "collection_start") {
                    setReEmbedProgress({
                        percentage: event.percentage ?? 0,
                        collection_index: event.collection_index ?? 0,
                        total_collections: event.total_collections ?? 0,
                        collection_name: event.collection_name ?? "",
                        chunks_embedded: event.chunks_embedded ?? 0,
                        total_chunks_in_collection: event.total_chunks_in_collection ?? 0,
                    });
                }
            });
            setIsEmbeddingModelModalOpen(false);
            setPendingEmbeddingModel(null);
        } catch (error) {
            console.error("Error changing embedding model:", error);
        } finally {
            setIsReEmbedding(false);
            setReEmbedProgress(null);
        }
    };

    const handleCancelEmbeddingChange = () => {
        setIsEmbeddingModelModalOpen(false);
        setPendingEmbeddingModel(null);
    };

    const handleProbeVisionCapability = async () => {
        setIsProbingVision(true);
        setVisionProbeDetail("");
        setVisionProbeStatus("info");

        try {
            const result = await chatApi.probeVisionCapability({
                model: config?.PRIMARY_MODEL || "",
                base_url: config?.LLM_BASE_URL || "",
                api_key: config?.LLM_API_KEY || "",
            });

            const capable = Boolean(result?.vision_capable);
            const detail =
                result?.detail ||
                (capable
                    ? "Vision input accepted by endpoint/model."
                    : "Vision input was not accepted by endpoint/model.");

            if (!config?.DOCUMENT_IMAGE_PROCESSING_MODE) {
                handleConfigChange("DOCUMENT_IMAGE_PROCESSING_MODE", "auto");
            }

            setVisionProbeStatus(capable ? "success" : "warning");
            setVisionProbeDetail(detail);

            // Refresh cached current capability view after probe is stored server-side
            await loadCurrentVisionCapability();

            toast({
                title: capable
                    ? "Vision capability detected"
                    : "Vision capability not detected",
                description: detail,
                status: capable ? "success" : "warning",
                duration: 4500,
                isClosable: true,
            });
        } catch (error) {
            const detail =
                error?.message || "Failed to probe visual capability.";
            setVisionProbeStatus("error");
            setVisionProbeDetail(detail);
            setCurrentVisionCapability(null);

            toast({
                title: "Vision capability probe failed",
                description: detail,
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setIsProbingVision(false);
        }
    };

    return (
        <>
            <Box className="panels-bg" p="4" borderRadius="sm">
                <Flex align="center" justify="space-between">
                    <Flex align="center">
                        <IconButton
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            aria-label="Toggle collapse"
                            variant="outline"
                            size="sm"
                            mr="2"
                            className="collapse-toggle">{isCollapsed ? (
                                <ChevronRightIcon />
                            ) : (
                                <ChevronDownIcon />
                            )}</IconButton>
                        <FaCog size="1.2em" style={{ marginRight: "5px" }} />
                        <Text as="h3">Model Settings</Text>
                    </Flex>
                </Flex>
                <Collapsible.Root open={!isCollapsed}>
                    <Collapsible.Content>
                        <VStack gap={4} align="stretch" mt={4}>
                            {/* Inference Type Selection - Desktop (Tauri) only and not in Docker */}
                            {isTauri() && !isDocker && (
                                <Box>
                                    <Tooltip content="Choose between running models locally on your machine or connecting to remote API services">
                                        <Text
                                            fontSize="md"
                                            fontWeight="bold"
                                            mb="3"
                                        >
                                            Inference Type
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
                                            <Tooltip content="Run models directly on your machine using bundled inference engines">
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
                                                    }><FaDesktop />Local
                                                                                                </Button>
                                            </Tooltip>
                                            <Tooltip content="Connect to external OpenAI/Ollama-compatible APIs">
                                                <Button
                                                    className={`mode-selector-button ${!isLocalInference ? "active" : ""}`}
                                                    onClick={() =>
                                                        handleInferenceTypeChange(
                                                            false,
                                                        )
                                                    }><FaCloud />Remote
                                                                                                </Button>
                                            </Tooltip>
                                        </Flex>
                                    </Flex>
                                </Box>
                            )}

                            {/* Inference Settings - Using tabs for organization */}
                            {isLocalInference ? (
                                <Tabs.Root
                                    variant='enclosed'
                                    value={tabIndex}
                                    onValueChange={({ value }) => setTabIndex(value)}
                                >
                                    <Tabs.List>
                                        <Tooltip content="Manage local LLM and Whisper models">
                                            <Tabs.Trigger className="tab-style" value="0">
                                                <HStack>
                                                    <FaDesktop />
                                                    <Text>Models</Text>
                                                </HStack>
                                            </Tabs.Trigger>
                                        </Tooltip>
                                        <Tooltip content="Configure external tool servers">
                                            <Tabs.Trigger className="tab-style" value="1">
                                                <HStack>
                                                    <FaPuzzlePiece />
                                                    <Text>Tools</Text>
                                                </HStack>
                                            </Tabs.Trigger>
                                        </Tooltip>
                                    </Tabs.List>
                                        {/* Models Tab */}
                                        <Tabs.Content className="floating-main" value="0">
                                            <VStack gap={4} align="stretch">
                                                <Box>
                                                    <HStack mb="2">
                                                        <FaDesktop />
                                                        <Text fontSize="md" fontWeight="bold">
                                                            Local Inference Settings
                                                        </Text>
                                                        <Badge colorPalette="green">Local</Badge>
                                                    </HStack>
                                                    <Text fontSize="sm" color="gray.600" mb="4">
                                                        Models run directly on your machine.
                                                        Both LLM and Whisper will use local
                                                        inference.
                                                    </Text>
                                                </Box>

                                                {/* Primary Model Selection for Local */}
                                                <Box>
                                                    <Tooltip content="Primary model for local inference - manage through Model Manager below">
                                                        <Text fontSize="sm" mb="2">
                                                            Primary Model (Local)
                                                        </Text>
                                                    </Tooltip>
                                                    <NativeSelect.Root>
                                                        <NativeSelect.Field
                                                            size="sm"
                                                            value={selectedLocalModel || config?.PRIMARY_MODEL || ""}
                                                            disabled={true}
                                                            placeholder="Select downloaded model"
                                                            className="input-style"
                                                            cursor="not-allowed"
                                                            opacity={0.7}>
                                                            {modelOptions.map((model) => (
                                                                <option key={model} value={model}>
                                                                    {model}
                                                                </option>
                                                            ))}
                                                        </NativeSelect.Field>
                                                        <NativeSelect.Indicator />
                                                    </NativeSelect.Root>
                                                </Box>

                                                {/* Local Whisper Model Selection */}
                                                <Box>
                                                    <Tooltip content="Whisper model for local transcription - manage through Model Manager below">
                                                        <Text fontSize="sm" mb="2">
                                                            Whisper Model (Local)
                                                        </Text>
                                                    </Tooltip>
                                                    <NativeSelect.Root>
                                                        <NativeSelect.Field
                                                            size="sm"
                                                            value={
                                                                downloadedWhisperModel ||
                                                                config?.WHISPER_MODEL ||
                                                                "base"
                                                            }
                                                            disabled={true}
                                                            className="input-style"
                                                            cursor="not-allowed"
                                                            opacity={0.7}>
                                                            <option value="tiny">
                                                                tiny (39MB) - Fastest
                                                            </option>
                                                            <option value="tiny.en">
                                                                tiny.en (39MB) - English-only
                                                            </option>
                                                            <option value="base">
                                                                base (74MB) - Multilingual
                                                            </option>
                                                            <option value="base.en">
                                                                base.en (74MB) - English-only,
                                                                Recommended
                                                            </option>
                                                            <option value="small">
                                                                small (244MB) - Better accuracy
                                                            </option>
                                                            <option value="small.en">
                                                                small.en (244MB) - English-only
                                                            </option>
                                                            <option value="medium">
                                                                medium (769MB) - High accuracy
                                                            </option>
                                                            <option value="medium.en">
                                                                medium.en (769MB) - English-only
                                                            </option>
                                                            <option value="large-v1">
                                                                large-v1 (1.5GB) - Best accuracy V1
                                                            </option>
                                                            <option value="large-v2">
                                                                large-v2 (1.5GB) - Best accuracy V2
                                                            </option>
                                                            <option value="large-v3">
                                                                large-v3 (1.5GB) - Best accuracy V3
                                                            </option>
                                                        </NativeSelect.Field>
                                                        <NativeSelect.Indicator />
                                                    </NativeSelect.Root>
                                                </Box>

                                                {/* Local Model Manager Trigger */}
                                                {showLocalManagerButton &&
                                                    typeof onOpenLocalModelManager ===
                                                        "function" && (
                                                        <Button
                                                            onClick={onOpenLocalModelManager}
                                                            variant="outline"
                                                            size="sm"
                                                            alignSelf="flex-start"
                                                            className="nav-button"
                                                        >
                                                            Manage Local Models
                                                        </Button>
                                                    )}
                                            </VStack>
                                        </Tabs.Content>

                                        {/* Tools Tab */}
                                        <Tabs.Content className="floating-main" value="1">
                                            <ToolsSettingsTab />
                                        </Tabs.Content>
                                </Tabs.Root>
                            ) : (
                                <Tabs.Root
                                    variant='enclosed'
                                    value={tabIndex}
                                    onValueChange={({ value }) => setTabIndex(value)}
                                >
                                    <Tabs.List>
                                        <Tooltip content="Configure speech-to-text service settings">
                                            <Tabs.Trigger className="tab-style" value="0">
                                                <HStack>
                                                    <FaMicrophone />
                                                    <Text>Whisper</Text>
                                                </HStack>
                                            </Tabs.Trigger>
                                        </Tooltip>
                                        <Tooltip content="Configure large language model provider settings">
                                            <Tabs.Trigger className="tab-style" value="1">
                                                <HStack>
                                                    <FaBrain />
                                                    <Text>LLM</Text>
                                                </HStack>
                                            </Tabs.Trigger>
                                        </Tooltip>
                                        {isRagEnabled() && (
                                            <Tooltip content="Configure knowledge base embedding model">
                                                <Tabs.Trigger className="tab-style" value="2">
                                                    <HStack>
                                                        <FaDatabase />
                                                        <Text>RAG</Text>
                                                    </HStack>
                                                </Tabs.Trigger>
                                            </Tooltip>
                                        )}
                                        <Tooltip content="Configure external tool servers">
                                            <Tabs.Trigger className="tab-style" value="3">
                                                <HStack>
                                                    <FaPuzzlePiece />
                                                    <Text>Tools</Text>
                                                </HStack>
                                            </Tabs.Trigger>
                                        </Tooltip>
                                    </Tabs.List>
                                        {/* Whisper Tab */}
                                        <Tabs.Content className="floating-main" value="0">
                                            <VStack gap={4} align="stretch">
                                                <Box>
                                                    <Text
                                                        fontSize="md"
                                                        fontWeight="bold"
                                                    >
                                                        Whisper (Speech-to-Text)
                                                    </Text>
                                                    <Text
                                                        fontSize="sm"
                                                        color="gray.500"
                                                    >
                                                        Configure the speech-to-text
                                                        service for transcribing
                                                        audio recordings
                                                    </Text>
                                                </Box>

                                                <VStack gap={3} align="stretch">
                                                    <Box>
                                                        <Tooltip content="Base URL for the Whisper API (e.g., https://api.openai.com)">
                                                            <Text
                                                                fontSize="sm"
                                                                mb="1"
                                                                fontWeight={"bold"}
                                                            >
                                                                API Base URL
                                                            </Text>
                                                        </Tooltip>
                                                        <InputGroup size="sm" endElement={urlStatus.whisper ? (
                                                            <Tooltip content="Connection successful">
                                                                <CheckCircleIcon color="green.500" />
                                                            </Tooltip>
                                                        ) : undefined}>
                                                            <Input
                                                                value={
                                                                    config?.WHISPER_BASE_URL ||
                                                                    ""
                                                                }
                                                                onChange={(e) =>
                                                                    handleConfigChange(
                                                                        "WHISPER_BASE_URL",
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                placeholder="https://api.openai.com"
                                                                className="input-style"
                                                            />
                                                        </InputGroup>
                                                    </Box>

                                                    <Box>
                                                        <Tooltip content="Model to use for Whisper transcription (e.g., whisper-1)">
                                                            <Text
                                                                fontSize="sm"
                                                                mb="1"
                                                                fontWeight={"bold"}
                                                            >
                                                                Model
                                                            </Text>
                                                        </Tooltip>

                                                        {whisperModelsLoading ? (
                                                            <HStack gap="2">
                                                                <Spinner size="sm" />
                                                                <Text fontSize="sm" color="gray.500">
                                                                    Loading models...
                                                                </Text>
                                                            </HStack>
                                                        ) : whisperModelListAvailable &&
                                                        whisperModelOptions.length >
                                                            0 ? (
                                                            <NativeSelect.Root>
                                                                <NativeSelect.Field
                                                                    size="sm"
                                                                    value={
                                                                        config?.WHISPER_MODEL ||
                                                                        ""
                                                                    }
                                                                    onChange={(e) =>
                                                                        handleConfigChange(
                                                                            "WHISPER_MODEL",
                                                                            e.target
                                                                                .value,
                                                                        )
                                                                    }
                                                                    placeholder="Select Whisper model"
                                                                    className="input-style">
                                                                    {whisperModelOptions.map(
                                                                        (model) => (
                                                                            <option
                                                                                key={
                                                                                    model
                                                                                }
                                                                                value={
                                                                                    model
                                                                                }
                                                                            >
                                                                                {model}
                                                                            </option>
                                                                        ),
                                                                    )}
                                                                </NativeSelect.Field>
                                                                <NativeSelect.Indicator />
                                                            </NativeSelect.Root>
                                                        ) : (
                                                            <Input
                                                                size="sm"
                                                                placeholder="Enter model name (e.g., whisper-1)"
                                                                value={
                                                                    config?.WHISPER_MODEL ||
                                                                    ""
                                                                }
                                                                onChange={(e) =>
                                                                    handleConfigChange(
                                                                        "WHISPER_MODEL",
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                className="input-style"
                                                            />
                                                        )}
                                                    </Box>

                                                    <Box>
                                                        <Tooltip content="API key for authenticating with the Whisper service">
                                                            <Text
                                                                fontSize="sm"
                                                                mb="1"
                                                                fontWeight={"bold"}
                                                            >
                                                                API Key
                                                            </Text>
                                                        </Tooltip>
                                                        <Input
                                                            size="sm"
                                                            type="password"
                                                            value={
                                                                config?.WHISPER_KEY ||
                                                                ""
                                                            }
                                                            onChange={(e) =>
                                                                handleConfigChange(
                                                                    "WHISPER_KEY",
                                                                    e.target.value,
                                                                )
                                                            }
                                                            placeholder="sk-..."
                                                            className="input-style"
                                                        />
                                                    </Box>
                                                </VStack>
                                            </VStack>
                                        </Tabs.Content>

                                        {/* LLM Tab */}
                                        <Tabs.Content className="floating-main" value="1">
                                            <VStack gap={4} align="stretch">
                                                <Box>
                                                    <Text
                                                        fontSize="md"
                                                        fontWeight="bold"
                                                    >
                                                        Large Language Model (LLM)
                                                    </Text>
                                                    <Text
                                                        fontSize="sm"
                                                        color="gray.500"
                                                    >
                                                        Configure the language model
                                                        provider for generating
                                                        responses
                                                    </Text>
                                                </Box>

                                                <VStack gap={3} align="stretch">
                                                    <Box>
                                                        <Tooltip content="Base URL for your OpenAI/Ollama-compatible LLM API endpoint">
                                                            <Text
                                                                fontSize="sm"
                                                                mb="1"
                                                                fontWeight={"bold"}
                                                            >
                                                                OpenAI/Ollama API
                                                                Base URL
                                                            </Text>
                                                        </Tooltip>
                                                        <InputGroup size="sm" endElement={urlStatus.llm ? (
                                                            <Tooltip content="Connection successful">
                                                                <CheckCircleIcon color="green.500" />
                                                            </Tooltip>
                                                        ) : undefined}>
                                                            <Input
                                                                value={
                                                                    config?.LLM_BASE_URL ||
                                                                    ""
                                                                }
                                                                onChange={(e) =>
                                                                    handleConfigChange(
                                                                        "LLM_BASE_URL",
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                placeholder={
                                                                    "http://localhost:11434"
                                                                }
                                                                className="input-style"
                                                            />
                                                        </InputGroup>
                                                    </Box>

                                                    <Box>
                                                        <Tooltip content="API key for authenticating with the OpenAI/Ollama-compatible service">
                                                            <Text
                                                                fontSize="sm"
                                                                mb="1"
                                                                fontWeight={"bold"}
                                                            >
                                                                API Key
                                                            </Text>
                                                        </Tooltip>
                                                        <Input
                                                            size="sm"
                                                            type="password"
                                                            value={
                                                                config?.LLM_API_KEY ||
                                                                ""
                                                            }
                                                            onChange={(e) =>
                                                                handleConfigChange(
                                                                    "LLM_API_KEY",
                                                                    e.target.value,
                                                                )
                                                            }
                                                            placeholder="sk-..."
                                                            className="input-style"
                                                        />
                                                    </Box>

                                                    <Box>
                                                        <Tooltip content="Primary model for generating responses and clinical notes">
                                                            <Text
                                                                fontSize="sm"
                                                                mb="1"
                                                                fontWeight={"bold"}
                                                            >
                                                                Primary Model
                                                            </Text>
                                                        </Tooltip>
                                                        {llmModelsLoading ? (
                                                            <HStack gap="2">
                                                                <Spinner size="sm" />
                                                                <Text fontSize="sm" color="gray.500">
                                                                    Loading models...
                                                                </Text>
                                                            </HStack>
                                                        ) : (
                                                        <NativeSelect.Root>
                                                            <NativeSelect.Field
                                                                size="sm"
                                                                value={
                                                                    config?.PRIMARY_MODEL ||
                                                                    ""
                                                                }
                                                                onChange={(e) =>
                                                                    handleConfigChange(
                                                                        "PRIMARY_MODEL",
                                                                        e.target.value,
                                                                    )
                                                                }
                                                                placeholder="Select model"
                                                                className="input-style">
                                                                {modelOptions.map(
                                                                    (model) => (
                                                                        <option
                                                                            key={model}
                                                                            value={
                                                                                model
                                                                            }
                                                                        >
                                                                            {model}
                                                                        </option>
                                                                    ),
                                                                )}
                                                            </NativeSelect.Field>
                                                            <NativeSelect.Indicator />
                                                        </NativeSelect.Root>
                                                        )}
                                                    </Box>

                                                    <Box>
                                                        <Tooltip content="Secondary model for tasks requiring different capabilities or for comparison">
                                                            <Text
                                                                fontSize="sm"
                                                                mb="1"
                                                                fontWeight={"bold"}
                                                            >
                                                                Secondary Model
                                                            </Text>
                                                        </Tooltip>
                                                        {llmModelsLoading ? (
                                                            <HStack gap="2">
                                                                <Spinner size="sm" />
                                                                <Text fontSize="sm" color="gray.500">
                                                                    Loading models...
                                                                </Text>
                                                            </HStack>
                                                        ) : (
                                                        <NativeSelect.Root>
                                                            <NativeSelect.Field
                                                                size="sm"
                                                                value={
                                                                    config?.SECONDARY_MODEL ||
                                                                    ""
                                                                }
                                                                onChange={(e) =>
                                                                    handleConfigChange(
                                                                        "SECONDARY_MODEL",
                                                                        e.target.value,
                                                                    )
                                                                }
                                                                placeholder="Select model"
                                                                className="input-style">
                                                                {modelOptions.map(
                                                                    (model) => (
                                                                        <option
                                                                            key={model}
                                                                            value={
                                                                                model
                                                                            }
                                                                        >
                                                                            {model}
                                                                        </option>
                                                                    ),
                                                                )}
                                                            </NativeSelect.Field>
                                                            <NativeSelect.Indicator />
                                                        </NativeSelect.Root>
                                                        )}
                                                    </Box>

                                                    <Box>
                                                        <Tooltip content="Choose how PDFs/images are handled: visual LLM, OCR fallback, or automatic selection">
                                                            <Text
                                                                fontSize="sm"
                                                                mb="1"
                                                                fontWeight={"bold"}
                                                            >
                                                                Document/Image
                                                                Processing Mode
                                                            </Text>
                                                        </Tooltip>
                                                        <NativeSelect.Root>
                                                            <NativeSelect.Field
                                                                size="sm"
                                                                value={
                                                                    config?.DOCUMENT_IMAGE_PROCESSING_MODE ||
                                                                    "auto"
                                                                }
                                                                onChange={(e) =>
                                                                    handleConfigChange(
                                                                        "DOCUMENT_IMAGE_PROCESSING_MODE",
                                                                        e.target.value,
                                                                    )
                                                                }
                                                                className="input-style">
                                                                <option value="auto">
                                                                    Auto (prefer visual
                                                                    if available)
                                                                </option>
                                                                <option value="vision">
                                                                    Vision only
                                                                </option>
                                                                <option value="ocr">
                                                                    OCR only
                                                                </option>
                                                            </NativeSelect.Field>
                                                            <NativeSelect.Indicator />
                                                        </NativeSelect.Root>
                                                        <Text
                                                            fontSize="xs"
                                                            color="gray.500"
                                                            mt="1"
                                                        >
                                                            Auto uses visual
                                                            processing when vision
                                                            capability is detected;
                                                            otherwise it falls back
                                                            to OCR-compatible
                                                            endpoints.
                                                        </Text>
                                                    </Box>

                                                    <Box>
                                                        <Tooltip content="Send a tiny test image to check whether the selected endpoint/model accepts image inputs">
                                                            <Text
                                                                fontSize="sm"
                                                                mb="1"
                                                                fontWeight={"bold"}
                                                            >
                                                                Vision Capability
                                                                Probe
                                                            </Text>
                                                        </Tooltip>

                                                        <HStack gap={3} mb={2}>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={
                                                                    handleProbeVisionCapability
                                                                }
                                                                loading={
                                                                    isProbingVision
                                                                }
                                                            >
                                                                Test Vision Support
                                                            </Button>
                                                            <Badge
                                                                colorPalette={
                                                                    currentVisionCapability?.vision_capable
                                                                        ? "green"
                                                                        : currentVisionCapability
                                                                          ? "red"
                                                                          : "gray"
                                                                }
                                                            >
                                                                {currentVisionCapability
                                                                    ? currentVisionCapability.vision_capable
                                                                        ? "Vision capable"
                                                                        : "Not vision-capable"
                                                                    : "Unknown"}
                                                            </Badge>
                                                        </HStack>
                                                        {currentVisionCapability ? (
                                                            <Text
                                                                fontSize="xs"
                                                                color="gray.500"
                                                                mb={2}
                                                            >
                                                                Source:{" "}
                                                                {currentVisionCapability.source ||
                                                                    "cache"}
                                                                {currentVisionCapability.probed_at
                                                                    ? ` • Probed: ${currentVisionCapability.probed_at}`
                                                                    : ""}
                                                            </Text>
                                                        ) : null}

                                                        {visionProbeDetail ? (
                                                            <Alert.Root
                                                                status={
                                                                    visionProbeStatus
                                                                }
                                                                borderRadius="sm"
                                                                py={2}
                                                            >
                                                                <Alert.Indicator />
                                                                <Text
                                                                    fontSize="xs"
                                                                    whiteSpace="pre-wrap"
                                                                >
                                                                    {
                                                                        visionProbeDetail
                                                                    }
                                                                </Text>
                                                            </Alert.Root>
                                                        ) : null}
                                                    </Box>
                                                </VStack>
                                            </VStack>
                                        </Tabs.Content>

                                        {/* RAG Tab */}
                                        {isRagEnabled() && (
                                            <Tabs.Content className="floating-main" value="2">
                                                <VStack gap={4} align="stretch">
                                                    <Box>
                                                        <Text
                                                            fontSize="md"
                                                            fontWeight="bold"
                                                        >
                                                            Knowledge Base (RAG)
                                                        </Text>
                                                        <Text
                                                            fontSize="sm"
                                                            color="gray.500"
                                                        >
                                                            Configure the embedding
                                                            model used for knowledge
                                                            base searches
                                                        </Text>
                                                    </Box>

                                                    <Box>
                                                        <Tooltip content="Model used for generating embeddings for RAG - changing this will re-embed all documents">
                                                            <Text
                                                                fontSize="sm"
                                                                mb="2"
                                                                fontWeight={"bold"}
                                                            >
                                                                Embedding Model
                                                            </Text>
                                                        </Tooltip>
                                                        {llmModelsLoading ? (
                                                            <HStack gap="2">
                                                                <Spinner size="sm" />
                                                                <Text fontSize="sm" color="gray.500">
                                                                    Loading models...
                                                                </Text>
                                                            </HStack>
                                                        ) : (
                                                        <NativeSelect.Root>
                                                            <NativeSelect.Field
                                                                size="sm"
                                                                value={
                                                                    config?.EMBEDDING_MODEL ||
                                                                    ""
                                                                }
                                                                onChange={(e) =>
                                                                    handleEmbeddingModelChange(
                                                                        e.target.value,
                                                                    )
                                                                }
                                                                placeholder="Select embedding model"
                                                                className="input-style">
                                                                {embeddingModelOptions.map(
                                                                    (model) => (
                                                                        <option
                                                                            key={model}
                                                                            value={
                                                                                model
                                                                            }
                                                                        >
                                                                            {model}
                                                                        </option>
                                                                    ),
                                                                )}
                                                            </NativeSelect.Field>
                                                            <NativeSelect.Indicator />
                                                        </NativeSelect.Root>
                                                        )}
                                                        <Text
                                                            fontSize="xs"
                                                            color="gray.500"
                                                            mt="1"
                                                        >
                                                            Available embedding
                                                            models depend on the LLM
                                                            endpoint configured in
                                                            the LLM tab
                                                        </Text>
                                                        <Text
                                                            fontSize="xs"
                                                            color="secondaryButton"
                                                            mt="2"
                                                            fontWeight="medium"
                                                        >
                                                            ⚠️ Changing the embedding
                                                            model will re-embed all
                                                            documents automatically
                                                        </Text>
                                                    </Box>
                                                </VStack>
                                            </Tabs.Content>
                                        )}

                                        {/* Tools Tab */}
                                        <Tabs.Content className="floating-main" value="3">
                                            <ToolsSettingsTab />
                                        </Tabs.Content>
                                </Tabs.Root>
                            )}
                        </VStack>
                    </Collapsible.Content>
                </Collapsible.Root>
            </Box>
            {/* Warning Modal for RAG Embedding Model Change */}
            <Dialog.Root
                open={isEmbeddingModelModalOpen}
                closeOnInteractOutside={!isReEmbedding}
                closeOnEscape={!isReEmbedding}
                size='md'
                onOpenChange={e => {
                    if (!e.open) {
                        (isReEmbedding ? undefined : handleCancelEmbeddingChange)();
                    }
                }}
            >
                <Portal>

                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content className="modal-style">
                            <Dialog.Header>Re-embed Documents</Dialog.Header>
                            <Dialog.Body>
                                {isReEmbedding ? (
                                    <VStack gap={4} align="stretch">
                                        <Text>
                                            Re-embedding documents with the new model…
                                        </Text>
                                        <ReEmbedProgress progress={reEmbedProgress} />
                                    </VStack>
                                ) : (
                                    <>
                                        <Text>
                                            Changing the embedding model will re-embed all
                                            existing document collections with the new model.
                                            Your documents and collections will be preserved.
                                        </Text>
                                        <Text mt={4} fontWeight="bold">
                                            Are you sure you want to proceed?
                                        </Text>
                                    </>
                                )}
                            </Dialog.Body>
                            {!isReEmbedding && (
                                <Dialog.Footer>
                                    <Button
                                        className="red-button"
                                        mr={3}
                                        onClick={handleCancelEmbeddingChange}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="green-button"
                                        onClick={handleConfirmEmbeddingChange}
                                    >
                                        Confirm Change
                                    </Button>
                                </Dialog.Footer>
                            )}
                        </Dialog.Content>
                    </Dialog.Positioner>

                </Portal>
            </Dialog.Root>
        </>
    );
};

export default ModelSettingsPanel;
