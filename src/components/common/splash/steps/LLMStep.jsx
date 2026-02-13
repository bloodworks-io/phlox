import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  VStack,
  Box,
  HStack,
  Button,
  Badge,
  Grid,
  IconButton,
} from "@chakra-ui/react";
import {
  FormControl,
  FormLabel,
  Input,
  Select,
  Tooltip,
  Flex,
  Spinner,
  Text,
  Progress,
  useToast,
} from "@chakra-ui/react";
import { InfoIcon } from "@chakra-ui/icons";
import { FaDesktop, FaCloud } from "react-icons/fa";
import { ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { motion } from "framer-motion";
import { stepVariants } from "../constants";
import { useLLMStep } from "../../../../utils/hooks/splash/useLLMStep";
import { isTauri } from "../../../../utils/helpers/apiConfig";
import { getSmartRecommendations } from "../../../../utils/performanceUtils";
import { invoke } from "@tauri-apps/api/core";

const MotionVStack = motion(VStack);

export { useLLMStep };

const MODELS_PER_PAGE = 3;

// Local Model Card Component
const LocalModelCard = ({
  model,
  isSelected,
  isDownloaded,
  isDownloading,
  downloadProgress,
  onSelect,
  onDownload,
  currentColors,
}) => {
  const getRecommendationBadge = () => {
    if (model.recommendedType === "fastest")
      return { text: "⚡ Fast", color: "blue" };
    if (model.recommendedType === "recommended")
      return { text: "⭐ Recommended", color: "purple" };
    if (model.recommendedType === "best_quality")
      return { text: "🎯 Best", color: "green" };
    if (model.recommendedType === "poor_quality")
      return { text: "Poor quality", color: "orange", tooltip: "Fast but lower quality output" };
    if (model.recommendedType === "slow_performance")
      return { text: "Slow", color: "orange", tooltip: "Not recommended - may run slowly" };
    return null;
  };

  const badge = getRecommendationBadge();

  return (
    <Box
      p="4"
      borderRadius="md"
      className="summary-panels"
      borderWidth="2px"
      borderColor={
        isSelected
          ? currentColors.primaryButton
          : badge?.color === "purple"
            ? "purple.200"
            : "gray.200"
      }
      position="relative"
      cursor={isDownloaded ? "pointer" : "default"}
      onClick={isDownloaded ? onSelect : undefined}
      bg={isSelected ? `${currentColors.primaryButton}15` : "transparent"}
      transition="all 0.2s"
      _hover={
        isDownloaded
          ? { borderColor: currentColors.primaryButton, shadow: "md" }
          : {}
      }
      minH="160px"
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
    >
      <HStack position="absolute" top="-2" right="2" spacing={1}>
        {badge && (
          <Tooltip
            label={badge.tooltip || badge.text}
            placement="top"
            hasArrow
            fontSize="xs"
            bg="gray.700"
            color="white"
          >
            <Badge colorScheme={badge.color} fontSize="xs">
              {badge.text}
            </Badge>
          </Tooltip>
        )}
      </HStack>

      <VStack align="start" spacing={2} flex={1}>
        <Text fontSize="md" fontWeight="bold">
          {model.simple_name || model.id}
        </Text>
        <Text fontSize="sm" className="pill-box-icons">
          {model.description}
        </Text>
        <Text fontSize="xs" className="pill-box-icons" mt={1}>
          {model.size_mb}MB •{" "}
          {model.active_parameters_billions
            ? `${model.active_parameters_billions}B parameters`
            : model.parameters_billions
              ? `${model.parameters_billions}B parameters`
              : ""}
        </Text>
      </VStack>

      {isDownloading && (
        <Box mt={2}>
          <Flex justify="space-between" mb={1}>
            <Text fontSize="xs" className="pill-box-icons">
              Downloading...
            </Text>
            <Text fontSize="xs" className="pill-box-icons">
              {downloadProgress.toFixed(0)}%
            </Text>
          </Flex>
          <Progress
            value={downloadProgress}
            colorScheme="blue"
            size="sm"
            hasStripe
            isAnimated
          />
        </Box>
      )}

      {!isDownloading && isDownloaded && (
        <Button
          size="sm"
          w="full"
          bgColor={isSelected ? currentColors.primaryButton : "gray.200"}
          color={isSelected ? "white" : "gray.700"}
          _hover={{
            bgColor: isSelected ? currentColors.primaryButton : "gray.300",
          }}
          onClick={onSelect}
          mt={2}
        >
          {isSelected ? "Selected" : "Select"}
        </Button>
      )}

      {!isDownloading && !isDownloaded && (
        <Button
          size="sm"
          w="full"
          onClick={onDownload}
          className="switch-mode"
          mt={2}
          sx={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontWeight: "600",
          }}
        >
          Download
        </Button>
      )}
    </Box>
  );
};

export const LLMStep = ({
  llmProvider,
  setLlmProvider,
  llmBaseUrl,
  setLlmBaseUrl,
  primaryModel,
  setPrimaryModel,
  availableModels,
  isFetchingLLMModels,
  fetchLLMModels,
  currentColors,
  // New props for local/remote mode
  inferenceMode,
  setInferenceMode,
  isDesktop,
  localAvailableModels,
  localDownloadedModels,
  primaryLocalModel,
  setPrimaryLocalModel,
  isDownloadingLocal,
  downloadingModelId,
  downloadProgress,
  downloadLocalModel,
  isLocalModelDownloaded,
}) => {
  const toast = useToast();

  // Check if we're on desktop
  const showToggle = isDesktop;

  // Get system specs for smart recommendations (only on desktop)
  const [systemSpecs, setSystemSpecs] = useState(null);

  // Carousel state - track the index of the first visible model
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    if (isDesktop) {
      invoke("get_system_specs")
        .then(setSystemSpecs)
        .catch((err) => console.error("Failed to get system specs:", err));
    }
  }, [isDesktop]);

  // Get smart recommendations using shared utility
  // This now returns ALL models with badges, in correct order
  const allModelsOrdered = getSmartRecommendations(
    localAvailableModels,
    systemSpecs,
  );

  // Memoize model IDs to prevent unnecessary re-renders
  const modelIds = useMemo(() => allModelsOrdered.map(m => m.id).join(','), [allModelsOrdered.map(m => m.id).join(',')]);

  // Find the index of the first recommended model (with fastest/best/recommended badge)
  // We want to start the carousel showing the recommended models
  const firstRecommendedIndex = useMemo(
    () => allModelsOrdered.findIndex(
      (m) => m.recommendedType === "fastest" || m.recommendedType === "recommended" || m.recommendedType === "best_quality"
    ),
    [allModelsOrdered]
  );

  // Carousel state - track the index of the first visible model
  // Start at the first recommended model, or 0 if none found
  const [startIndex, setStartIndex] = useState(firstRecommendedIndex >= 0 ? firstRecommendedIndex : 0);

  // Update startIndex when the recommended models change
  useEffect(() => {
    if (firstRecommendedIndex >= 0) {
      setStartIndex(firstRecommendedIndex);
    }
  }, [firstRecommendedIndex]);

  // Show 3 models at a time, starting from startIndex
  const visibleModels = allModelsOrdered.slice(startIndex, startIndex + MODELS_PER_PAGE);

  const canGoNext = startIndex + MODELS_PER_PAGE < allModelsOrdered.length;
  const canGoPrev = startIndex > 0;

  const handleNext = () => {
    if (canGoNext) setStartIndex(startIndex + 1);
  };

  const handlePrev = () => {
    if (canGoPrev) setStartIndex(startIndex - 1);
  };

  // Handle download with user feedback
  const handleDownload = useCallback(
    async (modelId) => {
      const model = localAvailableModels.find((m) => m.id === modelId);
      if (!model) return;

      // Warn about download size if on low RAM system
      if (
        systemSpecs &&
        systemSpecs.total_memory_gb < (model.recommended_ram_gb || 4)
      ) {
        toast({
          title: "Memory Warning",
          description: `This model requires ${model.recommended_ram_gb}GB RAM but your system has ${systemSpecs.total_memory_gb.toFixed(0)}GB. It may run slowly.`,
          status: "warning",
          duration: 5000,
          isClosable: true,
        });
      }

      downloadLocalModel(modelId);
    },
    [downloadLocalModel, localAvailableModels, systemSpecs, toast],
  );

  return (
    <MotionVStack
      key="llm"
      variants={stepVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      spacing={6}
      w="100%"
    >
      <VStack spacing={4} w="100%">
        {/* Local/Remote Toggle - Desktop Only */}
        {showToggle && (
          <Flex
            className="mode-selector"
            alignItems="center"
            p={1}
            width="100%"
            maxW="600px"
            mx="auto"
          >
            <Box
              className="mode-selector-indicator"
              left={inferenceMode === "local" ? "2px" : "calc(50% - 2px)"}
            />
            <Flex width="full" position="relative" zIndex={1}>
              <Button
                className={`mode-selector-button ${inferenceMode === "local" ? "active" : ""}`}
                leftIcon={<FaDesktop />}
                onClick={() => setInferenceMode("local")}
              >
                Local (Recommended)
              </Button>
              <Button
                className={`mode-selector-button ${inferenceMode === "remote" ? "active" : ""}`}
                leftIcon={<FaCloud />}
                onClick={() => setInferenceMode("remote")}
              >
                Remote (Advanced)
              </Button>
            </Flex>
          </Flex>
        )}

        {/* Local Mode UI */}
        {inferenceMode === "local" && (
          <>
            <Box w="100%" p={4} borderRadius="md" className="floating-main">
              <Text
                fontSize="sm"
                color={currentColors.textSecondary}
                sx={{ fontFamily: '"Roboto", sans-serif' }}
              >
                <strong>Local Mode:</strong> AI models run directly on your
                computer. Your data never leaves your device. Select a model
                below to get started.
              </Text>
            </Box>

            {/* Horizontal grid layout for model cards */}
            <Box w="100%" position="relative">
              {/* Carousel navigation arrows - positioned at edges */}
              {allModelsOrdered.length > MODELS_PER_PAGE && (
                <>
                  <IconButton
                    icon={<ChevronLeftIcon />}
                    isDisabled={!canGoPrev}
                    onClick={handlePrev}
                    aria-label="Smaller models"
                    variant="outline"
                    size="sm"
                    position="absolute"
                    left="-6"
                    top="50%"
                    transform="translateY(-50%)"
                    zIndex="1"
                    bg="white"
                    _dark={{ bg: "gray.800" }}
                  />
                  <IconButton
                    icon={<ChevronRightIcon />}
                    isDisabled={!canGoNext}
                    onClick={handleNext}
                    aria-label="Larger models"
                    variant="outline"
                    size="sm"
                    position="absolute"
                    right="-4"
                    top="50%"
                    transform="translateY(-50%)"
                    zIndex="1"
                    bg="white"
                    _dark={{ bg: "gray.800" }}
                  />
                </>
              )}

              <Grid
                templateColumns={{
                  base: "1fr",
                  md: visibleModels.length === 3
                    ? "repeat(3, 1fr)"
                    : "repeat(2, 1fr)",
                }}
                gap={4}
                w="100%"
              >
                {visibleModels.map((model) => (
                  <LocalModelCard
                    key={model.id}
                    model={model}
                    isSelected={primaryLocalModel === model.filename}
                    isDownloaded={isLocalModelDownloaded(model.id)}
                    isDownloading={
                      isDownloadingLocal && downloadingModelId === model.id
                    }
                    downloadProgress={downloadProgress}
                    onSelect={() => setPrimaryLocalModel(model.filename)}
                    onDownload={() => handleDownload(model.id)}
                    currentColors={currentColors}
                  />
                ))}
              </Grid>
            </Box>

            {/* Info message about download */}
            {!allModelsOrdered.some((m) => isLocalModelDownloaded(m.id)) && (
              <Box
                w="100%"
                p={3}
                borderRadius="md"
                bg="blue.50"
                borderWidth="1px"
                borderColor="blue.200"
              >
                <Text fontSize="sm" color="blue.700">
                  💡 Select a model and click "Download" to get started. You
                  can proceed once the download is complete.
                </Text>
              </Box>
            )}
          </>
        )}

        {/* Remote Mode UI */}
        {inferenceMode === "remote" && (
          <>
            <FormControl>
              <HStack>
                <FormLabel
                  color={currentColors.textSecondary}
                  sx={{
                    fontFamily: '"Roboto", sans-serif',
                    fontSize: "sm",
                    fontWeight: "500",
                  }}
                >
                  LLM Provider
                </FormLabel>
                <Tooltip
                  label="Choose between Ollama (local models) or OpenAI-compatible APIs (like OpenAI, Anthropic, etc.)"
                  placement="top"
                  hasArrow
                  fontSize="xs"
                  bg="gray.700"
                  color="white"
                >
                  <InfoIcon boxSize={3} color={currentColors.textSecondary} />
                </Tooltip>
              </HStack>
              <Select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value)}
                className="input-style"
                size="md"
              >
                <option value="ollama">Ollama (Local)</option>
                <option value="openai">OpenAI-compatible API</option>
              </Select>
            </FormControl>

            <FormControl>
              <HStack>
                <FormLabel
                  color={currentColors.textSecondary}
                  sx={{
                    fontFamily: '"Roboto", sans-serif',
                    fontSize: "sm",
                    fontWeight: "500",
                  }}
                >
                  LLM Base URL
                </FormLabel>
                <Tooltip
                  label={
                    llmProvider === "ollama"
                      ? "The URL where your Ollama server is running (usually http://localhost:11434)"
                      : "The API endpoint for your OpenAI-compatible service"
                  }
                  placement="top"
                  hasArrow
                  fontSize="xs"
                  bg="gray.700"
                  color="white"
                >
                  <InfoIcon boxSize={3} color={currentColors.textSecondary} />
                </Tooltip>
              </HStack>
              <Input
                placeholder={
                  llmProvider === "openai"
                    ? "e.g., https://api.openai.com/v1"
                    : "e.g., http://localhost:11434"
                }
                value={llmBaseUrl}
                onChange={(e) => {
                  setLlmBaseUrl(e.target.value);
                }}
                onBlur={fetchLLMModels}
                className="input-style"
                size="md"
              />
            </FormControl>

            <FormControl isRequired={availableModels.length > 0}>
              <HStack>
                <FormLabel
                  color={currentColors.textSecondary}
                  sx={{
                    fontFamily: '"Roboto", sans-serif',
                    fontSize: "sm",
                    fontWeight: "500",
                  }}
                >
                  Primary Model
                </FormLabel>
                <Tooltip
                  label="The main AI model that will handle your medical queries. We recommend models like llama3.1:8b or gpt-4 for medical use."
                  placement="top"
                  hasArrow
                  fontSize="xs"
                  bg="gray.700"
                  color="white"
                >
                  <InfoIcon boxSize={3} color={currentColors.textSecondary} />
                </Tooltip>
              </HStack>
              <Select
                placeholder={
                  availableModels.length === 0 && !isFetchingLLMModels
                    ? "No models found - check URL and server status"
                    : "Select primary model"
                }
                value={primaryModel}
                onChange={(e) => setPrimaryModel(e.target.value)}
                isDisabled={
                  isFetchingLLMModels || availableModels.length === 0
                }
                className="input-style"
                size="md"
              >
                {availableModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </Select>
              {isFetchingLLMModels && (
                <Flex align="center" mt={2}>
                  <Spinner size="xs" mr={2} color={currentColors.primaryButton} />
                  <Text
                    fontSize="sm"
                    color={currentColors.textSecondary}
                    sx={{ fontFamily: '"Roboto", sans-serif' }}
                  >
                    Loading available models...
                  </Text>
                </Flex>
              )}
              {!isFetchingLLMModels &&
                availableModels.length === 0 &&
                llmBaseUrl.trim() && (
                  <Text
                    fontSize="sm"
                    color={currentColors.secondaryButton}
                    mt={2}
                    sx={{ fontFamily: '"Roboto", sans-serif' }}
                  >
                    No models found. Please check the URL and ensure your
                    server is running.
                  </Text>
                )}
            </FormControl>
          </>
        )}
      </VStack>
    </MotionVStack>
  );
};
