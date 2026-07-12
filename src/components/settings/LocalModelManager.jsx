import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box, VStack, HStack, Text, Button, Badge, Alert,
  Progress, Grid, Icon, Spinner,
  Popover, Portal, Dialog,
} from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import {
  FaMicrophone, FaDatabase, FaStar, FaExclamationTriangle, FaMemory, FaMicrochip,
} from "react-icons/fa";
import { DownloadIcon, CheckIcon, InfoIcon, ChevronLeftIcon, ChevronRightIcon } from "../common/icons";
import { GreenButton, NavButton } from "../common/Buttons";
import ModalTitle from "../common/ModalTitle";
import { useLocalModels } from "../../utils/hooks/useLocalModels";
import {
  getSmartRecommendations,
  calculateLLMPerformance,
} from "../../utils/performanceUtils";
import { setEmbeddingReady } from "../../utils/helpers/featureFlags";
import { downloadEmbeddingModel as downloadEmbeddingService } from "../../utils/services/localModelService";
import { localModelApi } from "../../utils/api/localModelApi";

const MODELS_PER_PAGE = 3;

const RECOMMENDED_EMBEDDING = {
  id: "qwen3-embedding-0.6b",
  name: "Qwen3 Embedding 0.6B",
  size_mb: 639,
};

const getBadge = (recommendedType) => {
  if (recommendedType === "recommended") return { color: "purple" };
  if (recommendedType === "fastest") return { color: "blue" };
  if (recommendedType === "best_quality") return { color: "green" };
  return null;
};

const getMachineLabel = (os) => {
  if (os === "macos") return "Your Mac";
  if (os === "windows") return "Your PC";
  return "Your system";
};

const PerformancePopover = ({ model, systemSpecs }) => {
  const perf =
    systemSpecs?.apple_silicon && model.parameters_billions
      ? calculateLLMPerformance(
          systemSpecs.apple_silicon.generation,
          systemSpecs.apple_silicon.tier,
          model.parameters_billions,
          model.active_parameters_billions,
        )
      : null;

  return (
    <Popover.Root positioning={{ placement: "top", offset: { mainAxis: 4 } }}>
      <Popover.Trigger asChild>
        <Box cursor="pointer" display="flex" alignItems="center" color="textSecondary" _hover={{ color: "primaryButton" }} transition="color 0.15s">
          <InfoIcon boxSize={3.5} />
        </Box>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content w="200px">
            <Popover.Arrow><Popover.ArrowTip /></Popover.Arrow>
            <Popover.Body p={3}>
              <VStack gap={1} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="xs" className="pill-box-icons">Size</Text>
                  <Text fontSize="xs" fontWeight="bold">{model.size_mb}MB</Text>
                </HStack>
                {(model.active_parameters_billions || model.parameters_billions) && (
                  <HStack justify="space-between">
                    <Text fontSize="xs" className="pill-box-icons">Parameters</Text>
                    <Text fontSize="xs" fontWeight="bold">
                      {model.active_parameters_billions ? `${model.active_parameters_billions}B` : `${model.parameters_billions}B`}
                    </Text>
                  </HStack>
                )}
                {model.recommended_ram_gb && (
                  <HStack justify="space-between">
                    <Text fontSize="xs" className="pill-box-icons">RAM needed</Text>
                    <Text fontSize="xs" fontWeight="bold">{model.recommended_ram_gb}GB</Text>
                  </HStack>
                )}
                {systemSpecs && (
                  <HStack justify="space-between">
                    <Text fontSize="xs" className="pill-box-icons">{getMachineLabel(systemSpecs.os)}</Text>
                    <Text fontSize="xs" fontWeight="bold" color={model.recommended_ram_gb && systemSpecs.total_memory_gb >= model.recommended_ram_gb ? "successButton" : "secondaryButton"}>
                      {systemSpecs.total_memory_gb.toFixed(0)}GB
                    </Text>
                  </HStack>
                )}
                {perf && (
                  <Tooltip content="Estimated processing time for a 10-minute consultation" showArrow>
                    <HStack justify="space-between">
                      <Text fontSize="xs" className="pill-box-icons">Est. time</Text>
                      <Text fontSize="xs" fontWeight="bold">~{Math.round(perf.estimatedTime)}s</Text>
                    </HStack>
                  </Tooltip>
                )}
              </VStack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};

const ModelCard = ({ model, isDownloaded, isDownloading, downloadProgress, onDownload, systemSpecs }) => {
  const isDownloadingThis = isDownloading && downloadProgress !== null;

  return (
    <Box
      p="3"
      borderRadius="md"
      borderWidth="1px"
      borderColor={getBadge(model.recommendedType)?.color === "purple" ? "purple.200" : "surface"}
      bg="base"
      position="relative"
      overflow="hidden"
      h="100%"
      minH="120px"
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
      transition="all 0.2s ease"
      _hover={{ borderColor: "surface1" }}
    >
      <HStack w="full" justify="space-between">
        <HStack gap={1}>
          {model.recommendedType === "recommended" && (
            <Tooltip content="Recommended for your Mac" showArrow>
              <Box color="secondaryButton" display="flex" alignItems="center" cursor="default"><FaStar size="12" /></Box>
            </Tooltip>
          )}
          <Text fontSize="sm" fontWeight="bold">{model.simple_name || model.id}</Text>
        </HStack>
        <PerformancePopover model={model} systemSpecs={systemSpecs} />
      </HStack>
      <Text fontSize="xs" fontWeight="normal" className="pill-box-icons" noOfLines={2}>
        {model.description}
      </Text>

      {isDownloadingThis ? (
        <Box>
          <Progress.Root value={downloadProgress?.percentage || 0} colorPalette="blue" size="xs" striped animated>
            <Progress.Track><Progress.Range /></Progress.Track>
          </Progress.Root>
          <Text fontSize="2xs" className="pill-box-icons" textAlign="right">{(downloadProgress?.percentage || 0).toFixed(0)}%</Text>
        </Box>
      ) : isDownloaded ? (
        <GreenButton size="sm" w="full" disabled leftIcon={<CheckIcon />}>Downloaded</GreenButton>
      ) : (
        <NavButton size="sm" w="full" onClick={onDownload}>
          <DownloadIcon />Download
        </NavButton>
      )}
    </Box>
  );
};

const SupportingModelRow = ({ icon, iconColor, label, required, isReady, isDownloading, progress, onDownload, tooltipContent }) => (
  <Box
    flex={1}
    p={2}
    pl={3}
    borderRadius="md"
    position="relative"
    overflow="hidden"
    borderWidth="1px"
    borderColor={isReady ? "successButton" : "border"}
    bg={isReady ? "primaryButtonFaint" : "secondary"}
    transition="all 0.2s"
    display="flex"
    alignItems="center"
  >
    <Box position="absolute" left={0} top={0} bottom={0} width="3px" bg={isReady ? "successButton" : iconColor} opacity={0.6} />
    <HStack justify="space-between" w="full">
      <HStack>
        <Box color={iconColor} display="flex" alignItems="center">{icon}</Box>
        <Text fontSize="xs" fontWeight="bold">{label}</Text>
        <Badge colorPalette={required ? "red" : "gray"} fontSize="2xs" variant={required ? "solid" : "outline"}>
          {required ? "Required" : "Optional"}
        </Badge>
        <Tooltip content={tooltipContent} showArrow>
          <InfoIcon boxSize={3} color="textSecondary" />
        </Tooltip>
      </HStack>
      {isReady ? (
        <CheckIcon color="successButton" boxSize={4} />
      ) : isDownloading ? (
        <HStack gap={1}>
          <Progress.Root value={progress} colorPalette="blue" size="xs" w="50px">
            <Progress.Track><Progress.Range /></Progress.Track>
          </Progress.Root>
          <Text fontSize="2xs" className="pill-box-icons" whiteSpace="nowrap">{progress.toFixed(0)}%</Text>
        </HStack>
      ) : (
        <Button size="xs" variant="ghost" aria-label={`Download ${label}`} onClick={onDownload}>
          <DownloadIcon boxSize={3.5} />
        </Button>
      )}
    </HStack>
  </Box>
);

const LocalModelManager = ({ className }) => {
  const {
    models, availableModels, localStatus, systemSpecs,
    downloadProgress, isDownloading, downloadingModelId,
    downloadLlmModel, deleteLlmModel, refreshData,
    whisperModels, whisperRecommendations,
    downloadWhisperModel, deleteWhisperModel,
  } = useLocalModels();

  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [startIndex, setStartIndex] = useState(0);

  const [embeddingDownloaded, setEmbeddingDownloaded] = useState(false);
  const [isDownloadingEmbedding, setIsDownloadingEmbedding] = useState(false);
  const [embeddingProgress, setEmbeddingProgress] = useState(0);

  useMemo(() => {
    localModelApi.fetchEmbeddingStatus()
      .then((res) => {
        const has = !!res?.downloaded;
        setEmbeddingDownloaded(has);
        setEmbeddingReady(has);
      })
      .catch(() => {});
  }, []);

  const smartRecommendations = systemSpecs && availableModels.length > 0
    ? getSmartRecommendations(availableModels, systemSpecs)
    : [];

  const firstRecommendedIndex = useMemo(
    () => smartRecommendations.findIndex(
      (m) => m.recommendedType === "recommended" || m.recommendedType === "fastest",
    ),
    [smartRecommendations],
  );

  useEffect(() => {
    if (firstRecommendedIndex >= 0) {
      const maxStart = Math.max(0, smartRecommendations.length - MODELS_PER_PAGE);
      setStartIndex(Math.min(firstRecommendedIndex, maxStart));
    }
  }, [firstRecommendedIndex, smartRecommendations.length]);

  const maxStart = Math.max(0, smartRecommendations.length - MODELS_PER_PAGE);
  const effectiveStartIndex = Math.min(startIndex, maxStart);
  const visibleModels = smartRecommendations.slice(effectiveStartIndex, effectiveStartIndex + MODELS_PER_PAGE);
  const canGoNext = effectiveStartIndex + MODELS_PER_PAGE < smartRecommendations.length;
  const canGoPrev = effectiveStartIndex > 0;

  const whisperReady = whisperModels.length > 0;
  const recommendedWhisper = whisperRecommendations.find((m) => m.recommendedType === "recommended") || whisperRecommendations[0];
  const llmDownloadProgress = isDownloading.llm ? downloadProgress.llm : null;
  const whisperDownloading = isDownloading.whisper && downloadingModelId.whisper;

  const handleDownloadEmbedding = useCallback(async () => {
    setIsDownloadingEmbedding(true);
    setEmbeddingProgress(0);
    try {
      await downloadEmbeddingService({
        onProgress: (p) => { if (p.percentage !== undefined) setEmbeddingProgress(p.percentage); },
      });
      setEmbeddingDownloaded(true);
      setEmbeddingReady(true);
    } catch { /* toast handled by service */ }
    finally { setIsDownloadingEmbedding(false); setEmbeddingProgress(0); }
  }, []);

  const handleResetAll = useCallback(async () => {
    setIsResetting(true);
    try {
      for (const model of models) await deleteLlmModel(model.filename);
      for (const model of whisperModels) await deleteWhisperModel(model.id);
      if (embeddingDownloaded) {
        try { await localModelApi.deleteEmbeddingModel(); } catch {}
        setEmbeddingDownloaded(false);
        setEmbeddingReady(false);
      }
      await refreshData();
    } catch (e) {
      console.error("Reset failed:", e);
    } finally {
      setIsResetting(false);
      setIsResetOpen(false);
    }
  }, [models, whisperModels, embeddingDownloaded, deleteLlmModel, deleteWhisperModel, refreshData]);

  if (!localStatus) {
    return (
      <HStack gap={2} py={4}>
        <Spinner size="sm" animationDuration="0.65s" />
        <Text fontSize="sm" color="textSecondary">Loading...</Text>
      </HStack>
    );
  }

  if (!localStatus.available && !localStatus?.llama_server_running) {
    return (
      <Alert.Root status="warning" borderRadius="md">
        <Alert.Indicator asChild><FaExclamationTriangle /></Alert.Indicator>
        <Box>
          <Alert.Title fontSize="sm">Local Models Not Available</Alert.Title>
          <Alert.Description fontSize="xs">Local models are only available in Tauri builds.</Alert.Description>
        </Box>
      </Alert.Root>
    );
  }

  const hasAnyModels = models.length > 0 || whisperReady || embeddingDownloaded;

  return (
    <VStack gap={4} align="stretch" className={className}>
      {/* System info */}
      {systemSpecs && (
        <HStack gap={4} fontSize="xs" className="pill-box-icons">
          <HStack gap={1}>
            <Icon className="blue-icon" asChild><FaMemory /></Icon>
            <Text>{systemSpecs.total_memory_gb.toFixed(1)}GB RAM</Text>
          </HStack>
          <HStack gap={1}>
            <Icon className="blue-icon" asChild><FaMicrochip /></Icon>
            <Text>{systemSpecs.cpu_count} cores</Text>
          </HStack>
        </HStack>
      )}

      {/* AI Model carousel */}
      <VStack align="start" gap={2} w="100%">
        <Text fontSize="sm" fontWeight="bold">AI Model</Text>
        {smartRecommendations.length > 0 ? (
          <HStack w="100%" align="stretch" gap={2}>
            {smartRecommendations.length > MODELS_PER_PAGE && (
              <Box
                flexShrink={0} w="28px" h="28px" borderRadius="full"
                bg="surface" borderWidth="1px" borderColor="border"
                display="flex" alignItems="center" justifyContent="center"
                cursor={canGoPrev ? "pointer" : "default"}
                opacity={canGoPrev ? 1 : 0.3}
                onClick={() => canGoPrev && setStartIndex(effectiveStartIndex - 1)}
                _hover={canGoPrev ? { bg: "surface1" } : {}}
                transition="all 0.15s" alignSelf="center"
              >
                <ChevronLeftIcon boxSize={4} />
              </Box>
            )}

            <Grid
              flex={1}
              templateColumns={{
                base: "1fr",
                md: visibleModels.length >= 3 ? "repeat(3, 1fr)" : `repeat(${visibleModels.length}, 1fr)`,
              }}
              gap={3}
            >
              {visibleModels.map((model) => {
                const isDownloaded = models.some((m) => {
                  const avail = availableModels.find((a) => a.id === model.id);
                  return avail && m.filename === avail.filename;
                });
                const isThisDownloading = isDownloading.llm && downloadingModelId.llm === model.id;
                return (
                  <ModelCard
                    key={model.id}
                    model={model}
                    isDownloaded={isDownloaded}
                    isDownloading={isThisDownloading}
                    downloadProgress={llmDownloadProgress}
                    onDownload={() => downloadLlmModel(model.id)}
                    systemSpecs={systemSpecs}
                  />
                );
              })}
            </Grid>

            {smartRecommendations.length > MODELS_PER_PAGE && (
              <Box
                flexShrink={0} w="28px" h="28px" borderRadius="full"
                bg="surface" borderWidth="1px" borderColor="border"
                display="flex" alignItems="center" justifyContent="center"
                cursor={canGoNext ? "pointer" : "default"}
                opacity={canGoNext ? 1 : 0.3}
                onClick={() => canGoNext && setStartIndex(effectiveStartIndex + 1)}
                _hover={canGoNext ? { bg: "surface1" } : {}}
                transition="all 0.15s" alignSelf="center"
              >
                <ChevronRightIcon boxSize={4} />
              </Box>
            )}
          </HStack>
        ) : (
          <Text fontSize="xs" className="pill-box-icons">No models available for your system.</Text>
        )}

        {models.length > 0 && (
          <HStack fontSize="xs" className="pill-box-icons">
            <Text>Current:</Text>
            <Text fontWeight="bold">{models[0].filename}</Text>
            {models[0].is_selected && <Badge colorPalette="green" size="xs">Active</Badge>}
          </HStack>
        )}
      </VStack>

      {/* Supporting Models */}
      <VStack align="start" gap={1} w="100%">
        <Text fontSize="xs" fontWeight="bold" className="pill-box-icons">Supporting Models</Text>
        <HStack w="100%" gap={3} align="stretch">
          <SupportingModelRow
            icon={<FaMicrophone size="12" />}
            iconColor="secondaryButton"
            label="Transcription"
            required
            isReady={whisperReady}
            isDownloading={whisperDownloading}
            progress={downloadProgress.whisper?.percentage || 0}
            onDownload={() => recommendedWhisper && downloadWhisperModel(recommendedWhisper.id)}
            tooltipContent={`Required for speech-to-text. ${recommendedWhisper ? `(${recommendedWhisper.size})` : ""}`}
          />
          <SupportingModelRow
            icon={<FaDatabase size="12" />}
            iconColor="neutralButton"
            label="Embeddings"
            required={false}
            isReady={embeddingDownloaded}
            isDownloading={isDownloadingEmbedding}
            progress={embeddingProgress}
            onDownload={handleDownloadEmbedding}
            tooltipContent={`Required for document search (RAG). (${RECOMMENDED_EMBEDDING.size_mb}MB)`}
          />
        </HStack>
      </VStack>

      {/* Danger zone */}
      {hasAnyModels && (
        <Box mt={2}>
          <Button variant="outline" size="sm" colorPalette="red" borderRadius="lg" onClick={() => setIsResetOpen(true)}>
            <FaExclamationTriangle /> Reset All Models
          </Button>
        </Box>
      )}

      {/* Reset modal */}
      <Dialog.Root open={isResetOpen} onOpenChange={(e) => { if (!e.open) setIsResetOpen(false); }} size="md">
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content className="modal-style">
              <Dialog.Header>
                <HStack>
                  <Box display="flex" alignItems="center"><FaExclamationTriangle /></Box>
                  <ModalTitle>Reset All Models?</ModalTitle>
                </HStack>
              </Dialog.Header>
              <Dialog.CloseTrigger />
              <Dialog.Body>
                <VStack gap={3} align="stretch">
                  <Text fontSize="sm">This will permanently delete:</Text>
                  <VStack gap={1} align="start" pl={4}>
                    {models.length > 0 && (
                      <Text fontSize="sm" className="pill-box-icons">• LLM model — clinical notes and chat will stop working</Text>
                    )}
                    {whisperReady && (
                      <Text fontSize="sm" className="pill-box-icons">• Transcription model — voice transcription will stop</Text>
                    )}
                    {embeddingDownloaded && (
                      <Text fontSize="sm" className="pill-box-icons">• Embedding model — document search will stop</Text>
                    )}
                  </VStack>
                  <Text fontSize="sm" color="successButton">
                    Your patient data, notes, and settings are NOT affected.
                  </Text>
                  <Text fontSize="sm">You'll need to re-download models to use AI features again.</Text>
                </VStack>
              </Dialog.Body>
              <Dialog.Footer>
                <HStack justify="flex-end" width="100%">
                  <Button className="red-button" mr={3} onClick={() => setIsResetOpen(false)}>
                    Cancel
                  </Button>
                  <Button className="green-button" onClick={handleResetAll} loading={isResetting} loadingText="Deleting...">
                    Delete All Models
                  </Button>
                </HStack>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </VStack>
  );
};

export default LocalModelManager;
