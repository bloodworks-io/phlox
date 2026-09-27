import { Box, Text, InputGroup, Input, NativeSelect, VStack, HStack, Spinner } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { CheckCircleIcon } from "../common/icons";
import { useTranslation } from "react-i18next";

const WhisperTab = ({
    config,
    handleConfigChange,
    whisperModelOptions = [],
    whisperModelListAvailable = false,
    whisperModelsLoading = false,
    urlStatus = { whisper: false },
}) => {
    const { t } = useTranslation();
    return (
        <VStack gap={4} align="stretch">
            <Box>
                <Text fontSize="md" fontWeight="bold">
                    {t("settings.whisper.title")}
                </Text>
                <Text fontSize="sm" color="overlay0">
                    {t("settings.whisper.description")}
                </Text>
            </Box>

            <VStack gap={3} align="stretch">
                <Box>
                    <Tooltip content={t("settings.whisper.baseUrlTooltip")}>
                        <Text fontSize="sm" mb="1" fontWeight={"bold"}>
                            {t("settings.whisper.baseUrlLabel")}
                        </Text>
                    </Tooltip>
                    <InputGroup
                        size="sm"
                        endElement={
                            urlStatus.whisper ? (
                                <Tooltip content={t("settings.connectionSuccessful")}>
                                    <CheckCircleIcon color="successButton" />
                                </Tooltip>
                            ) : undefined
                        }
                    >
                        <Input
                            value={config?.WHISPER_BASE_URL || ""}
                            onChange={(e) =>
                                handleConfigChange(
                                    "WHISPER_BASE_URL",
                                    e.target.value,
                                )
                            }
                            placeholder="https://api.openai.com"
                            className="input-style"
                        />
                    </InputGroup>
                </Box>

                <Box>
                    <Tooltip content={t("settings.whisper.modelTooltip")}>
                        <Text fontSize="sm" mb="1" fontWeight={"bold"}>
                            {t("settings.whisper.model")}
                        </Text>
                    </Tooltip>

                    {whisperModelsLoading ? (
                        <HStack gap="2">
                            <Spinner size="sm" />
                            <Text fontSize="sm" color="overlay0">
                                {t("settings.loadingModels")}
                            </Text>
                        </HStack>
                    ) : (
                        whisperModelListAvailable &&
                        whisperModelOptions.length > 0
                    ) ? (
                        <NativeSelect.Root>
                            <NativeSelect.Field
                                size="sm"
                                value={config?.WHISPER_MODEL || ""}
                                onChange={(e) =>
                                    handleConfigChange(
                                        "WHISPER_MODEL",
                                        e.target.value,
                                    )
                                }
                                placeholder={t("settings.whisper.selectModel")}
                                className="input-style"
                            >
                                {whisperModelOptions.map((model) => (
                                    <option key={model} value={model}>
                                        {model}
                                    </option>
                                ))}
                            </NativeSelect.Field>
                            <NativeSelect.Indicator />
                        </NativeSelect.Root>
                    ) : (
                        <Input
                            size="sm"
                            placeholder={t("settings.whisper.modelNamePlaceholder")}
                            value={config?.WHISPER_MODEL || ""}
                            onChange={(e) =>
                                handleConfigChange(
                                    "WHISPER_MODEL",
                                    e.target.value,
                                )
                            }
                            className="input-style"
                        />
                    )}
                </Box>

                <Box>
                    <Tooltip content={t("settings.whisper.apiKeyTooltip")}>
                        <Text fontSize="sm" mb="1" fontWeight={"bold"}>
                            {t("settings.apiKeyLabel")}
                        </Text>
                    </Tooltip>
                    <Input
                        size="sm"
                        type="password"
                        value={config?.WHISPER_KEY || ""}
                        onChange={(e) =>
                            handleConfigChange("WHISPER_KEY", e.target.value)
                        }
                        placeholder="sk-..."
                        className="input-style"
                    />
                </Box>
            </VStack>
        </VStack>
    );
};

export default WhisperTab;
