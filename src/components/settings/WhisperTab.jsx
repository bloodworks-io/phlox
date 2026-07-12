import { Box, Text, InputGroup, Input, NativeSelect, VStack, HStack, Spinner } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { CheckCircleIcon } from "../common/icons";

const WhisperTab = ({
    config,
    handleConfigChange,
    whisperModelOptions = [],
    whisperModelListAvailable = false,
    whisperModelsLoading = false,
    urlStatus = { whisper: false },
}) => {
    return (
        <VStack gap={4} align="stretch">
            <Box>
                <Text fontSize="md" fontWeight="bold">
                    Whisper (Speech-to-Text)
                </Text>
                <Text fontSize="sm" color="overlay0">
                    Configure the speech-to-text service for transcribing audio
                    recordings
                </Text>
            </Box>

            <VStack gap={3} align="stretch">
                <Box>
                    <Tooltip content="Base URL for the Whisper API (e.g., https://api.openai.com)">
                        <Text fontSize="sm" mb="1" fontWeight={"bold"}>
                            API Base URL
                        </Text>
                    </Tooltip>
                    <InputGroup
                        size="sm"
                        endElement={
                            urlStatus.whisper ? (
                                <Tooltip content="Connection successful">
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
                    <Tooltip content="Model to use for Whisper transcription (e.g., whisper-1)">
                        <Text fontSize="sm" mb="1" fontWeight={"bold"}>
                            Model
                        </Text>
                    </Tooltip>

                    {whisperModelsLoading ? (
                        <HStack gap="2">
                            <Spinner size="sm" />
                            <Text fontSize="sm" color="overlay0">
                                Loading models...
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
                                placeholder="Select Whisper model"
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
                            placeholder="Enter model name (e.g., whisper-1)"
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
                    <Tooltip content="API key for authenticating with the Whisper service">
                        <Text fontSize="sm" mb="1" fontWeight={"bold"}>
                            API Key
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
