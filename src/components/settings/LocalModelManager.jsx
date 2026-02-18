import React, { useState, useMemo } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Spinner,
  Badge,
  Tooltip,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Flex,
  Spacer,
  Progress,
  SimpleGrid,
  Icon,
  Divider,
  Center,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Collapse,
} from "@chakra-ui/react";
import {
  FaExclamationTriangle,
  FaMicrochip,
  FaMemory,
  FaMicrophone,
} from "react-icons/fa";
import {
  DeleteIcon,
  DownloadIcon,
  CheckIcon,
  WarningIcon,
} from "@chakra-ui/icons";
import {
  GreenButton,
  GreyButton,
  RedButton,
  SettingsButton,
} from "../common/Buttons";
import { ModelDownloadProgress } from "../common/ModelDownloadProgress";
import { useLocalModels } from "../../utils/hooks/useLocalModels";
import {
  calculateLLMPerformance,
  parseAppleSilicon,
  getSmartRecommendations,
} from "../../utils/performanceUtils";

const LocalModelManager = ({ className }) => {
  const {
    models,
    availableModels,
    localStatus,
    systemSpecs,
    downloadProgress,
    isDownloading,
    downloadingModelId,
    downloadLlmModel,
    deleteLlmModel,
    refreshData,
    // Whisper
    whisperModels,
    whisperRecommendations,
    whisperStatus,
    downloadWhisperModel,
    deleteWhisperModel,
  } = useLocalModels();

  const [modelToDelete, setModelToDelete] = useState(null);
  const [whisperModelToDelete, setWhisperModelToDelete] = useState(null);
  const [showOtherModels, setShowOtherModels] = useState(false);

  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure();
  const {
    isOpen: isWhisperDeleteOpen,
    onOpen: onWhisperDeleteOpen,
    onClose: onWhisperDeleteClose,
  } = useDisclosure();

  // Parse Apple Silicon info from system specs
  const appleSiliconInfo = useMemo(() => {
    if (!systemSpecs?.cpu_brand) return null;
    return parseAppleSilicon(systemSpecs.cpu_brand);
  }, [systemSpecs]);

  // Handle delete click
  const handleDeleteClick = (filename) => {
    setModelToDelete({ filename });
    onDeleteOpen();
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (modelToDelete?.filename) {
      await deleteLlmModel(modelToDelete.filename);
      setModelToDelete(null);
      onDeleteClose();
    }
  };

  // Handle Whisper model download
  const handleWhisperDownload = async (modelId) => {
    await downloadWhisperModel(modelId);
  };

  // Handle Whisper delete click
  const handleWhisperDeleteClick = (modelId) => {
    setWhisperModelToDelete({ modelId });
    onWhisperDeleteOpen();
  };

  // Confirm Whisper delete
  const confirmWhisperDelete = async () => {
    if (whisperModelToDelete?.modelId) {
      await deleteWhisperModel(whisperModelToDelete.modelId);
      setWhisperModelToDelete(null);
      onWhisperDeleteClose();
    }
  };

  // Check if Whisper model is downloaded
  const isWhisperModelDownloaded = (modelId) => {
    return whisperModels.some((m) => m.id === modelId || m.name === modelId);
  };

  // Check if LLM model is downloaded
  const isModelDownloaded = (modelId) => {
    if (!modelId) return false;
    const model = availableModels.find((m) => m.id === modelId);
    if (!model) return false;
    return models.some((m) => m.filename === model.filename);
  };

  // Get smart recommendations using shared utility
  const smartRecommendations = systemSpecs && availableModels.length > 0
    ? getSmartRecommendations(availableModels, systemSpecs)
    : [];

  // Get other models - ones that don't fit or are deprioritized
  const getOtherModels = () => {
    const recommendedIds = new Set(smartRecommendations.map((m) => m.id));
    return availableModels.filter((m) => !recommendedIds.has(m.id));
  };

  const SmartRecommendationCard = ({ model }) => {
    const isDownloadingLlm =
      isDownloading.llm && downloadingModelId.llm === model.id;
    const llmProgress = isDownloadingLlm ? downloadProgress.llm : null;
    const isDownloaded = isModelDownloaded(model.id);

    const getRecommendationBadge = () => {
      if (model.recommendedType === "fastest")
        return { text: "⚡ Fast", color: "blue" };
      if (model.recommendedType === "recommended")
        return { text: "⭐ Recommended", color: "purple" };
      if (model.recommendedType === "best_quality")
        return { text: "🎯 Best", color: "green" };
      return null;
    };

    const badge = getRecommendationBadge();
    const needsMoreMemory =
      systemSpecs && systemSpecs.total_memory_gb < model.recommended_ram_gb;

    // Get performance tag for Apple Silicon
    const getPerformanceTag = () => {
      if (!appleSiliconInfo || !model.parameters_billions) return null;
      const perf = calculateLLMPerformance(
        appleSiliconInfo.generation,
        appleSiliconInfo.tier,
        model.parameters_billions,
        model.active_parameters_billions,
      );
      return perf.displayText;
    };

    const performanceTag = getPerformanceTag();

    return (
      <Box
        p="4"
        borderRadius="md"
        className="summary-panels"
        borderWidth="2px"
        borderColor={badge?.color === "purple" ? "purple.200" : "gray.200"}
        position="relative"
      >
        <HStack position="absolute" top="-2" right="2" spacing={1}>
          {badge && (
            <Badge colorScheme={badge.color} fontSize="xs">
              {badge.text}
            </Badge>
          )}
          {performanceTag && (
            <Badge colorScheme="gray" fontSize="xs" variant="outline">
              {performanceTag}
            </Badge>
          )}
        </HStack>

        <VStack align="stretch" spacing={3}>
          <VStack align="start" spacing={1}>
            <Text fontSize="md" fontWeight="bold">
              {model.simple_name || model.id}
            </Text>
            <Text fontSize="sm" className="pill-box-icons">
              {model.description}
            </Text>
          </VStack>

          {systemSpecs && (
            <Box>
              <Text fontSize="xs" className="pill-box-icons" mb={1}>
                {needsMoreMemory
                  ? `Needs ${model.recommended_ram_gb}GB RAM (you have ${systemSpecs.total_memory_gb.toFixed(
                      0,
                    )}GB)`
                  : `${model.size_mb}MB • Works on your system`}
              </Text>
              <Progress
                value={Math.min(
                  (model.recommended_ram_gb / systemSpecs.total_memory_gb) *
                    100,
                  100,
                )}
                colorScheme={
                  Math.min(
                    (model.recommended_ram_gb / systemSpecs.total_memory_gb) *
                      100,
                    100,
                  ) >= 80
                    ? "red"
                    : Math.min(
                          (model.recommended_ram_gb /
                            systemSpecs.total_memory_gb) *
                            100,
                          100,
                        ) >= 60
                      ? "yellow"
                      : "green"
                }
                size="sm"
              />
            </Box>
          )}

          {isDownloaded ? (
            <GreenButton size="sm" isDisabled leftIcon={<CheckIcon />}>
              Downloaded
            </GreenButton>
          ) : isDownloadingLlm && llmProgress ? (
            <ModelDownloadProgress progress={llmProgress} />
          ) : (
            <Button
              size="sm"
              onClick={() => downloadLlmModel(model.id)}
              isLoading={isDownloadingLlm && !llmProgress}
              loadingText="Downloading..."
              className="nav-button"
              leftIcon={<DownloadIcon />}
            >
              Download {model.size_mb}MB
            </Button>
          )}
        </VStack>
      </Box>
    );
  };

  const otherModels = getOtherModels();

  if (!localStatus) {
    return (
      <Center>
        <Spinner size="sm" speed="0.65s" />
        <Text ml={2}>Loading...</Text>
      </Center>
    );
  }

  if (!localStatus.available && !localStatus.llama_server_running) {
    return (
      <Alert status="warning" borderRadius="md">
        <AlertIcon as={FaExclamationTriangle} />
        <Box>
          <AlertTitle fontSize="sm">Local Models Not Available</AlertTitle>
          <AlertDescription fontSize="xs">
            Local models are only available in Tauri builds.
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  return (
    <VStack spacing={4} align="stretch" className={className}>
      {/* System Information */}
      {systemSpecs && (
        <HStack
          p="3"
          borderRadius="sm"
          className="panels-bg"
          justify="space-between"
        >
          <HStack>
            <Icon as={FaMemory} className="blue-icon" />
            <Text fontSize="sm">
              {systemSpecs.total_memory_gb.toFixed(1)}GB RAM
            </Text>
          </HStack>
          <HStack>
            <Icon as={FaMicrochip} className="blue-icon" />
            <Text fontSize="sm">{systemSpecs.cpu_count} cores</Text>
          </HStack>
        </HStack>
      )}

      {/* Tabs for LLM and Whisper models */}
      <Tabs variant="enclosed">
        <TabList>
          <Tab>
            <HStack>
              <Icon as={FaMicrochip} />
              <Text>LLM Models</Text>
            </HStack>
          </Tab>
          <Tab>
            <HStack>
              <Icon as={FaMicrophone} />
              <Text>Whisper Models</Text>
            </HStack>
          </Tab>
        </TabList>

        <TabPanels>
          {/* LLM Models Tab */}
          <TabPanel>
            <VStack spacing={4} align="stretch">
              {!localStatus.available && !localStatus?.llama_server_running && (
                <Alert status="warning" borderRadius="md">
                  <AlertIcon as={FaExclamationTriangle} />
                  <Box>
                    <AlertTitle fontSize="sm">
                      Local Models Not Available
                    </AlertTitle>
                    <AlertDescription fontSize="xs">
                      Local models are only available in Tauri builds.
                    </AlertDescription>
                  </Box>
                </Alert>
              )}

              {/* Smart Recommendations */}
              {smartRecommendations.length > 0 && (
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb="3">
                    Choose Your Model
                  </Text>
                  <Text fontSize="xs" className="pill-box-icons" mb="4">
                    We've selected the best options for your system. Most users
                    should choose "Recommended". Only one model can be installed
                    at a time — downloading a new model will replace the current
                    one.
                  </Text>

                  <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                    {smartRecommendations.map((model) => (
                      <SmartRecommendationCard key={model.id} model={model} />
                    ))}
                  </SimpleGrid>
                </Box>
              )}

              {/* Other Models - collapsible */}
              {otherModels.length > 0 && (
                <Box>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowOtherModels(!showOtherModels)}
                    fontSize="xs"
                    className="pill-box-icons"
                  >
                    {showOtherModels ? "▼" : "▶"} Show {otherModels.length} more
                    options
                  </Button>
                  <Collapse in={showOtherModels} animateOpacity>
                    <Box mt="3">
                      <Text fontSize="xs" className="pill-box-icons" mb="3">
                        These models need more memory or may be slower:
                      </Text>
                      <SimpleGrid
                        columns={{ base: 1, md: 2, lg: 3 }}
                        spacing={4}
                      >
                        {otherModels.map((model) => (
                          <SmartRecommendationCard
                            key={model.id}
                            model={model}
                          />
                        ))}
                      </SimpleGrid>
                    </Box>
                  </Collapse>
                </Box>
              )}

              {/* Downloaded Models */}
              <Box>
                <Flex align="center" mb="2">
                  <Text fontSize="sm" fontWeight="semibold">
                    Current Model
                  </Text>
                  <Spacer />
                  <SettingsButton size="xs" onClick={refreshData}>
                    Refresh
                  </SettingsButton>
                </Flex>

                {models.length === 0 ? (
                  <Text fontSize="xs" className="pill-box-icons">
                    No model downloaded. Select a model above to get started.
                  </Text>
                ) : (
                  <Box
                    maxHeight="200px"
                    overflowY="auto"
                    className="custom-scrollbar"
                  >
                    <Table size="sm">
                      <Thead>
                        <Tr>
                          <Th fontSize="xs">Model</Th>
                          <Th fontSize="xs">Size</Th>
                          <Th fontSize="xs">Actions</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {models.map((model) => (
                          <Tr key={model.filename}>
                            <Td>
                              <VStack align="start" spacing={0}>
                                <Text fontSize="xs" fontWeight="bold">
                                  {model.filename}
                                </Text>
                                {model.is_selected && (
                                  <Badge colorScheme="green" size="xs">
                                    Active
                                  </Badge>
                                )}
                              </VStack>
                            </Td>
                            <Td>
                              <Badge colorScheme="purple" size="sm">
                                {model.size_mb
                                  ? `${model.size_mb} MB`
                                  : "Unknown"}
                              </Badge>
                            </Td>
                            <Td>
                              <Tooltip label="Delete model">
                                <IconButton
                                  size="xs"
                                  icon={<DeleteIcon />}
                                  onClick={() =>
                                    handleDeleteClick(model.filename)
                                  }
                                  className="red-button"
                                  variant="outline"
                                />
                              </Tooltip>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                )}
              </Box>
            </VStack>
          </TabPanel>

          {/* Whisper Models Tab */}
          <TabPanel>
            <VStack spacing={4} align="stretch">
              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb="2">
                  Whisper Speech-to-Text Models
                </Text>
                <Text fontSize="xs" className="pill-box-icons">
                  Download a Whisper model for local transcription. Only one
                  model can be installed at a time — downloading a new model
                  will replace the current one.
                </Text>
              </Box>

              {/* Whisper Recommendations */}
              {whisperRecommendations.length > 0 && (
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb="2">
                    Choose Your Transcription Model
                  </Text>
                  <Text fontSize="xs" className="pill-box-icons" mb="4">
                    Only one model can be installed at a time.
                  </Text>
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                    {whisperRecommendations.map((model) => {
                      const isDownloaded = isWhisperModelDownloaded(model.id);
                      const isDownloadingWhisper =
                        isDownloading.whisper &&
                        downloadingModelId.whisper === model.id;
                      const whisperProgress = isDownloadingWhisper
                        ? downloadProgress.whisper
                        : null;

                      return (
                        <Box
                          key={model.id}
                          p="4"
                          borderRadius="md"
                          className="summary-panels"
                          borderWidth="2px"
                          borderColor={
                            model.badge_color === "purple"
                              ? "purple.200"
                              : "gray.200"
                          }
                          position="relative"
                        >
                          {model.badge && (
                            <Badge
                              colorScheme={model.badge_color}
                              fontSize="xs"
                              position="absolute"
                              top="-2"
                              right="2"
                            >
                              {model.badge}
                            </Badge>
                          )}

                          <VStack align="stretch" spacing={3}>
                            <VStack align="start" spacing={1}>
                              <Text fontSize="md" fontWeight="bold">
                                {model.simple_name}
                              </Text>
                              <Text fontSize="xs" className="pill-box-icons">
                                {model.description}
                              </Text>
                              <Text fontSize="xs" className="pill-box-icons">
                                {model.size}
                              </Text>
                            </VStack>

                            {isDownloaded ? (
                              <GreenButton
                                size="sm"
                                isDisabled
                                leftIcon={<CheckIcon />}
                              >
                                Downloaded
                              </GreenButton>
                            ) : isDownloadingWhisper && whisperProgress ? (
                              <ModelDownloadProgress
                                progress={whisperProgress}
                              />
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleWhisperDownload(model.id)}
                                isLoading={
                                  isDownloadingWhisper && !whisperProgress
                                }
                                loadingText="Downloading..."
                                className="nav-button"
                                leftIcon={<DownloadIcon />}
                              >
                                Download {model.size}
                              </Button>
                            )}
                          </VStack>
                        </Box>
                      );
                    })}
                  </SimpleGrid>
                </Box>
              )}

              <Divider />

              {/* Downloaded Whisper Model */}
              <Box>
                <Flex align="center" mb="2">
                  <Text fontSize="sm" fontWeight="semibold">
                    Current Model
                  </Text>
                  <Spacer />
                  <SettingsButton size="xs" onClick={refreshData}>
                    Refresh
                  </SettingsButton>
                </Flex>

                {whisperModels.length === 0 ? (
                  <Text fontSize="xs" className="pill-box-icons">
                    No Whisper model downloaded. Download a model above to
                    enable local transcription.
                  </Text>
                ) : (
                  <HStack
                    spacing={4}
                    p="3"
                    borderWidth="1px"
                    borderRadius="md"
                    borderColor="green.200"
                  >
                    <CheckIcon color="green.500" boxSize={5} />
                    <VStack align="start" spacing={1}>
                      <HStack>
                        <Text fontSize="sm" fontWeight="bold">
                          {whisperModels[0].name || whisperModels[0].id}
                        </Text>
                        <Badge colorScheme="green" size="sm">
                          Active
                        </Badge>
                      </HStack>
                      <Text fontSize="xs" className="pill-box-icons">
                        {whisperModels[0].size_mb
                          ? `${whisperModels[0].size_mb} MB`
                          : "Unknown size"}{" "}
                        •{" "}
                        {whisperModels[0].description ||
                          whisperModels[0].category ||
                          "whisper"}
                      </Text>
                    </VStack>
                    <Spacer />
                    <Tooltip label="Delete model">
                      <IconButton
                        size="xs"
                        icon={<DeleteIcon />}
                        onClick={() =>
                          handleWhisperDeleteClick(whisperModels[0].id)
                        }
                        className="red-button"
                        variant="outline"
                      />
                    </Tooltip>
                  </HStack>
                )}
              </Box>
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Delete Confirmation Modal for LLM models */}
      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose}>
        <ModalOverlay />
        <ModalContent className="modal-style">
          <ModalHeader>Confirm Delete</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            Are you sure you want to delete{" "}
            <Text as="span" fontWeight="bold">
              {modelToDelete?.filename}
            </Text>
            ? This action cannot be undone.
          </ModalBody>
          <ModalFooter>
            <RedButton mr={3} onClick={confirmDelete}>
              Delete
            </RedButton>
            <GreenButton onClick={onDeleteClose}>Cancel</GreenButton>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal for Whisper models */}
      <Modal isOpen={isWhisperDeleteOpen} onClose={onWhisperDeleteClose}>
        <ModalOverlay />
        <ModalContent className="modal-style">
          <ModalHeader>Confirm Delete</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            Are you sure you want to delete the Whisper model{" "}
            <Text as="span" fontWeight="bold">
              {whisperModelToDelete?.modelId}
            </Text>
            ? This action cannot be undone.
          </ModalBody>
          <ModalFooter>
            <RedButton mr={3} onClick={confirmWhisperDelete}>
              Delete
            </RedButton>
            <GreenButton onClick={onWhisperDeleteClose}>Cancel</GreenButton>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
};

export default LocalModelManager;
