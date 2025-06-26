// Component for managing settings related to Ollama models.
import {
    Box,
    Flex,
    IconButton,
    Text,
    Collapse,
    Input,
    Select,
    Switch,
    VStack,
    Tooltip,
    InputGroup,
    InputRightElement,
} from "@chakra-ui/react";
import {
    ChevronRightIcon,
    ChevronDownIcon,
    CheckCircleIcon,
} from "@chakra-ui/icons";
import { FaCog } from "react-icons/fa";
import LocalModelManager from "./LocalModelManager";

const ModelSettingsPanel = ({
    isCollapsed,
    setIsCollapsed,
    config,
    handleConfigChange,
    modelOptions,
    whisperModelOptions = [],
    whisperModelListAvailable = false,
    urlStatus = { whisper: false, ollama: false },
}) => {
    return (
        <Box className="panels-bg" p="4" borderRadius="sm">
            <Flex align="center" justify="space-between">
                <Flex align="center">
                    <IconButton
                        icon={
                            isCollapsed ? (
                                <ChevronRightIcon />
                            ) : (
                                <ChevronDownIcon />
                            )
                        }
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        aria-label="Toggle collapse"
                        variant="outline"
                        size="sm"
                        mr="2"
                        className="collapse-toggle"
                    />
                    <FaCog size="1.2em" style={{ marginRight: "5px" }} />
                    <Text as="h3">Model Settings</Text>
                </Flex>
            </Flex>
            <Collapse in={!isCollapsed} animateOpacity>
                <VStack spacing={4} align="stretch" mt={4}>
                    <Box>
                        <Tooltip label="Base URL for the Whisper API">
                            <Text fontSize="sm" mt="2">
                                Whisper API Base URL
                            </Text>
                        </Tooltip>
                        <InputGroup size="sm">
                            <Input
                                value={config?.WHISPER_BASE_URL || ""}
                                onChange={(e) =>
                                    handleConfigChange(
                                        "WHISPER_BASE_URL",
                                        e.target.value,
                                    )
                                }
                                className="input-style"
                            />
                            {urlStatus.whisper && (
                                <InputRightElement>
                                    <Tooltip label="Connection successful">
                                        <CheckCircleIcon color="green.500" />
                                    </Tooltip>
                                </InputRightElement>
                            )}
                        </InputGroup>
                    </Box>

                    <Box>
                        <Tooltip label="Model to use for Whisper transcription">
                            <Text fontSize="sm" mt="2">
                                Whisper Model
                            </Text>
                        </Tooltip>

                        {whisperModelListAvailable &&
                        whisperModelOptions.length > 0 ? (
                            <Select
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
                            </Select>
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
                        <Tooltip label="API key for the Whisper service">
                            <Text fontSize="sm" mt="2">
                                Whisper Key
                            </Text>
                        </Tooltip>
                        <Input
                            size="sm"
                            value={config?.WHISPER_KEY || ""}
                            onChange={(e) =>
                                handleConfigChange(
                                    "WHISPER_KEY",
                                    e.target.value,
                                )
                            }
                            className="input-style"
                        />
                    </Box>

                    <Box>
                        <Tooltip label="Choose the LLM provider">
                            <Text fontSize="sm" mt="2">
                                LLM Provider Type
                            </Text>
                        </Tooltip>
                        <Select
                            size="sm"
                            value={config?.LLM_PROVIDER || "ollama"}
                            onChange={(e) =>
                                handleConfigChange(
                                    "LLM_PROVIDER",
                                    e.target.value,
                                )
                            }
                            className="input-style"
                        >
                            <option value="ollama">Ollama</option>
                            <option value="openai">OpenAI-compatible</option>
                            <option value="local">Local Models</option>
                        </Select>
                    </Box>

                    {config?.LLM_PROVIDER !== "local" && (
                        <Box>
                            <Tooltip label="Base URL for the LLM API">
                                <Text fontSize="sm" mt="2">
                                    {config?.LLM_PROVIDER === "openai"
                                        ? "OpenAI-compatible API Base URL"
                                        : "Ollama Base URL"}
                                </Text>
                            </Tooltip>
                            <InputGroup size="sm">
                                <Input
                                    value={config?.LLM_BASE_URL || ""}
                                    onChange={(e) =>
                                        handleConfigChange(
                                            "LLM_BASE_URL",
                                            e.target.value,
                                        )
                                    }
                                    placeholder={
                                        config?.LLM_PROVIDER === "openai"
                                            ? "https://api.openai.com"
                                            : "http://localhost:11434"
                                    }
                                    className="input-style"
                                />
                                {urlStatus.llm && ( // Changed from urlStatus.ollama to urlStatus.llm
                                    <InputRightElement>
                                        <Tooltip label="Connection successful">
                                            <CheckCircleIcon color="green.500" />
                                        </Tooltip>
                                    </InputRightElement>
                                )}
                            </InputGroup>
                        </Box>
                    )}

                    {config?.LLM_PROVIDER === "openai" && (
                        <Box>
                            <Tooltip label="API key for the OpenAI-compatible service">
                                <Text fontSize="sm" mt="2">
                                    API Key
                                </Text>
                            </Tooltip>
                            <Input
                                size="sm"
                                type="password"
                                value={config?.LLM_API_KEY || ""}
                                onChange={(e) =>
                                    handleConfigChange(
                                        "LLM_API_KEY",
                                        e.target.value,
                                    )
                                }
                                className="input-style"
                            />
                        </Box>
                    )}

                    <Box>
                        <Tooltip label="Primary model for generating responses">
                            <Text fontSize="sm" mt="2">
                                Primary Model
                            </Text>
                        </Tooltip>
                        <Select
                            size="sm"
                            value={config?.PRIMARY_MODEL || ""}
                            onChange={(e) =>
                                handleConfigChange(
                                    "PRIMARY_MODEL",
                                    e.target.value,
                                )
                            }
                            placeholder="Select model"
                            className="input-style"
                        >
                            {modelOptions.map((model) => (
                                <option key={model} value={model}>
                                    {model}
                                </option>
                            ))}
                        </Select>
                    </Box>

                    <Box>
                        <Tooltip label="Secondary model for generating responses">
                            <Text fontSize="sm" mt="2">
                                Secondary Model
                            </Text>
                        </Tooltip>
                        <Select
                            size="sm"
                            value={config?.SECONDARY_MODEL || ""}
                            onChange={(e) =>
                                handleConfigChange(
                                    "SECONDARY_MODEL",
                                    e.target.value,
                                )
                            }
                            placeholder="Select model"
                            className="input-style"
                        >
                            {modelOptions.map((model) => (
                                <option key={model} value={model}>
                                    {model}
                                </option>
                            ))}
                        </Select>
                    </Box>
                    <Box>
                        <Tooltip label="Enable clinical reasoning analysis">
                            <Flex align="center" gap="2">
                                <Text fontSize="sm">
                                    Enable Reasoning Analysis
                                </Text>
                                <Switch
                                    size="sm"
                                    isChecked={
                                        config?.REASONING_ENABLED === true
                                    }
                                    onChange={(e) =>
                                        handleConfigChange(
                                            "REASONING_ENABLED",
                                            e.target.checked,
                                        )
                                    }
                                />
                            </Flex>
                        </Tooltip>

                        <Collapse
                            in={config?.REASONING_ENABLED === true}
                            animateOpacity
                        >
                            <Box mt="2">
                                <Tooltip label="Model for clinical reasoning analysis">
                                    <Text fontSize="sm">Reasoning Model</Text>
                                </Tooltip>
                                <Select
                                    size="sm"
                                    value={config?.REASONING_MODEL || ""}
                                    onChange={(e) =>
                                        handleConfigChange(
                                            "REASONING_MODEL",
                                            e.target.value,
                                        )
                                    }
                                    placeholder="Select model"
                                    className="input-style"
                                >
                                    {modelOptions.map((model) => (
                                        <option key={model} value={model}>
                                            {model}
                                        </option>
                                    ))}
                                </Select>
                            </Box>
                        </Collapse>
                    </Box>

                    {/* Local Model Manager - only show when local provider is selected */}
                    {config?.LLM_PROVIDER === "local" && (
                        <Box mt={4}>
                            <LocalModelManager />
                        </Box>
                    )}
                </VStack>
            </Collapse>
        </Box>
    );
};

export default ModelSettingsPanel;
