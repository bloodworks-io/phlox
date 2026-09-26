import {
    Box,
    Text,
    InputGroup,
    Input,
    NativeSelect,
    VStack,
    HStack,
    Badge,
    Button,
    Alert,
    Spinner,
    NumberInput,
} from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { Tooltip } from "@/components/ui/tooltip";
import { CheckCircleIcon } from "../common/icons";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { chatApi } from "../../utils/api/chatApi";
import { FiRefreshCw } from "react-icons/fi";

const LlmTab = ({
    config,
    handleConfigChange,
    modelOptions,
    llmModelsLoading = false,
    urlStatus = { llm: false },
    letterTemperature,
    onLetterTemperatureChange,
    onOptionsReset,
}) => {
    const { t } = useTranslation();
    const [isProbingVision, setIsProbingVision] = useState(false);
    const [visionProbeDetail, setVisionProbeDetail] = useState("");
    const [visionProbeStatus, setVisionProbeStatus] = useState("info");
    const [currentVisionCapability, setCurrentVisionCapability] =
        useState(null);

    const loadCurrentVisionCapability = async () => {
        try {
            const result = await chatApi.getCurrentVisionCapability();
            setCurrentVisionCapability(result || null);
        } catch (error) {
            console.error("Error loading current vision capability:", error);
            setCurrentVisionCapability(null);
        }
    };

    useEffect(() => {
        loadCurrentVisionCapability();
    }, [config?.LLM_PROVIDER, config?.LLM_BASE_URL, config?.PRIMARY_MODEL]);

    const handleProbeVisionCapability = async () => {
        setIsProbingVision(true);
        setVisionProbeDetail("");
        setVisionProbeStatus("info");

        try {
            const result = await chatApi.probeVisionCapability({
                model: config?.PRIMARY_MODEL || "",
                base_url: config?.LLM_BASE_URL || "",
                api_key:
                    config?.LLM_API_KEY && !config.LLM_API_KEY.includes("•")
                        ? config.LLM_API_KEY
                        : undefined,
            });

            const capable = Boolean(result?.vision_capable);
            const detail =
                result?.detail ||
                (capable
                    ? t("settings.llm.visionAccepted")
                    : t("settings.llm.visionNotAccepted"));

            if (!config?.DOCUMENT_IMAGE_PROCESSING_MODE) {
                handleConfigChange("DOCUMENT_IMAGE_PROCESSING_MODE", "auto");
            }

            setVisionProbeStatus(capable ? "success" : "warning");
            setVisionProbeDetail(detail);

            await loadCurrentVisionCapability();

            toaster.create({
                title: capable
                    ? t("settings.llm.visionDetected")
                    : t("settings.llm.visionNotDetected"),
                description: detail,
                status: capable ? "success" : "warning",
                duration: 4500,
            });
        } catch (error) {
            const detail =
                error?.message || t("settings.llm.probeFailed");
            setVisionProbeStatus("error");
            setVisionProbeDetail(detail);
            setCurrentVisionCapability(null);

            toaster.create({
                title: t("settings.llm.probeFailedTitle"),
                description: detail,
                type: "error",
                duration: 5000,
            });
        } finally {
            setIsProbingVision(false);
        }
    };

    return (
        <VStack gap={4} align="stretch">
            <Box>
                <Text fontSize="md" fontWeight="bold">
                    {t("settings.llm.title")}
                </Text>
                <Text fontSize="sm" color="overlay0">
                    {t("settings.llm.description")}
                </Text>
            </Box>

            <VStack gap={3} align="stretch">
                <Box>
                    <Tooltip content={t("settings.llm.baseUrlTooltip")}>
                        <Text fontSize="sm" mb="1" fontWeight={"bold"}>
                            {t("settings.llm.baseUrlLabel")}
                        </Text>
                    </Tooltip>
                    <InputGroup
                        size="sm"
                        endElement={
                            urlStatus.llm ? (
                                <Tooltip content={t("settings.connectionSuccessful")}>
                                    <CheckCircleIcon color="successButton" />
                                </Tooltip>
                            ) : undefined
                        }
                    >
                        <Input
                            value={config?.LLM_BASE_URL || ""}
                            onChange={(e) =>
                                handleConfigChange(
                                    "LLM_BASE_URL",
                                    e.target.value,
                                )
                            }
                            placeholder="http://localhost:11434"
                            className="input-style"
                        />
                    </InputGroup>
                </Box>

                <Box>
                    <Tooltip content={t("settings.llm.apiKeyTooltip")}>
                        <Text fontSize="sm" mb="1" fontWeight={"bold"}>
                            {t("settings.apiKeyLabel")}
                        </Text>
                    </Tooltip>
                    <Input
                        size="sm"
                        type="password"
                        value={config?.LLM_API_KEY || ""}
                        onChange={(e) =>
                            handleConfigChange("LLM_API_KEY", e.target.value)
                        }
                        placeholder="sk-..."
                        className="input-style"
                    />
                </Box>

                <Box>
                    <Tooltip content={t("settings.llm.primaryModelTooltip")}>
                        <Text fontSize="sm" mb="1" fontWeight={"bold"}>
                            {t("settings.llm.primaryModel")}
                        </Text>
                    </Tooltip>
                    {llmModelsLoading ? (
                        <HStack gap="2">
                            <Spinner size="sm" />
                            <Text fontSize="sm" color="overlay0">
                                {t("settings.loadingModels")}
                            </Text>
                        </HStack>
                    ) : (
                        <NativeSelect.Root>
                            <NativeSelect.Field
                                size="sm"
                                value={config?.PRIMARY_MODEL || ""}
                                onChange={(e) =>
                                    handleConfigChange(
                                        "PRIMARY_MODEL",
                                        e.target.value,
                                    )
                                }
                                placeholder={t("settings.llm.selectModel")}
                                className="input-style"
                            >
                                {modelOptions.map((model) => (
                                    <option key={model} value={model}>
                                        {model}
                                    </option>
                                ))}
                            </NativeSelect.Field>
                            <NativeSelect.Indicator />
                        </NativeSelect.Root>
                    )}
                </Box>

                <Box>
                    <Tooltip content={t("settings.llm.secondaryModelTooltip")}>
                        <Text fontSize="sm" mb="1" fontWeight={"bold"}>
                            {t("settings.llm.secondaryModel")}
                        </Text>
                    </Tooltip>
                    {llmModelsLoading ? (
                        <HStack gap="2">
                            <Spinner size="sm" />
                            <Text fontSize="sm" color="overlay0">
                                {t("settings.loadingModels")}
                            </Text>
                        </HStack>
                    ) : (
                        <NativeSelect.Root>
                            <NativeSelect.Field
                                size="sm"
                                value={config?.SECONDARY_MODEL || ""}
                                onChange={(e) =>
                                    handleConfigChange(
                                        "SECONDARY_MODEL",
                                        e.target.value,
                                    )
                                }
                                placeholder={t("settings.llm.selectModel")}
                                className="input-style"
                            >
                                {modelOptions.map((model) => (
                                    <option key={model} value={model}>
                                        {model}
                                    </option>
                                ))}
                            </NativeSelect.Field>
                            <NativeSelect.Indicator />
                        </NativeSelect.Root>
                    )}
                </Box>

                <Box>
                    <Tooltip content={t("settings.llm.processingModeTooltip")}>
                        <Text fontSize="sm" mb="1" fontWeight={"bold"}>
                            {t("settings.llm.processingMode")}
                        </Text>
                    </Tooltip>
                    <NativeSelect.Root>
                        <NativeSelect.Field
                            size="sm"
                            value={
                                config?.DOCUMENT_IMAGE_PROCESSING_MODE || "auto"
                            }
                            onChange={(e) =>
                                handleConfigChange(
                                    "DOCUMENT_IMAGE_PROCESSING_MODE",
                                    e.target.value,
                                )
                            }
                            className="input-style"
                        >
                            <option value="auto">
                                {t("settings.llm.modeAuto")}
                            </option>
                            <option value="vision">{t("settings.llm.modeVision")}</option>
                            <option value="ocr">{t("settings.llm.modeOcr")}</option>
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                    </NativeSelect.Root>
                    <Text fontSize="xs" color="overlay0" mt="1">
                        {t("settings.llm.processingModeHint")}
                    </Text>
                </Box>

                <Box>
                    <Tooltip content={t("settings.llm.probeTooltip")}>
                        <Text fontSize="sm" mb="1" fontWeight={"bold"}>
                            {t("settings.llm.probeLabel")}
                        </Text>
                    </Tooltip>

                    <HStack gap={3} mb={2}>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleProbeVisionCapability}
                            loading={isProbingVision}
                        >
                            {t("settings.llm.testVision")}
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
                                    ? t("settings.llm.visionCapable")
                                    : t("settings.llm.visionNotCapable")
                                    : t("settings.llm.unknown")}
                        </Badge>
                    </HStack>
                    {currentVisionCapability ? (
                        <Text fontSize="xs" color="overlay0" mb={2}>
                            {t("settings.llm.source")}{" "}
                            {currentVisionCapability.source || "cache"}
                            {currentVisionCapability.probed_at
                                ? t("settings.llm.probedAt", {
                                      value: currentVisionCapability.probed_at,
                                  })
                                : ""}
                        </Text>
                    ) : null}

                    {visionProbeDetail ? (
                        <Alert.Root
                            status={visionProbeStatus}
                            borderRadius="sm"
                            py={2}
                        >
                            <Alert.Indicator />
                            <Text fontSize="xs" whiteSpace="pre-wrap">
                                {visionProbeDetail}
                            </Text>
                        </Alert.Root>
                    ) : null}
                </Box>

                {onLetterTemperatureChange && (
                    <Box>
                        <HStack justify="space-between" mb="1">
                            <Tooltip content={t("settings.llm.temperatureTooltip")}>
                                <Text fontSize="sm" fontWeight="bold">
                                    {t("settings.llm.temperature")}
                                </Text>
                            </Tooltip>
                            {onOptionsReset && (
                                <Button
                                    size="sm"
                                    h="30px"
                                    minH="30px"
                                    className="red-button"
                                    onClick={onOptionsReset}
                                >
                                    <FiRefreshCw />
                                    {t("settings.resetToDefault")}
                                </Button>
                            )}
                        </HStack>
                        <HStack>
                            <NumberInput.Root
                                size="sm"
                                width="100px"
                                min={0}
                                max={2}
                                step={0.1}
                                value={String(letterTemperature ?? "")}
                                onValueChange={(details) =>
                                    onLetterTemperatureChange(details.value)
                                }
                            >
                                <NumberInput.Input className="input-style" />
                            </NumberInput.Root>
                            <Text fontSize="xs" color="overlay0">
                                {t("settings.llm.temperatureHint")}
                            </Text>
                        </HStack>
                    </Box>
                )}
            </VStack>
        </VStack>
    );
};

export default LlmTab;
