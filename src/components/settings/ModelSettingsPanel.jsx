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
  Button,
  ButtonGroup,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  HStack,
  Badge,
} from "@chakra-ui/react";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  CheckCircleIcon,
} from "@chakra-ui/icons";
import { FaCog, FaDesktop, FaCloud } from "react-icons/fa";
import { useState, useEffect } from "react";

import { universalFetch } from "../../utils/helpers/apiHelpers";
import { buildApiUrl } from "../../utils/helpers/apiConfig";

const ModelSettingsPanel = ({
  isCollapsed,
  setIsCollapsed,
  config,
  handleConfigChange,
  modelOptions,
  whisperModelOptions = [],
  whisperModelListAvailable = false,
  urlStatus = { whisper: false, ollama: false },
  onOpenLocalModelManager,
  showLocalManagerButton,
}) => {
  const [localStatus, setLocalStatus] = useState(null);
  const [isDocker, setIsDocker] = useState(false);

  // Determine if we're using local inference
  const isLocalInference = config?.LLM_PROVIDER === "local";

  useEffect(() => {
    checkLocalStatus();
    checkIfDocker();
  }, []);

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
      setLocalStatus({ available: false, reason: "Failed to check status" });
    }
  };

  const checkIfDocker = async () => {
    try {
      // We can infer Docker from the local status response
      const response = await universalFetch(
        await buildApiUrl("/api/config/local/status"),
      );
      if (response.ok) {
        const data = await response.json();
        setIsDocker(!data.available && data.reason?.includes("Docker"));
      }
    } catch (error) {
      console.error("Error checking Docker status:", error);
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
      handleConfigChange("LLM_PROVIDER", "ollama"); // Default to Ollama for remote
    }
  };

  return (
    <Box className="panels-bg" p="4" borderRadius="sm">
      <Flex align="center" justify="space-between">
        <Flex align="center">
          <IconButton
            icon={isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
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
        <VStack spacing={6} align="stretch" mt={4}>
          {/* Inference Type Selection - Only show if not Docker */}
          {!isDocker && (
            <Box>
              <Text fontSize="md" fontWeight="bold" mb="3">
                Inference Type
              </Text>
              <Flex
                className="mode-selector"
                alignItems="center"
                p={1}
                width="100%"
              >
                <Box
                  className="mode-selector-indicator"
                  left={isLocalInference ? "2px" : "calc(50% - 2px)"}
                />
                <Flex width="full" position="relative" zIndex={1}>
                  <Button
                    className={`mode-selector-button ${isLocalInference ? "active" : ""}`}
                    leftIcon={<FaDesktop />}
                    onClick={() => handleInferenceTypeChange(true)}
                    isDisabled={!localStatus?.available}
                  >
                    Local
                  </Button>
                  <Button
                    className={`mode-selector-button ${!isLocalInference ? "active" : ""}`}
                    leftIcon={<FaCloud />}
                    onClick={() => handleInferenceTypeChange(false)}
                  >
                    Remote
                  </Button>
                </Flex>
              </Flex>
            </Box>
          )}

          {/* Local Inference Settings */}
          {isLocalInference ? (
            <VStack spacing={4} align="stretch">
              <Box>
                <HStack mb="2">
                  <FaDesktop />
                  <Text fontSize="md" fontWeight="bold">
                    Local Inference Settings
                  </Text>
                  <Badge colorScheme="green">Local</Badge>
                </HStack>
                <Text fontSize="sm" color="gray.600" mb="4">
                  Models run directly on your machine. Both LLM and Whisper will
                  use local inference.
                </Text>
              </Box>

              {/* Primary Model Selection for Local */}
              <Box>
                <Tooltip label="Primary model for local inference">
                  <Text fontSize="sm" mb="2">
                    Primary Model (Local)
                  </Text>
                </Tooltip>
                <Select
                  size="sm"
                  value={config?.PRIMARY_MODEL || ""}
                  onChange={(e) =>
                    handleConfigChange("PRIMARY_MODEL", e.target.value)
                  }
                  placeholder="Select downloaded model"
                  className="input-style"
                >
                  {modelOptions.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </Select>
              </Box>

              {/* Local Whisper Model Selection */}
              <Box>
                <Tooltip label="Whisper model for local transcription">
                  <Text fontSize="sm" mb="2">
                    Whisper Model (Local)
                  </Text>
                </Tooltip>
                <Select
                  size="sm"
                  value={config?.WHISPER_MODEL || "whisper-1"}
                  onChange={(e) =>
                    handleConfigChange("WHISPER_MODEL", e.target.value)
                  }
                  className="input-style"
                >
                  <option value="whisper-1">whisper-1 (Base)</option>
                  <option value="whisper-large">whisper-large</option>
                  <option value="whisper-medium">whisper-medium</option>
                  <option value="whisper-small">whisper-small</option>
                  <option value="whisper-tiny">whisper-tiny</option>
                </Select>
              </Box>

              {/* Local Model Manager Trigger */}
              {showLocalManagerButton &&
                typeof onOpenLocalModelManager === "function" && (
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
          ) : (
            /* Remote Inference Settings */
            <VStack spacing={4} align="stretch">
              <Box>
                <HStack mb="2">
                  <FaCloud />
                  <Text fontSize="md" fontWeight="bold">
                    Remote Inference Settings
                  </Text>
                  <Badge colorScheme="blue">Remote</Badge>
                </HStack>
                <Text fontSize="sm" color="gray.600" mb="4">
                  Connect to external APIs for model inference.
                </Text>
              </Box>

              {/* Whisper Settings */}
              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb="3">
                  Whisper (Speech-to-Text)
                </Text>

                <VStack spacing={3} align="stretch">
                  <Box>
                    <Tooltip label="Base URL for the Whisper API">
                      <Text fontSize="sm" mb="1">
                        Whisper API Base URL
                      </Text>
                    </Tooltip>
                    <InputGroup size="sm">
                      <Input
                        value={config?.WHISPER_BASE_URL || ""}
                        onChange={(e) =>
                          handleConfigChange("WHISPER_BASE_URL", e.target.value)
                        }
                        placeholder="https://api.openai.com"
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
                      <Text fontSize="sm" mb="1">
                        Whisper Model
                      </Text>
                    </Tooltip>

                    {whisperModelListAvailable &&
                    whisperModelOptions.length > 0 ? (
                      <Select
                        size="sm"
                        value={config?.WHISPER_MODEL || ""}
                        onChange={(e) =>
                          handleConfigChange("WHISPER_MODEL", e.target.value)
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
                          handleConfigChange("WHISPER_MODEL", e.target.value)
                        }
                        className="input-style"
                      />
                    )}
                  </Box>

                  <Box>
                    <Tooltip label="API key for the Whisper service">
                      <Text fontSize="sm" mb="1">
                        Whisper API Key
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
              </Box>

              {/* LLM Provider Settings */}
              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb="3">
                  Large Language Model (LLM)
                </Text>

                <VStack spacing={3} align="stretch">
                  <Box>
                    <Tooltip label="Choose the LLM provider">
                      <Text fontSize="sm" mb="1">
                        LLM Provider Type
                      </Text>
                    </Tooltip>
                    <Select
                      size="sm"
                      value={config?.LLM_PROVIDER || "ollama"}
                      onChange={(e) =>
                        handleConfigChange("LLM_PROVIDER", e.target.value)
                      }
                      className="input-style"
                    >
                      <option value="ollama">Ollama</option>
                      <option value="openai">OpenAI-compatible</option>
                    </Select>
                  </Box>

                  <Box>
                    <Tooltip label="Base URL for the LLM API">
                      <Text fontSize="sm" mb="1">
                        {config?.LLM_PROVIDER === "openai"
                          ? "OpenAI-compatible API Base URL"
                          : "Ollama Base URL"}
                      </Text>
                    </Tooltip>
                    <InputGroup size="sm">
                      <Input
                        value={config?.LLM_BASE_URL || ""}
                        onChange={(e) =>
                          handleConfigChange("LLM_BASE_URL", e.target.value)
                        }
                        placeholder={
                          config?.LLM_PROVIDER === "openai"
                            ? "https://api.openai.com/v1"
                            : "http://localhost:11434"
                        }
                        className="input-style"
                      />
                      {urlStatus.llm && (
                        <InputRightElement>
                          <Tooltip label="Connection successful">
                            <CheckCircleIcon color="green.500" />
                          </Tooltip>
                        </InputRightElement>
                      )}
                    </InputGroup>
                  </Box>

                  {config?.LLM_PROVIDER === "openai" && (
                    <Box>
                      <Tooltip label="API key for the OpenAI-compatible service">
                        <Text fontSize="sm" mb="1">
                          API Key
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
                  )}

                  <Box>
                    <Tooltip label="Primary model for generating responses">
                      <Text fontSize="sm" mb="1">
                        Primary Model
                      </Text>
                    </Tooltip>
                    <Select
                      size="sm"
                      value={config?.PRIMARY_MODEL || ""}
                      onChange={(e) =>
                        handleConfigChange("PRIMARY_MODEL", e.target.value)
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
                      <Text fontSize="sm" mb="1">
                        Secondary Model
                      </Text>
                    </Tooltip>
                    <Select
                      size="sm"
                      value={config?.SECONDARY_MODEL || ""}
                      onChange={(e) =>
                        handleConfigChange("SECONDARY_MODEL", e.target.value)
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
                </VStack>
              </Box>
            </VStack>
          )}
        </VStack>
      </Collapse>
    </Box>
  );
};

export default ModelSettingsPanel;
