import { useState, useEffect, useCallback, useMemo } from "react";
import {
  VStack,
  HStack,
  Flex,
  Box,
  Text,
  Button,
  Badge,
  Progress,
  Spinner,
  Grid,
  IconButton,
} from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { localModelApi } from "@/utils/api/localModelApi";
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
} from "react-icons/fa";
import {
  getSmartRecommendations,
} from "../../../../utils/performanceUtils";
import { downloadEmbeddingModel as downloadEmbeddingService } from "../../../../utils/services/localModelService";
import { setEmbeddingReady } from "../../../../utils/helpers/featureFlags";
import { invoke } from "@tauri-apps/api/core";
import { CompactModelCard } from "./CompactModelCard";
import { RemoteModeForm } from "./RemoteModeForm";

const MODELS_PER_PAGE = 3;

const RECOMMENDED_WHISPER = {
  id: "omi-med-stt-v1-q8_0",
  name: "Omi Med STT",
  size_mb: 886,
};

const RECOMMENDED_EMBEDDING = {
  id: "qwen3-embedding-0.6b",
  name: "Qwen3 Embedding 0.6B",
  size_mb: 639,
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
      localModelApi
        .fetchEmbeddingStatus()
        .then((res) => {
          const has = !!res?.downloaded;
          setEmbeddingDownloaded(has);
          setEmbeddingReady(has);
        })
        .catch(() => {});
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
        (m) => m.recommendedType === "recommended",
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
                          content={`Required for speech-to-text. Omi Med STT is the bundled medical model. (${RECOMMENDED_WHISPER.size_mb}MB)`}
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
        <RemoteModeForm
          llmBaseUrl={llmBaseUrl}
          setLlmBaseUrl={setLlmBaseUrl}
          llmApiKey={llmApiKey}
          setLlmApiKey={setLlmApiKey}
          primaryModel={primaryModel}
          setPrimaryModel={setPrimaryModel}
          availableModels={availableModels}
          isFetchingLLMModels={isFetchingLLMModels}
          whisperBaseUrl={whisperBaseUrl}
          setWhisperBaseUrl={setWhisperBaseUrl}
          whisperModel={whisperModel}
          setWhisperModel={setWhisperModel}
          availableWhisperModels={availableWhisperModels}
          whisperModelListAvailable={whisperModelListAvailable}
          isFetchingWhisperModels={isFetchingWhisperModels}
        />
      )}
    </VStack>
  );
};
