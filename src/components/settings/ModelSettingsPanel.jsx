import {
  Box,
  Flex,
  IconButton,
  Text,
  Collapse,
  Input,
  Select,
  VStack,
  Tooltip,
  InputGroup,
  InputRightElement,
  Tabs,
  TabList,
  TabPanels,
  TabPanel,
  Tab,
  HStack,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  Button,
  useColorModeValue,
} from "@chakra-ui/react";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  CheckCircleIcon,
} from "@chakra-ui/icons";
import {
  FaCog,
  FaDesktop,
  FaCloud,
  FaDatabase,
  FaMicrophone,
  FaBrain,
} from "react-icons/fa";
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
  modelManagerRefreshKey = 0,
  embeddingModelOptions = [],
  handleClearDatabase,
}) => {
  const [localStatus, setLocalStatus] = useState(null);
  const [isDocker, setIsDocker] = useState(false);
  const [downloadedWhisperModel, setDownloadedWhisperModel] = useState(null);
  const [tabIndex, setTabIndex] = useState(0);
  const [isEmbeddingModelModalOpen, setIsEmbeddingModelModalOpen] =
    useState(false);
  const [pendingEmbeddingModel, setPendingEmbeddingModel] = useState(null);

  // Determine if we're using local inference
  const isLocalInference = config?.LLM_PROVIDER === "local";

  const warningBg = useColorModeValue("#df8e1d", "#eed49f");
  const warningFg = useColorModeValue("#232634", "#1e2030");

  useEffect(() => {
    checkLocalStatus();
    checkIfDocker();
    fetchDownloadedWhisperModel();
  }, []);

  useEffect(() => {
    // Refresh Whisper model when model manager closes
    if (modelManagerRefreshKey > 0) {
      fetchDownloadedWhisperModel();
    }
  }, [modelManagerRefreshKey]);

  const fetchDownloadedWhisperModel = async () => {
    try {
      const response = await universalFetch(
        await buildApiUrl("/api/config/local/whisper/models/downloaded"),
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

  const handleEmbeddingModelChange = (value) => {
    setPendingEmbeddingModel(value);
    setIsEmbeddingModelModalOpen(true);
  };

  const handleConfirmEmbeddingChange = async () => {
    try {
      await handleClearDatabase(pendingEmbeddingModel);
      setIsEmbeddingModelModalOpen(false);
      setPendingEmbeddingModel(null);
    } catch (error) {
      console.error("Error changing embedding model:", error);
    }
  };

  const handleCancelEmbeddingChange = () => {
    setIsEmbeddingModelModalOpen(false);
    setPendingEmbeddingModel(null);
  };

  return (
    <>
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
          <VStack spacing={4} align="stretch" mt={4}>
            {/* Inference Type Selection - Only show if not Docker */}
            {!isDocker && (
              <Box>
                <Tooltip label="Choose between running models locally on your machine or connecting to remote API services">
                  <Text fontSize="md" fontWeight="bold" mb="3">
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
                    left={isLocalInference ? "2px" : "calc(50% - 2px)"}
                  />
                  <Flex width="full" position="relative" zIndex={1}>
                    <Tooltip label="Run models directly on your machine using bundled inference engines">
                      <Button
                        className={`mode-selector-button ${isLocalInference ? "active" : ""}`}
                        leftIcon={<FaDesktop />}
                        onClick={() => handleInferenceTypeChange(true)}
                        isDisabled={!localStatus?.available}
                      >
                        Local
                      </Button>
                    </Tooltip>
                    <Tooltip label="Connect to external APIs like Ollama or OpenAI-compatible services">
                      <Button
                        className={`mode-selector-button ${!isLocalInference ? "active" : ""}`}
                        leftIcon={<FaCloud />}
                        onClick={() => handleInferenceTypeChange(false)}
                      >
                        Remote
                      </Button>
                    </Tooltip>
                  </Flex>
                </Flex>
              </Box>
            )}

            {/* Inference Settings - Using tabs for organization */}
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
                    Models run directly on your machine. Both LLM and Whisper
                    will use local inference.
                  </Text>
                </Box>

                {/* Primary Model Selection for Local */}
                <Box>
                  <Tooltip label="Primary model for local inference - manage through Model Manager below">
                    <Text fontSize="sm" mb="2">
                      Primary Model (Local)
                    </Text>
                  </Tooltip>
                  <Select
                    size="sm"
                    value={config?.PRIMARY_MODEL || ""}
                    isDisabled={true}
                    placeholder="Select downloaded model"
                    className="input-style"
                    cursor="not-allowed"
                    opacity={0.7}
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
                  <Tooltip label="Whisper model for local transcription - manage through Model Manager below">
                    <Text fontSize="sm" mb="2">
                      Whisper Model (Local)
                    </Text>
                  </Tooltip>
                  <Select
                    size="sm"
                    value={
                      downloadedWhisperModel || config?.WHISPER_MODEL || "base"
                    }
                    isDisabled={true}
                    className="input-style"
                    cursor="not-allowed"
                    opacity={0.7}
                  >
                    <option value="tiny">tiny (39MB) - Fastest</option>
                    <option value="tiny.en">
                      tiny.en (39MB) - English-only
                    </option>
                    <option value="base">base (74MB) - Multilingual</option>
                    <option value="base.en">
                      base.en (74MB) - English-only, Recommended
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
              <Tabs
                variant="enclosed"
                index={tabIndex}
                onChange={(index) => setTabIndex(index)}
              >
                <TabList>
                  <Tooltip label="Configure speech-to-text service settings">
                    <Tab className="tab-style">
                      <HStack>
                        <FaMicrophone />
                        <Text>Whisper</Text>
                      </HStack>
                    </Tab>
                  </Tooltip>
                  <Tooltip label="Configure large language model provider settings">
                    <Tab className="tab-style">
                      <HStack>
                        <FaBrain />
                        <Text>LLM</Text>
                      </HStack>
                    </Tab>
                  </Tooltip>
                  <Tooltip label="Configure knowledge base embedding model">
                    <Tab className="tab-style">
                      <HStack>
                        <FaDatabase />
                        <Text>RAG</Text>
                      </HStack>
                    </Tab>
                  </Tooltip>
                </TabList>
                <TabPanels>
                  {/* Whisper Tab */}
                  <TabPanel className="floating-main">
                    <VStack spacing={4} align="stretch">
                      <Box>
                        <Text fontSize="md" fontWeight="bold">
                          Whisper (Speech-to-Text)
                        </Text>
                        <Text fontSize="sm" color="gray.500">
                          Configure the speech-to-text service for transcribing
                          audio recordings
                        </Text>
                      </Box>

                      <VStack spacing={3} align="stretch">
                        <Box>
                          <Tooltip label="Base URL for the Whisper API (e.g., https://api.openai.com)">
                            <Text fontSize="sm" mb="1" fontWeight={"bold"}>
                              API Base URL
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
                          <Tooltip label="Model to use for Whisper transcription (e.g., whisper-1)">
                            <Text fontSize="sm" mb="1" fontWeight={"bold"}>
                              Model
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
                          <Tooltip label="API key for authenticating with the Whisper service">
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
                  </TabPanel>

                  {/* LLM Tab */}
                  <TabPanel className="floating-main">
                    <VStack spacing={4} align="stretch">
                      <Box>
                        <Text fontSize="md" fontWeight="bold">
                          Large Language Model (LLM)
                        </Text>
                        <Text fontSize="sm" color="gray.500">
                          Configure the language model provider for generating
                          responses
                        </Text>
                      </Box>

                      <VStack spacing={3} align="stretch">
                        <Box>
                          <Tooltip label="Choose the LLM provider - Ollama for local models or OpenAI-compatible for hosted services">
                            <Text fontSize="sm" mb="1" fontWeight={"bold"}>
                              Provider Type
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
                            <Text fontSize="sm" mb="1" fontWeight={"bold"}>
                              API Base URL
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
                            <Tooltip label="API key for authenticating with the OpenAI-compatible service">
                              <Text fontSize="sm" mb="1" fontWeight={"bold"}>
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
                              placeholder="sk-..."
                              className="input-style"
                            />
                          </Box>
                        )}

                        <Box>
                          <Tooltip label="Primary model for generating responses and clinical notes">
                            <Text fontSize="sm" mb="1" fontWeight={"bold"}>
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
                          <Tooltip label="Secondary model for tasks requiring different capabilities or for comparison">
                            <Text fontSize="sm" mb="1" fontWeight={"bold"}>
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
                      </VStack>
                    </VStack>
                  </TabPanel>

                  {/* RAG Tab */}
                  <TabPanel className="floating-main">
                    <VStack spacing={4} align="stretch">
                      <Box>
                        <Text fontSize="md" fontWeight="bold">
                          Knowledge Base (RAG)
                        </Text>
                        <Text fontSize="sm" color="gray.500">
                          Configure the embedding model used for knowledge base
                          searches
                        </Text>
                      </Box>

                      <Box>
                        <Tooltip label="Model used for generating embeddings for RAG - changing this will require rebuilding the database">
                          <Text fontSize="sm" mb="2" fontWeight={"bold"}>
                            Embedding Model
                          </Text>
                        </Tooltip>
                        <Select
                          size="sm"
                          value={config?.EMBEDDING_MODEL || ""}
                          onChange={(e) =>
                            handleEmbeddingModelChange(e.target.value)
                          }
                          placeholder="Select embedding model"
                          className="input-style"
                        >
                          {embeddingModelOptions.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </Select>
                        <Text fontSize="xs" color="gray.500" mt="1">
                          Available embedding models depend on the LLM endpoint
                          configured in the LLM tab
                        </Text>
                        <Text
                          fontSize="xs"
                          color={warningBg}
                          mt="2"
                          fontWeight="medium"
                        >
                          ⚠️ Warning: Changing the embedding model will require
                          rebuilding the RAG database
                        </Text>
                      </Box>
                    </VStack>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            )}
          </VStack>
        </Collapse>
      </Box>

      {/* Warning Modal for RAG Embedding Model Change */}
      <Modal
        isOpen={isEmbeddingModelModalOpen}
        onClose={handleCancelEmbeddingChange}
        size="md"
      >
        <ModalOverlay />
        <ModalContent className="modal-style">
          <ModalHeader>Warning: Database Reset Required</ModalHeader>
          <ModalBody>
            <Text>
              Changing the embedding model requires clearing the entire RAG
              database. This will delete all existing document collections and
              their embeddings. This action cannot be undone.
            </Text>
            <Text mt={4} fontWeight="bold">
              Are you sure you want to proceed?
            </Text>
          </ModalBody>
          <ModalFooter>
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
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default ModelSettingsPanel;
