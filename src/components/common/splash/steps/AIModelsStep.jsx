import { useState, useEffect, useCallback, useMemo } from "react";
import {
  VStack,
  HStack,
  Flex,
  Box,
  Text,
  Button,
  Badge,
  Input,
  NativeSelect,
  Field,
  Progress,
  Spinner,
  Popover,
  Grid,
  Portal,
  IconButton,
} from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import {
  InfoIcon,
  DownloadIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "../../icons";
import {
  FaDesktop,
  FaCloud,
  FaMicrophone,
  FaDatabase,
  FaStar,
} from "react-icons/fa";
import { GreenButton, NavButton } from "../../Buttons";
import { getSmartRecommendations } from "../../../../utils/performanceUtils";
import { downloadEmbeddingModel as downloadEmbeddingService } from "../../../../utils/services/localModelService";
import { setEmbeddingReady } from "../../../../utils/helpers/featureFlags";
import { invoke } from "@tauri-apps/api/core";

const MODELS_PER_PAGE = 3;

const RECOMMENDED_WHISPER = {
  id: "base",
  name: "Whisper Base",
  size_mb: 74,
};

const RECOMMENDED_EMBEDDING = {
  id: "qwen3-embedding-0.6b",
  name: "Qwen3 Embedding 0.6B",
  size_mb: 639,
};

const getBadge = (recommendedType) => {
  if (recommendedType === "fastest") return { text: "⚡ Fast", color: "blue" };
  if (recommendedType === "recommended")
    return { text: "⭐ Recommended", color: "purple" };
  if (recommendedType === "best_quality")
    return { text: "🎯 Best", color: "green" };
  if (recommendedType === "poor_quality")
    return { text: "Basic", color: "orange" };
  if (recommendedType === "slow_performance")
    return { text: "Slow", color: "orange" };
  return null;
};

// Performance info popover — info icon is the trigger
const PerformancePopover = ({ model, systemSpecs }) => (
  <Popover.Root positioning={{ placement: "top", offset: { mainAxis: 4 } }}>
    <Popover.Trigger asChild>
      <Box
        cursor="pointer"
        onClick={(e) => e.stopPropagation()}
        display="flex"
        alignItems="center"
        color="textSecondary"
        _hover={{ color: "primaryButton" }}
        transition="color 0.15s"
      >
        <InfoIcon boxSize={3.5} />
      </Box>
    </Popover.Trigger>
    <Portal>
      <Popover.Positioner>
        <Popover.Content w="200px">
          <Popover.Arrow>
            <Popover.ArrowTip />
          </Popover.Arrow>
          <Popover.Body p={3}>
            <VStack gap={1} align="stretch">
              <HStack justify="space-between">
                <Text fontSize="xs" className="pill-box-icons">
                  Size
                </Text>
                <Text fontSize="xs" fontWeight="bold">
                  {model.size_mb}MB
                </Text>
              </HStack>
              {(model.active_parameters_billions ||
                model.parameters_billions) && (
                <HStack justify="space-between">
                  <Text fontSize="xs" className="pill-box-icons">
                    Parameters
                  </Text>
                  <Text fontSize="xs" fontWeight="bold">
                    {model.active_parameters_billions
                      ? `${model.active_parameters_billions}B`
                      : `${model.parameters_billions}B`}
                  </Text>
                </HStack>
              )}
              {model.recommended_ram_gb && (
                <HStack justify="space-between">
                  <Text fontSize="xs" className="pill-box-icons">
                    RAM needed
                  </Text>
                  <Text fontSize="xs" fontWeight="bold">
                    {model.recommended_ram_gb}GB
                  </Text>
                </HStack>
              )}
              {systemSpecs && (
                <HStack justify="space-between">
                  <Text fontSize="xs" className="pill-box-icons">
                    Your Mac
                  </Text>
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    color={
                      model.recommended_ram_gb &&
                      systemSpecs.total_memory_gb >= model.recommended_ram_gb
                        ? "successButton"
                        : "secondaryButton"
                    }
                  >
                    {systemSpecs.total_memory_gb.toFixed(0)}GB
                  </Text>
                </HStack>
              )}
            </VStack>
          </Popover.Body>
        </Popover.Content>
      </Popover.Positioner>
    </Portal>
  </Popover.Root>
);

// Compact model card for carousel
const CompactModelCard = ({
  model,
  isSelected,
  isDownloaded,
  isDownloading,
  downloadProgress,
  onSelect,
  onDownload,
  systemSpecs,
}) => {
  const badge = getBadge(model.recommendedType);

  return (
    <Box
      p="3"
      borderRadius="md"
      borderWidth="1px"
      borderColor={
        isSelected
          ? "primaryButton"
          : badge?.color === "purple"
            ? "purple.200"
            : "surface"
      }
      bg={isSelected ? "primaryButtonFaint" : "base"}
      position="relative"
      overflow="hidden"
      h="100%"
      minH="120px"
      cursor={isDownloaded ? "pointer" : "default"}
      onClick={isDownloaded ? onSelect : undefined}
      transition="all 0.2s ease"
      _hover={
        isDownloaded
          ? { borderColor: "primaryButton", shadow: "sm" }
          : { borderColor: "surface1" }
      }
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
    >
      {/* Header: star + name + info icon */}
      <HStack w="full" justify="space-between">
        <HStack gap={1}>
          {model.recommendedType === "recommended" && (
            <Tooltip content="Recommended for your Mac" showArrow>
              <Box color="secondaryButton" display="flex" alignItems="center" cursor="default">
                <FaStar size="12" />
              </Box>
            </Tooltip>
          )}
          <Text fontSize="sm" fontWeight="bold">
            {model.simple_name || model.id}
          </Text>
        </HStack>
        <PerformancePopover model={model} systemSpecs={systemSpecs} />
      </HStack>

      <Text fontSize="xs" fontWeight="normal" className="pill-box-icons" noOfLines={2}>
        {model.description}
      </Text>

      {/* Download progress */}
      {isDownloading && (
        <Box mt={1}>
          <Progress.Root
            value={downloadProgress}
            colorPalette="blue"
            size="xs"
            striped
            animated
          >
            <Progress.Track>
              <Progress.Range />
            </Progress.Track>
          </Progress.Root>
          <Text
            fontSize="xs"
            className="pill-box-icons"
            textAlign="right"
            mt={0.5}
          >
            {downloadProgress.toFixed(0)}%
          </Text>
        </Box>
      )}

      {/* Action button */}
      {!isDownloading && isDownloaded && isSelected && (
        <GreenButton size="sm" w="full" disabled leftIcon={<CheckIcon />}>
          Selected
        </GreenButton>
      )}
      {!isDownloading && isDownloaded && !isSelected && (
        <Button size="sm" w="full" variant="outline" onClick={onSelect}>
          Select
        </Button>
      )}
      {!isDownloading && !isDownloaded && (
        <NavButton size="sm" w="full" onClick={onDownload}>
          <DownloadIcon />
          Download
        </NavButton>
      )}
    </Box>
  );
};

export const AIModelsStep = ({ llm, transcription }) => {
  const {
    inferenceMode,
    setInferenceMode,
    isDesktop,
    llmBaseUrl,
    setLlmBaseUrl,
    llmApiKey,
    setLlmApiKey,
    primaryModel,
    setPrimaryModel,
    availableModels,
    isFetchingLLMModels,
    localAvailableModels,
    primaryLocalModel,
    setPrimaryLocalModel,
    isDownloadingLocal,
    downloadingModelId,
    downloadProgress,
    downloadLocalModel,
    isLocalModelDownloaded,
  } = llm;

  const {
    whisperBaseUrl,
    setWhisperBaseUrl,
    whisperModel,
    setWhisperModel,
    availableWhisperModels,
    whisperModelListAvailable,
    isFetchingWhisperModels,
    isDownloadingWhisper,
    downloadingWhisperModelId,
    whisperDownloadProgress,
    downloadWhisperModel,
    isWhisperModelDownloaded,
  } = transcription;

  const isLocal = inferenceMode === "local";

  const [systemSpecs, setSystemSpecs] = useState(null);
  const [embeddingDownloaded, setEmbeddingDownloaded] = useState(false);
  const [isDownloadingEmbedding, setIsDownloadingEmbedding] = useState(false);
  const [embeddingProgress, setEmbeddingProgress] = useState(0);

  useEffect(() => {
    if (isDesktop && isLocal) {
      import("../../../../utils/api/localModelApi").then(
        ({ localModelApi }) => {
          localModelApi
            .fetchEmbeddingStatus()
            .then((res) => {
              const has = !!res?.downloaded;
              setEmbeddingDownloaded(has);
              setEmbeddingReady(has);
            })
            .catch(() => {});
        },
      );
    }
  }, [isDesktop, isLocal]);

  const handleDownloadEmbedding = useCallback(async () => {
    setIsDownloadingEmbedding(true);
    setEmbeddingProgress(0);
    try {
      await downloadEmbeddingService({
        onProgress: (p) => {
          if (p.percentage !== undefined) setEmbeddingProgress(p.percentage);
        },
      });
      setEmbeddingDownloaded(true);
      setEmbeddingReady(true);
    } catch {
      // error toast handled by service
    } finally {
      setIsDownloadingEmbedding(false);
      setEmbeddingProgress(0);
    }
  }, []);

  useEffect(() => {
    if (isDesktop) {
      invoke("get_system_specs")
        .then(setSystemSpecs)
        .catch((err) => console.error("Failed to get system specs:", err));
    }
  }, [isDesktop]);

  const allModelsOrdered = getSmartRecommendations(
    localAvailableModels,
    systemSpecs,
  );

  const firstRecommendedIndex = useMemo(
    () =>
      allModelsOrdered.findIndex(
        (m) =>
          m.recommendedType === "recommended" ||
          m.recommendedType === "fastest",
      ),
    [allModelsOrdered],
  );

  const [startIndex, setStartIndex] = useState(0);

  useEffect(() => {
    if (firstRecommendedIndex >= 0) {
      // Show the recommended model, ensuring a full page of cards
      const maxStart = Math.max(0, allModelsOrdered.length - MODELS_PER_PAGE);
      setStartIndex(Math.min(firstRecommendedIndex, maxStart));
    }
  }, [firstRecommendedIndex, allModelsOrdered.length]);

  // Clamp so we always show a full page when possible
  const maxStart = Math.max(0, allModelsOrdered.length - MODELS_PER_PAGE);
  const effectiveStartIndex = Math.min(startIndex, maxStart);
  const visibleModels = allModelsOrdered.slice(
    effectiveStartIndex,
    effectiveStartIndex + MODELS_PER_PAGE,
  );
  const canGoNext =
    effectiveStartIndex + MODELS_PER_PAGE < allModelsOrdered.length;
  const canGoPrev = effectiveStartIndex > 0;

  const handleLLMDownload = useCallback(
    (modelId) => {
      downloadLocalModel(modelId);
    },
    [downloadLocalModel],
  );

  const whisperReady = isWhisperModelDownloaded(RECOMMENDED_WHISPER.id);
  const whisperDownloading =
    isDownloadingWhisper &&
    downloadingWhisperModelId === RECOMMENDED_WHISPER.id;

  return (
    <VStack key="ai-models" className="anim-fade-slide-right" gap={4} w="100%">
      {/* Mode selector */}
      {isDesktop && (
        <Flex
          className="mode-selector"
          alignItems="center"
          p={1}
          width="100%"
          maxW="500px"
          mx="auto"
        >
          <Box
            className="mode-selector-indicator"
            left={isLocal ? "2px" : "calc(50% - 2px)"}
          />
          <Flex width="full" position="relative" zIndex={1}>
            <Button
              className={`mode-selector-button ${isLocal ? "active" : ""}`}
              onClick={() => setInferenceMode("local")}
            >
              <FaDesktop />
              Run on my Mac
            </Button>
            <Button
              className={`mode-selector-button ${!isLocal ? "active" : ""}`}
              onClick={() => setInferenceMode("remote")}
            >
              <FaCloud />
              Use external API
            </Button>
          </Flex>
        </Flex>
      )}

      {/* Local mode */}
      {isLocal && (
        <>
          {localAvailableModels.length === 0 ? (
            <Flex align="center" justify="center" py={8}>
              <Spinner size="lg" color="primaryButton" />
              <Text ml={4} color="textSecondary">
                Finding the best model for your Mac...
              </Text>
            </Flex>
          ) : (
            <>
              {/* Intro text */}
              <VStack align="start" gap={0.5} w="100%">
                <Text fontSize="sm" fontWeight="bold" color="textPrimary">
                  Choose your AI model
                </Text>
                <Text fontSize="xs" className="pill-box-icons">
                  Powers your clinical notes, chat, and medical queries.
                  Smaller = faster; larger = smarter.
                </Text>
              </VStack>

              {/* Model carousel */}
              <HStack w="100%" align="stretch" gap={2}>
                {allModelsOrdered.length > MODELS_PER_PAGE && (
                  <Box
                    flexShrink={0}
                    w="28px"
                    h="28px"
                    borderRadius="full"
                    bg="surface"
                    borderWidth="1px"
                    borderColor="border"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    cursor={canGoPrev ? "pointer" : "default"}
                    opacity={canGoPrev ? 1 : 0.3}
                    onClick={() => canGoPrev && setStartIndex(startIndex - 1)}
                    _hover={canGoPrev ? { bg: "surface1" } : {}}
                    transition="all 0.15s"
                    alignSelf="center"
                  >
                    <ChevronLeftIcon boxSize={4} />
                  </Box>
                )}

                <Grid
                  flex="1"
                  templateColumns={{
                    base: "1fr",
                    md:
                      visibleModels.length >= 3
                        ? "repeat(3, 1fr)"
                        : `repeat(${visibleModels.length}, 1fr)`,
                  }}
                  gap={3}
                >
                  {visibleModels.map((model) => (
                    <CompactModelCard
                      key={model.id}
                      model={model}
                      isSelected={primaryLocalModel === model.filename}
                      isDownloaded={isLocalModelDownloaded(model.id)}
                      isDownloading={
                        isDownloadingLocal && downloadingModelId === model.id
                      }
                      downloadProgress={downloadProgress}
                      onSelect={() => setPrimaryLocalModel(model.filename)}
                      onDownload={() => handleLLMDownload(model.id)}
                      systemSpecs={systemSpecs}
                    />
                  ))}
                </Grid>

                {allModelsOrdered.length > MODELS_PER_PAGE && (
                  <Box
                    flexShrink={0}
                    w="28px"
                    h="28px"
                    borderRadius="full"
                    bg="surface"
                    borderWidth="1px"
                    borderColor="border"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    cursor={canGoNext ? "pointer" : "default"}
                    opacity={canGoNext ? 1 : 0.3}
                    onClick={() => canGoNext && setStartIndex(startIndex + 1)}
                    _hover={canGoNext ? { bg: "surface1" } : {}}
                    transition="all 0.15s"
                    alignSelf="center"
                  >
                    <ChevronRightIcon boxSize={4} />
                  </Box>
                )}
              </HStack>

              {/* Supporting models */}
              <VStack align="start" gap={1} w="100%">
                <Text
                  fontSize="xs"
                  fontWeight="bold"
                  className="pill-box-icons"
                >
                  Supporting models
                </Text>
                <HStack w="100%" gap={3} align="stretch">
                  {/* Transcription model */}
                  <Box
                    flex={1}
                    p={2}
                    pl={3}
                    borderRadius="md"
                    position="relative"
                    overflow="hidden"
                    borderWidth="1px"
                    borderColor={whisperReady ? "successButton" : "border"}
                    bg={whisperReady ? "primaryButtonFaint" : "secondary"}
                    transition="all 0.2s"
                    display="flex"
                    alignItems="center"
                  >
                    <Box
                      position="absolute"
                      left={0}
                      top={0}
                      bottom={0}
                      width="3px"
                      bg={whisperReady ? "successButton" : "secondaryButton"}
                      opacity={0.6}
                    />
                    <HStack justify="space-between" w="full">
                      <HStack>
                        <Box
                          color="secondaryButton"
                          display="flex"
                          alignItems="center"
                        >
                          <FaMicrophone size="12" />
                        </Box>
                        <Text fontSize="xs" fontWeight="bold">
                          Transcription
                        </Text>
                        <Badge
                          colorPalette="red"
                          fontSize="2xs"
                          variant="solid"
                        >
                          Required
                        </Badge>
                        <Tooltip
                          content={`Required for speech-to-text. Whisper Base is recommended. (${RECOMMENDED_WHISPER.size_mb}MB)`}
                          showArrow
                        >
                          <InfoIcon boxSize={3} color="textSecondary" />
                        </Tooltip>
                      </HStack>
                      {whisperReady ? (
                        <CheckIcon color="successButton" boxSize={4} />
                      ) : whisperDownloading ? (
                        <HStack gap={1}>
                          <Progress.Root
                            value={whisperDownloadProgress}
                            colorPalette="blue"
                            size="xs"
                            w="50px"
                          >
                            <Progress.Track>
                              <Progress.Range />
                            </Progress.Track>
                          </Progress.Root>
                          <Text
                            fontSize="2xs"
                            className="pill-box-icons"
                            whiteSpace="nowrap"
                          >
                            {whisperDownloadProgress.toFixed(0)}%
                          </Text>
                        </HStack>
                      ) : (
                        <IconButton
                          size="xs"
                          variant="ghost"
                          aria-label="Download transcription model"
                          onClick={() =>
                            downloadWhisperModel(RECOMMENDED_WHISPER.id)
                          }
                        >
                          <DownloadIcon boxSize={3.5} />
                        </IconButton>
                      )}
                    </HStack>
                  </Box>

                  {/* Embedding model */}
                  <Box
                    flex={1}
                    p={2}
                    pl={3}
                    borderRadius="md"
                    position="relative"
                    overflow="hidden"
                    borderWidth="1px"
                    borderColor={
                      embeddingDownloaded ? "successButton" : "border"
                    }
                    bg={
                      embeddingDownloaded ? "primaryButtonFaint" : "secondary"
                    }
                    transition="all 0.2s"
                    display="flex"
                    alignItems="center"
                  >
                    <Box
                      position="absolute"
                      left={0}
                      top={0}
                      bottom={0}
                      width="3px"
                      bg={
                        embeddingDownloaded ? "successButton" : "neutralButton"
                      }
                      opacity={0.6}
                    />
                    <HStack justify="space-between" w="full">
                      <HStack>
                        <Box
                          color="neutralButton"
                          display="flex"
                          alignItems="center"
                        >
                          <FaDatabase size="12" />
                        </Box>
                        <Text fontSize="xs" fontWeight="bold">
                          Embeddings
                        </Text>
                        <Badge
                          colorPalette="gray"
                          fontSize="2xs"
                          variant="outline"
                        >
                          Optional
                        </Badge>
                        <Tooltip
                          content={`Required for document search (RAG). Bundled — no configuration needed. (${RECOMMENDED_EMBEDDING.size_mb}MB)`}
                          showArrow
                        >
                          <InfoIcon boxSize={3} color="textSecondary" />
                        </Tooltip>
                      </HStack>
                      {embeddingDownloaded ? (
                        <CheckIcon color="successButton" boxSize={4} />
                      ) : isDownloadingEmbedding ? (
                        <HStack gap={1}>
                          <Progress.Root
                            value={embeddingProgress}
                            colorPalette="blue"
                            size="xs"
                            w="50px"
                          >
                            <Progress.Track>
                              <Progress.Range />
                            </Progress.Track>
                          </Progress.Root>
                          <Text
                            fontSize="2xs"
                            className="pill-box-icons"
                            whiteSpace="nowrap"
                          >
                            {embeddingProgress.toFixed(0)}%
                          </Text>
                        </HStack>
                      ) : (
                        <IconButton
                          size="xs"
                          variant="ghost"
                          aria-label="Download embedding model"
                          onClick={handleDownloadEmbedding}
                        >
                          <DownloadIcon boxSize={3.5} />
                        </IconButton>
                      )}
                    </HStack>
                  </Box>
                </HStack>
              </VStack>
            </>
          )}
        </>
      )}

      {/* Remote mode */}
      {!isLocal && (
        <VStack gap={3} w="100%">
          <Field.Root>
            <HStack>
              <Field.Label fontSize="sm" color="textSecondary">
                API URL
              </Field.Label>
              <Tooltip
                content="OpenAI/Ollama-compatible endpoint (usually http://localhost:11434 for local Ollama)"
                showArrow
              >
                <InfoIcon boxSize={3} color="textSecondary" />
              </Tooltip>
            </HStack>
            <Input
              placeholder="http://localhost:11434"
              value={llmBaseUrl}
              onChange={(e) => setLlmBaseUrl(e.target.value)}
              className="input-style"
              size="sm"
            />
          </Field.Root>

          <Field.Root>
            <HStack>
              <Field.Label fontSize="sm" color="textSecondary">
                API Key
              </Field.Label>
              <Tooltip
                content="API key for authenticating with the service. Leave empty for local servers like Ollama."
                showArrow
              >
                <InfoIcon boxSize={3} color="textSecondary" />
              </Tooltip>
            </HStack>
            <Input
              type="password"
              placeholder="sk-..."
              value={llmApiKey}
              onChange={(e) => setLlmApiKey(e.target.value)}
              className="input-style"
              size="sm"
            />
          </Field.Root>

          <Field.Root required={availableModels.length > 0}>
            <HStack>
              <Field.Label fontSize="sm" color="textSecondary">
                Primary Model
              </Field.Label>
              <Tooltip
                content="The main AI model for medical queries. We recommend llama3.1:8b or gpt-4."
                showArrow
              >
                <InfoIcon boxSize={3} color="textSecondary" />
              </Tooltip>
            </HStack>
            <NativeSelect.Root>
              <NativeSelect.Field
                placeholder={
                  availableModels.length === 0 && !isFetchingLLMModels
                    ? "No models found — check URL"
                    : "Select model"
                }
                value={primaryModel}
                onChange={(e) => setPrimaryModel(e.target.value)}
                disabled={isFetchingLLMModels || availableModels.length === 0}
                className="input-style"
                size="sm"
              >
                {availableModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
            {isFetchingLLMModels && (
              <HStack gap={2} mt={2}>
                <Spinner size="xs" color="primaryButton" />
                <Text fontSize="sm" color="textSecondary">
                  Loading models...
                </Text>
              </HStack>
            )}
          </Field.Root>

          {/* Transcription settings — always visible */}
          <VStack gap={2} w="100%" align="stretch">
            <Text fontSize="xs" fontWeight="bold" className="pill-box-icons">
              Transcription
            </Text>
            <Field.Root>
              <Field.Label fontSize="sm" color="textSecondary">
                Whisper URL
              </Field.Label>
              <Input
                placeholder="http://localhost:8080"
                value={whisperBaseUrl}
                onChange={(e) => setWhisperBaseUrl(e.target.value)}
                className="input-style"
                size="sm"
              />
            </Field.Root>
            {whisperBaseUrl.trim() && (
              <Field.Root>
                <Field.Label fontSize="sm" color="textSecondary">
                  Whisper Model
                </Field.Label>
                {whisperModelListAvailable &&
                availableWhisperModels.length > 0 ? (
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      placeholder="Select model"
                      value={whisperModel}
                      onChange={(e) => setWhisperModel(e.target.value)}
                      disabled={isFetchingWhisperModels}
                      className="input-style"
                      size="sm"
                    >
                      {availableWhisperModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                ) : (
                  <Input
                    placeholder="e.g., whisper-1, base, small"
                    value={whisperModel}
                    onChange={(e) => setWhisperModel(e.target.value)}
                    disabled={isFetchingWhisperModels}
                    className="input-style"
                    size="sm"
                  />
                )}
                {isFetchingWhisperModels && (
                  <HStack gap={2} mt={2}>
                    <Spinner size="xs" color="primaryButton" />
                    <Text fontSize="sm" color="textSecondary">
                      Loading...
                    </Text>
                  </HStack>
                )}
              </Field.Root>
            )}
          </VStack>
        </VStack>
      )}
    </VStack>
  );
};
