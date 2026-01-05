import React, { useState } from "react";
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
  SearchIcon,
  CheckIcon,
  WarningIcon,
} from "@chakra-ui/icons";
import {
  GreenButton,
  GreyButton,
  RedButton,
  SettingsButton,
} from "../common/Buttons";
import { useLocalModels } from "../../utils/hooks/useLocalModels";
import { localModelHelpers } from "../../utils/helpers/localModelHelpers";

const LocalModelManager = ({ className }) => {
  const {
    models,
    searchResults,
    loading,
    searchQuery,
    setSearchQuery,
    selectedRepo,
    setSelectedRepo,
    repoFiles,
    localStatus,
    systemSpecs,
    modelRecommendations,
    pullingModel,
    ollamaModels,
    searchModels,
    fetchRepoFiles,
    pullOllamaModel,
    downloadModel,
    deleteModel,
    refreshData,
    // Whisper
    whisperModels,
    whisperRecommendations,
    whisperStatus,
    pullingWhisperModel,
    downloadWhisperModel,
    deleteWhisperModel,
  } = useLocalModels();

  const [modelToDelete, setModelToDelete] = useState(null);
  const [whisperModelToDelete, setWhisperModelToDelete] = useState(null);

  const { isOpen, onOpen, onClose } = useDisclosure();
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

  // Handle search
  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchModels(searchQuery);
    }
  };

  // Handle repository file selection
  const handleRepoSelection = async (repoId) => {
    setSelectedRepo(repoId);
    await fetchRepoFiles(repoId);
    onOpen();
  };

  // Handle model download
  const handleDownload = async (repoId, filename) => {
    await downloadModel(repoId, filename);
    onClose();
  };

  // Handle delete click
  const handleDeleteClick = (filename) => {
    setModelToDelete({ filename });
    onDeleteOpen();
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (modelToDelete?.filename) {
      await deleteModel(modelToDelete.filename);
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

  // Fixed: More precise model download detection
  const isModelDownloaded = (modelName) => {
    if (!modelName) return false;

    const normalizedModelName = modelName.toLowerCase().replace(/[:\-_]/g, "");

    // Check Ollama models
    const ollamaMatch = ollamaModels.some((m) => {
      if (!m || !m.name) return false;
      const ollamaName = m.name.toLowerCase().replace(/[:\-_]/g, "");
      return (
        ollamaName === normalizedModelName ||
        ollamaName.startsWith(normalizedModelName) ||
        normalizedModelName.startsWith(ollamaName)
      );
    });

    // Check local GGUF models
    const localMatch = models.some((m) => {
      if (!m || !m.filename) return false;
      const fileName = m.filename.toLowerCase().replace(/[:\-_]/g, "");
      return (
        fileName.includes(normalizedModelName) ||
        normalizedModelName.includes(fileName)
      );
    });

    return ollamaMatch || localMatch;
  };

  // Fixed: Better smart recommendations logic
  const getSmartRecommendations = () => {
    if (!systemSpecs || !modelRecommendations.length) return [];

    const availableRAM = systemSpecs.total_memory_gb;

    // Filter models that fit within recommended RAM
    const wellSuitedModels = modelRecommendations.filter(
      (model) => availableRAM >= model.recommended_ram_gb,
    );

    // Fallback to models that meet minimum RAM
    const minimalModels = modelRecommendations.filter(
      (model) =>
        availableRAM >= model.min_ram_gb &&
        availableRAM < model.recommended_ram_gb,
    );

    const recommendations = [];
    const addedModelNames = new Set();

    const addModel = (model, type, isLimited = false) => {
      if (model && !addedModelNames.has(model.name)) {
        recommendations.push({
          ...model,
          recommendedType: type,
          isLimited,
        });
        addedModelNames.add(model.name);
        return true;
      }
      return false;
    };

    // Prioritize well-suited models
    if (wellSuitedModels.length > 0) {
      // 1. FASTEST: Smallest model by RAM requirement
      const fastModel = wellSuitedModels
        .filter((m) => m.category === "fast" || m.category === "small")
        .sort((a, b) => a.recommended_ram_gb - b.recommended_ram_gb)[0];

      if (fastModel) addModel(fastModel, "fastest");

      // 2. RECOMMENDED: Medium/balanced model - look for medium category or mid-range models
      const recommendedModel = wellSuitedModels
        .filter((m) => !addedModelNames.has(m.name))
        .filter(
          (m) =>
            m.category === "medium" ||
            (m.recommended_ram_gb >= 6 && m.recommended_ram_gb <= 14),
        )
        .sort((a, b) => {
          // Prefer models using ~50% of available RAM (12GB out of 24GB)
          const aDistance = Math.abs(a.recommended_ram_gb - availableRAM * 0.5);
          const bDistance = Math.abs(b.recommended_ram_gb - availableRAM * 0.5);
          return aDistance - bDistance;
        })[0];

      if (recommendedModel) {
        addModel(recommendedModel, "recommended");
      } else {
        // Fallback: Pick the second smallest model as recommended
        const fallbackRecommended = wellSuitedModels
          .filter((m) => !addedModelNames.has(m.name))
          .sort((a, b) => a.recommended_ram_gb - b.recommended_ram_gb)[0];
        if (fallbackRecommended) addModel(fallbackRecommended, "recommended");
      }

      // 3. BEST QUALITY: Largest model that fits
      const qualityModel = wellSuitedModels
        .filter((m) => !addedModelNames.has(m.name))
        .sort((a, b) => b.recommended_ram_gb - a.recommended_ram_gb)[0];

      if (qualityModel) addModel(qualityModel, "best_quality");
    }

    // If we still don't have 3, add from minimal models with warning
    if (recommendations.length < 3 && minimalModels.length > 0) {
      const remainingSlots = 3 - recommendations.length;
      const bestMinimalModels = minimalModels
        .filter((m) => !addedModelNames.has(m.name))
        .sort((a, b) => a.min_ram_gb - b.min_ram_gb)
        .slice(0, remainingSlots);

      bestMinimalModels.forEach((model, index) => {
        if (recommendations.length === 0) {
          addModel(model, "fastest", true);
        } else if (recommendations.length === 1) {
          addModel(model, "recommended", true);
        } else {
          addModel(model, "best_quality", true);
        }
      });
    }

    return recommendations.slice(0, 3);
  };

  const SmartRecommendationCard = ({ model }) => {
    const isPulling = pullingModel === model.name;
    const isDownloaded = isModelDownloaded(model.name);
    const compatibility = localModelHelpers.isModelCompatible(
      model,
      systemSpecs,
    );

    const getRecommendationBadge = () => {
      if (model.recommendedType === "fastest")
        return { text: "⚡ Fastest", color: "blue" };
      if (model.recommendedType === "recommended")
        return { text: "⭐ Recommended", color: "purple" };
      if (model.recommendedType === "best_quality")
        return { text: "🎯 Best Quality", color: "green" };
      return null;
    };

    const badge = getRecommendationBadge();

    return (
      <Box
        p="4"
        borderRadius="md"
        className="summary-panels"
        borderWidth="2px"
        borderColor={badge?.color === "purple" ? "purple.200" : "gray.200"}
        position="relative"
        opacity={model.isLimited ? 0.8 : 1}
      >
        <HStack position="absolute" top="-2" right="2" spacing={1}>
          {badge && (
            <Badge colorScheme={badge.color} fontSize="xs">
              {badge.text}
            </Badge>
          )}
          {(model.isLimited || !compatibility.compatible) && (
            <Badge colorScheme="yellow" fontSize="xs">
              ⚠️ Limited
            </Badge>
          )}
        </HStack>

        <VStack align="stretch" spacing={3}>
          <VStack align="start" spacing={1}>
            <Text fontSize="md" fontWeight="bold">
              {model.display_name}
            </Text>
            <Text fontSize="sm" className="pill-box-icons">
              {model.size} • {model.speed} • {model.quality}
            </Text>
            <Text fontSize="xs" className="pill-box-icons">
              {model.use_case}
            </Text>
            {(model.isLimited || !compatibility.compatible) && (
              <Text fontSize="xs" className="yellow-icon">
                {model.isLimited
                  ? "May run slower than optimal"
                  : compatibility.reason}
              </Text>
            )}
          </VStack>

          {systemSpecs && (
            <Box>
              <Text fontSize="xs" className="pill-box-icons" mb={1}>
                Needs {model.recommended_ram_gb}GB RAM (you have{" "}
                {systemSpecs.total_memory_gb.toFixed(1)}GB)
              </Text>
              <Progress
                value={Math.min(
                  (systemSpecs.total_memory_gb / model.recommended_ram_gb) *
                    100,
                  100,
                )}
                colorScheme={
                  compatibility.compatible && !model.isLimited
                    ? "green"
                    : "yellow"
                }
                size="sm"
              />
            </Box>
          )}

          {isDownloaded ? (
            <GreenButton size="sm" isDisabled leftIcon={<CheckIcon />}>
              Downloaded
            </GreenButton>
          ) : (
            <Button
              size="sm"
              onClick={() => pullOllamaModel(model.name)}
              isLoading={isPulling}
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
  };

  const smartRecommendations = getSmartRecommendations();

  if (!localStatus) {
    return (
      <Center>
        <Spinner size="sm" speed="0.65s" />
        <Text ml={2}>Loading...</Text>
      </Center>
    );
  }

  if (!localStatus.available && !localStatus.ollama_running) {
    return (
      <Alert status="warning" borderRadius="md">
        <AlertIcon as={FaExclamationTriangle} />
        <Box>
          <AlertTitle fontSize="sm">Local Models Not Available</AlertTitle>
          <AlertDescription fontSize="xs">
            {localStatus.reason}
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
              {!localStatus.available && !localStatus?.ollama_running && (
                <Alert status="warning" borderRadius="md">
                  <AlertIcon as={FaExclamationTriangle} />
                  <Box>
                    <AlertTitle fontSize="sm">
                      Local Models Not Available
                    </AlertTitle>
                    <AlertDescription fontSize="xs">
                      {localStatus?.reason}
                    </AlertDescription>
                  </Box>
                </Alert>
              )}

              {!localStatus.available && localStatus?.ollama_running && (
                <Alert status="info" borderRadius="md" size="sm">
                  <AlertIcon />
                  <Box>
                    <AlertDescription fontSize="xs">
                      Ollama is running but local inference may have limited
                      functionality. You can still download and manage models.
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
                    We've selected the best 3 options for your system. Most
                    users should choose "Recommended".
                  </Text>

                  <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                    {smartRecommendations.map((model) => (
                      <SmartRecommendationCard key={model.name} model={model} />
                    ))}
                  </SimpleGrid>
                </Box>
              )}

              <Divider />

              {/* Search Section */}
              <Box>
                <Text fontSize="sm" mb="2" fontWeight="semibold">
                  Search Other Hugging Face Models
                </Text>
                <HStack>
                  <Input
                    size="sm"
                    placeholder="Search for models (e.g., 'llama', 'mistral', 'codellama')"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                    className="input-style"
                  />
                  <Button
                    size="sm"
                    leftIcon={<SearchIcon />}
                    onClick={handleSearch}
                    isLoading={loading}
                    className="nav-button"
                  >
                    Search
                  </Button>
                </HStack>
              </Box>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <Box>
                  <Text fontSize="sm" mb="2" fontWeight="semibold">
                    Search Results
                  </Text>
                  <Box
                    maxHeight="200px"
                    overflowY="auto"
                    className="custom-scrollbar"
                  >
                    <Table size="sm">
                      <Thead>
                        <Tr>
                          <Th fontSize="xs">Model</Th>
                          <Th fontSize="xs">Downloads</Th>
                          <Th fontSize="xs">Actions</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {searchResults.map((model) => (
                          <Tr key={model.repo_id}>
                            <Td>
                              <VStack align="start" spacing={0}>
                                <Text fontSize="xs" fontWeight="bold">
                                  {model.repo_id}
                                </Text>
                                <Text fontSize="xs" className="pill-box-icons">
                                  by {model.author}
                                </Text>
                              </VStack>
                            </Td>
                            <Td>
                              <Text fontSize="xs">
                                {model.downloads?.toLocaleString()}
                              </Text>
                            </Td>
                            <Td>
                              <GreenButton
                                size="xs"
                                leftIcon={<DownloadIcon />}
                                onClick={() =>
                                  handleRepoSelection(model.repo_id)
                                }
                              >
                                Download
                              </GreenButton>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                </Box>
              )}

              {/* Downloaded Models */}
              <Box>
                <Flex align="center" mb="2">
                  <Text fontSize="sm" fontWeight="semibold">
                    Downloaded Models
                  </Text>
                  <Spacer />
                  <SettingsButton size="xs" onClick={refreshData}>
                    Refresh
                  </SettingsButton>
                </Flex>

                {ollamaModels.length === 0 && models.length === 0 ? (
                  <Text fontSize="xs" className="pill-box-icons">
                    No models downloaded yet
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
                          <Th fontSize="xs">Type</Th>
                          <Th fontSize="xs">Actions</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {/* Ollama Models */}
                        {ollamaModels.map((model) => (
                          <Tr key={`ollama-${model.name}`}>
                            <Td>
                              <Text fontSize="xs" fontWeight="bold">
                                {model.name}
                              </Text>
                            </Td>
                            <Td>
                              <Badge colorScheme="green" size="sm">
                                {model.size
                                  ? localModelHelpers.formatModelSize(
                                      model.size,
                                    )
                                  : "Unknown"}
                              </Badge>
                            </Td>
                            <Td>
                              <Badge colorScheme="blue" size="sm">
                                Ollama
                              </Badge>
                            </Td>
                            <Td>
                              <Tooltip label="Delete model">
                                <IconButton
                                  size="xs"
                                  icon={<DeleteIcon />}
                                  onClick={() => handleDeleteClick(model.name)}
                                  className="red-button"
                                  variant="outline"
                                />
                              </Tooltip>
                            </Td>
                          </Tr>
                        ))}
                        {/* HuggingFace Models */}
                        {models.map((model) => (
                          <Tr key={`hf-${model.filename}`}>
                            <Td>
                              <Text fontSize="xs" fontWeight="bold">
                                {model.filename}
                              </Text>
                            </Td>
                            <Td>
                              <Badge colorScheme="purple" size="sm">
                                {model.size_mb
                                  ? `${model.size_mb} MB`
                                  : "Unknown"}
                              </Badge>
                            </Td>
                            <Td>
                              <Badge colorScheme="orange" size="sm">
                                GGUF
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
                  <Flex align="center" mb="3">
                    <Text fontSize="sm" fontWeight="semibold">
                      Available Models
                    </Text>
                    <Badge ml="2" colorScheme="orange" fontSize="xs">
                      Downloading will replace current model
                    </Badge>
                  </Flex>
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                    {whisperRecommendations.map((model) => {
                      const isDownloaded = isWhisperModelDownloaded(model.id);
                      const isPulling = pullingWhisperModel === model.id;

                      return (
                        <Box
                          key={model.id}
                          p="4"
                          borderRadius="md"
                          className="summary-panels"
                          borderWidth="2px"
                          borderColor={
                            model.recommended ? "purple.200" : "gray.200"
                          }
                          position="relative"
                        >
                          {model.recommended && (
                            <Badge
                              colorScheme="purple"
                              fontSize="xs"
                              position="absolute"
                              top="-2"
                              right="2"
                            >
                              Recommended
                            </Badge>
                          )}

                          <VStack align="stretch" spacing={3}>
                            <VStack align="start" spacing={1}>
                              <Text fontSize="md" fontWeight="bold">
                                {model.display_name}
                              </Text>
                              <Text fontSize="sm" className="pill-box-icons">
                                {model.size} • {model.quality} • {model.speed}
                              </Text>
                              <Text fontSize="xs" className="pill-box-icons">
                                {model.description}
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
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleWhisperDownload(model.id)}
                                isLoading={isPulling}
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

      {/* Download Modal for HuggingFace models */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent className="modal-style">
          <ModalHeader>Download Model: {selectedRepo}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Text fontSize="sm">
                Choose a quantization level. Q4_K_M is recommended for most use
                cases.
              </Text>

              {Object.entries(repoFiles).map(([quantType, files]) => (
                <Box key={quantType}>
                  <Text fontSize="sm" fontWeight="bold" mb="2">
                    {quantType}
                  </Text>
                  {files.map((file) => (
                    <HStack key={file} mb="2">
                      <Text fontSize="sm" flex="1">
                        {file}
                      </Text>
                      <Button
                        size="sm"
                        onClick={() => handleDownload(selectedRepo, file)}
                        isLoading={loading}
                        className="nav-button"
                      >
                        Download
                      </Button>
                    </HStack>
                  ))}
                </Box>
              ))}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <GreyButton onClick={onClose}>Cancel</GreyButton>
          </ModalFooter>
        </ModalContent>
      </Modal>

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
