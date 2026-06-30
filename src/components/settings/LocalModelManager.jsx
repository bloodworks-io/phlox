import React, { useState, useMemo } from "react";
import { Box, VStack, HStack, Text, Button, Table, IconButton, useDisclosure, Spinner, Badge, Alert, Flex, Spacer, Progress, SimpleGrid, Icon, Center, Tabs, Collapsible, Separator, Dialog, Portal } from "@chakra-ui/react";
import { Tooltip } from '@/components/ui/tooltip';
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
} from "../common/icons";
import {
  GreenButton,
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
    open: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure();
  const {
    open: isWhisperDeleteOpen,
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
        <HStack position="absolute" top="-2" right="2" gap={1}>
          {badge && (
            <Badge colorPalette={badge.color} fontSize="xs">
              {badge.text}
            </Badge>
          )}
          {performanceTag && (
            <Badge colorPalette="gray" fontSize="xs" variant="outline">
              {performanceTag}
            </Badge>
          )}
        </HStack>
        <VStack align="stretch" gap={3}>
          <VStack align="start" gap={1}>
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
              <Progress.Root
                value={Math.min(
                  (model.recommended_ram_gb / systemSpecs.total_memory_gb) *
                    100,
                  100,
                )}
                colorPalette={
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
                size="sm">
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>
            </Box>
          )}

          {isDownloaded ? (
            <GreenButton size="sm" disabled leftIcon={<CheckIcon />}>
              Downloaded
            </GreenButton>
          ) : isDownloadingLlm && llmProgress ? (
            <ModelDownloadProgress progress={llmProgress} />
          ) : (
            <Button
              size="sm"
              onClick={() => downloadLlmModel(model.id)}
              loading={isDownloadingLlm && !llmProgress}
              loadingText="Downloading..."
              className="nav-button"><DownloadIcon />Download {model.size_mb}MB
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
        <Spinner size="sm" animationDuration="0.65s" />
        <Text ml={2}>Loading...</Text>
      </Center>
    );
  }

  if (!localStatus.available && !localStatus.llama_server_running) {
    return (
      <Alert.Root status="warning" borderRadius="md">
        <Alert.Indicator asChild><FaExclamationTriangle /></Alert.Indicator>
        <Box>
          <Alert.Title fontSize="sm">Local Models Not Available</Alert.Title>
          <Alert.Description fontSize="xs">
            Local models are only available in Tauri builds.
          </Alert.Description>
        </Box>
      </Alert.Root>
    );
  }

  return (
    <VStack gap={4} align="stretch" className={className}>
      {/* System Information */}
      {systemSpecs && (
        <HStack
          p="3"
          borderRadius="sm"
          className="panels-bg"
          justify="space-between"
        >
          <HStack>
            <Icon className="blue-icon" asChild><FaMemory /></Icon>
            <Text fontSize="sm">
              {systemSpecs.total_memory_gb.toFixed(1)}GB RAM
            </Text>
          </HStack>
          <HStack>
            <Icon className="blue-icon" asChild><FaMicrochip /></Icon>
            <Text fontSize="sm">{systemSpecs.cpu_count} cores</Text>
          </HStack>
        </HStack>
      )}
      {/* Tabs for LLM and Whisper models */}
      <Tabs.Root variant='enclosed' defaultValue="0">
        <Tabs.List>
          <Tabs.Trigger value="0">
            <HStack>
              <Icon asChild><FaMicrochip /></Icon>
              <Text>LLM Models</Text>
            </HStack>
          </Tabs.Trigger>
          <Tabs.Trigger value="1">
            <HStack>
              <Icon asChild><FaMicrophone /></Icon>
              <Text>Whisper Models</Text>
            </HStack>
          </Tabs.Trigger>
        </Tabs.List>

        
          {/* LLM Models Tab */}
          <Tabs.Content value="0">
            <VStack gap={4} align="stretch">
              {!localStatus.available && !localStatus?.llama_server_running && (
                <Alert.Root status="warning" borderRadius="md">
                  <Alert.Indicator asChild><FaExclamationTriangle /></Alert.Indicator>
                  <Box>
                    <Alert.Title fontSize="sm">
                      Local Models Not Available
                    </Alert.Title>
                    <Alert.Description fontSize="xs">
                      Local models are only available in Tauri builds.
                    </Alert.Description>
                  </Box>
                </Alert.Root>
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

                  <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
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
                  <Collapsible.Root open={showOtherModels}>
                    <Collapsible.Content>
                      <Box mt="3">
                        <Text fontSize="xs" className="pill-box-icons" mb="3">
                          These models need more memory or may be slower:
                        </Text>
                        <SimpleGrid
                          columns={{ base: 1, md: 2, lg: 3 }}
                          gap={4}
                        >
                          {otherModels.map((model) => (
                            <SmartRecommendationCard
                              key={model.id}
                              model={model}
                            />
                          ))}
                        </SimpleGrid>
                      </Box>
                    </Collapsible.Content>
                  </Collapsible.Root>
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
                    <Table.Root size="sm">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeader fontSize="xs">Model</Table.ColumnHeader>
                          <Table.ColumnHeader fontSize="xs">Size</Table.ColumnHeader>
                          <Table.ColumnHeader fontSize="xs">Actions</Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {models.map((model) => (
                          <Table.Row key={model.filename}>
                            <Table.Cell>
                              <VStack align="start" gap={0}>
                                <Text fontSize="xs" fontWeight="bold">
                                  {model.filename}
                                </Text>
                                {model.is_selected && (
                                  <Badge colorPalette="green" size="xs">
                                    Active
                                  </Badge>
                                )}
                              </VStack>
                            </Table.Cell>
                            <Table.Cell>
                              <Badge colorPalette="purple" size="sm">
                                {model.size_mb
                                  ? `${model.size_mb} MB`
                                  : "Unknown"}
                              </Badge>
                            </Table.Cell>
                            <Table.Cell>
                              <Tooltip content="Delete model">
                                <IconButton
                                  size="xs"
                                  onClick={() =>
                                    handleDeleteClick(model.filename)
                                  }
                                  className="red-button"
                                  variant="outline"><DeleteIcon /></IconButton>
                              </Tooltip>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  </Box>
                )}
              </Box>
            </VStack>
          </Tabs.Content>

          {/* Whisper Models Tab */}
          <Tabs.Content value="1">
            <VStack gap={4} align="stretch">
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
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
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
                              colorPalette={model.badge_color}
                              fontSize="xs"
                              position="absolute"
                              top="-2"
                              right="2"
                            >
                              {model.badge}
                            </Badge>
                          )}
                          <VStack align="stretch" gap={3}>
                            <VStack align="start" gap={1}>
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
                                disabled
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
                                loading={
                                  isDownloadingWhisper && !whisperProgress
                                }
                                loadingText="Downloading..."
                                className="nav-button"><DownloadIcon />
                                Download {model.size}</Button>
                            )}
                          </VStack>
                        </Box>
                      );
                    })}
                  </SimpleGrid>
                </Box>
              )}

              <Separator />

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
                    gap={4}
                    p="3"
                    borderWidth="1px"
                    borderRadius="md"
                    borderColor="green.200"
                  >
                    <CheckIcon color="green.500" boxSize={5} />
                    <VStack align="start" gap={1}>
                      <HStack>
                        <Text fontSize="sm" fontWeight="bold">
                          {whisperModels[0].name || whisperModels[0].id}
                        </Text>
                        <Badge colorPalette="green" size="sm">
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
                    <Tooltip content="Delete model">
                      <IconButton
                        size="xs"
                        onClick={() =>
                          handleWhisperDeleteClick(whisperModels[0].id)
                        }
                        className="red-button"
                        variant="outline"><DeleteIcon /></IconButton>
                    </Tooltip>
                  </HStack>
                )}
              </Box>
            </VStack>
          </Tabs.Content>
        
      </Tabs.Root>
      {/* Delete Confirmation Modal for LLM models */}
      <Dialog.Root open={isDeleteOpen} onOpenChange={e => {
        if (!e.open) {
          onDeleteClose();
        }
      }}>
        <Portal>

          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content className="modal-style">
              <Dialog.Header>Confirm Delete</Dialog.Header>
              <Dialog.CloseTrigger />
              <Dialog.Body>
                Are you sure you want to delete{" "}
                <Text as="span" fontWeight="bold">
                  {modelToDelete?.filename}
                </Text>
                ? This action cannot be undone.
              </Dialog.Body>
              <Dialog.Footer>
                <RedButton mr={3} onClick={confirmDelete}>
                  Delete
                </RedButton>
                <GreenButton onClick={onDeleteClose}>Cancel</GreenButton>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>

        </Portal>
      </Dialog.Root>
      {/* Delete Confirmation Modal for Whisper models */}
      <Dialog.Root open={isWhisperDeleteOpen} onOpenChange={e => {
        if (!e.open) {
          onWhisperDeleteClose();
        }
      }}>
        <Portal>

          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content className="modal-style">
              <Dialog.Header>Confirm Delete</Dialog.Header>
              <Dialog.CloseTrigger />
              <Dialog.Body>
                Are you sure you want to delete the Whisper model{" "}
                <Text as="span" fontWeight="bold">
                  {whisperModelToDelete?.modelId}
                </Text>
                ? This action cannot be undone.
              </Dialog.Body>
              <Dialog.Footer>
                <RedButton mr={3} onClick={confirmWhisperDelete}>
                  Delete
                </RedButton>
                <GreenButton onClick={onWhisperDeleteClose}>Cancel</GreenButton>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>

        </Portal>
      </Dialog.Root>
    </VStack>
  );
};

export default LocalModelManager;
