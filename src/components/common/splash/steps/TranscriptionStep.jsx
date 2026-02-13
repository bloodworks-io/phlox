import {
  VStack,
  HStack,
  Tooltip,
  Flex,
  Spinner,
  Text,
  Box,
  Progress,
  Grid,
  IconButton,
  Button,
  Badge,
} from "@chakra-ui/react";
import { InfoIcon } from "@chakra-ui/icons";
import { ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { motion } from "framer-motion";
import { stepVariants } from "../constants";
import { useTranscriptionStep } from "../../../../utils/hooks/splash/useTranscriptionStep";

const MotionVStack = motion(VStack);

export { useTranscriptionStep };

const WHISPER_MODEL_OPTIONS = [
  {
    id: "tiny",
    name: "Tiny",
    description: "Fastest, lowest accuracy",
    size_mb: 39,
    recommendedType: "fastest",
  },
  {
    id: "base",
    name: "Base",
    description: "Good balance of speed and accuracy",
    size_mb: 74,
    recommendedType: "recommended",
  },
  {
    id: "small",
    name: "Small",
    description: "Better accuracy, still fast",
    size_mb: 244,
    recommendedType: "best_quality",
  },
  {
    id: "medium",
    name: "Medium",
    description: "High accuracy",
    size_mb: 769,
    recommendedType: null,
  },
];

const MODELS_PER_ROW = 4;

// Whisper Model Card Component
const WhisperModelCard = ({
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
    return null;
  };

  const badge = getRecommendationBadge();

  return (
    <Box
      p="3"
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
      minH="120px"
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
    >
      <HStack position="absolute" top="-2" right="2" spacing={1}>
        {badge && (
          <Badge colorScheme={badge.color} fontSize="xs">
            {badge.text}
          </Badge>
        )}
      </HStack>

      <VStack align="start" spacing={1} flex={1}>
        <Text fontSize="sm" fontWeight="bold">
          {model.name}
        </Text>
        <Text fontSize="xs" className="pill-box-icons">
          {model.description}
        </Text>
        <Text fontSize="xs" className="pill-box-icons" mt={1}>
          {model.size_mb}MB
        </Text>
      </VStack>

      {isDownloading && (
        <Box mt={2} w="full">
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
          size="xs"
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
          size="xs"
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

export const TranscriptionStep = ({
  whisperBaseUrl,
  setWhisperBaseUrl,
  whisperModel,
  setWhisperModel,
  availableWhisperModels,
  whisperModelListAvailable,
  isFetchingWhisperModels,
  fetchWhisperModels,
  currentColors,
  // New props for local mode
  inferenceMode,
  localWhisperModels,
  downloadedWhisperModels,
  localWhisperModel,
  setLocalWhisperModel,
  isDownloadingWhisper,
  downloadingWhisperModelId,
  whisperDownloadProgress,
  downloadWhisperModel,
  isWhisperModelDownloaded,
}) => {
  const isLocal = inferenceMode === "local";

  // For Whisper, show all 4 models in a grid (no carousel needed since only 4)
  const whisperModels = WHISPER_MODEL_OPTIONS;

  return (
    <MotionVStack
      key="transcription"
      variants={stepVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      spacing={6}
      w="100%"
    >
      <VStack spacing={4} w="100%">
        <Box w="100%" p={4} borderRadius="md" className="floating-main">
          <Text fontSize="sm" color={currentColors.textSecondary} mb={2}>
            <strong>Note:</strong> Voice transcription is required for
            hands-free operation during patient consultations.
            {isLocal &&
              " In Local mode, transcription runs directly on your computer."}
          </Text>
        </Box>

        {/* Local Mode - Card-based Whisper Model Selection */}
        {isLocal && (
          <>
            <HStack w="100%" justify="space-between" align="center">
              <HStack>
                <Text
                  fontSize="sm"
                  color={currentColors.textSecondary}
                  sx={{
                    fontFamily: '"Roboto", sans-serif',
                    fontWeight: "500",
                  }}
                >
                  Whisper Model
                </Text>
                <Tooltip
                  label="The Whisper model to use for speech-to-text. Base is recommended for most use cases."
                  placement="top"
                  hasArrow
                  fontSize="xs"
                  bg="gray.700"
                  color="white"
                >
                  <InfoIcon boxSize={3} color={currentColors.textSecondary} />
                </Tooltip>
              </HStack>
            </HStack>

            {/* Grid layout for Whisper model cards */}
            <Grid
              templateColumns={{
                base: "repeat(2, 1fr)",
                md: "repeat(4, 1fr)",
              }}
              gap={3}
              w="100%"
            >
              {whisperModels.map((model) => (
                <WhisperModelCard
                  key={model.id}
                  model={model}
                  isSelected={localWhisperModel === model.id}
                  isDownloaded={isWhisperModelDownloaded(model.id)}
                  isDownloading={
                    isDownloadingWhisper &&
                    downloadingWhisperModelId === model.id
                  }
                  downloadProgress={whisperDownloadProgress}
                  onSelect={() => setLocalWhisperModel(model.id)}
                  onDownload={() => downloadWhisperModel(model.id)}
                  currentColors={currentColors}
                />
              ))}
            </Grid>

            {/* Info message about download */}
            {!whisperModels.some((m) => isWhisperModelDownloaded(m.id)) && (
              <Box
                w="100%"
                p={3}
                borderRadius="md"
                bg="blue.50"
                borderWidth="1px"
                borderColor="blue.200"
              >
                <Text fontSize="sm" color="blue.700">
                  💡 Download a Whisper model to enable voice transcription.
                  This is required for hands-free operation.
                </Text>
              </Box>
            )}
          </>
        )}

        {/* Remote Mode - URL Input */}
        {!isLocal && (
          <>
            <HStack w="100%">
              <Text
                fontSize="sm"
                color={currentColors.textSecondary}
                sx={{
                  fontFamily: '"Roboto", sans-serif',
                  fontWeight: "500",
                }}
              >
                Whisper Base URL
              </Text>
              <Tooltip
                label="The URL where your Whisper transcription server is running."
                placement="top"
                hasArrow
                fontSize="xs"
                bg="gray.700"
                color="white"
              >
                <InfoIcon boxSize={3} color={currentColors.textSecondary} />
              </Tooltip>
            </HStack>
            <Box w="100%">
              <input
                placeholder="e.g., http://localhost:8080"
                value={whisperBaseUrl}
                onChange={(e) => {
                  setWhisperBaseUrl(e.target.value);
                }}
                onBlur={fetchWhisperModels}
                className="input-style"
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "0.375rem",
                  border: "1px solid var(--chakra-colors-gray-200)",
                  fontSize: "1rem",
                }}
              />
            </Box>

            {whisperBaseUrl.trim() && (
              <>
                <HStack w="100%" mt={2}>
                  <Text
                    fontSize="sm"
                    color={currentColors.textSecondary}
                    sx={{
                      fontFamily: '"Roboto", sans-serif',
                      fontWeight: "500",
                    }}
                  >
                    Whisper Model
                  </Text>
                  <Tooltip
                    label="The Whisper model to use for speech-to-text. Common options include whisper-1, base, small, medium, or large."
                    placement="top"
                    hasArrow
                    fontSize="xs"
                    bg="gray.700"
                        color="white"
                      >
                    <InfoIcon boxSize={3} color={currentColors.textSecondary} />
                  </Tooltip>
                </HStack>
                <Box w="100%">
                  {whisperModelListAvailable &&
                  availableWhisperModels.length > 0 ? (
                    <select
                      placeholder="Select Whisper model"
                      value={whisperModel}
                      onChange={(e) => setWhisperModel(e.target.value)}
                      disabled={isFetchingWhisperModels}
                      className="input-style"
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        borderRadius: "0.375rem",
                        border: "1px solid var(--chakra-colors-gray-200)",
                        fontSize: "1rem",
                      }}
                    >
                      <option value="">Select Whisper model</option>
                      {availableWhisperModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      placeholder="Enter model name (e.g., whisper-1, base, small)"
                      value={whisperModel}
                      onChange={(e) => setWhisperModel(e.target.value)}
                      disabled={isFetchingWhisperModels}
                      className="input-style"
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        borderRadius: "0.375rem",
                        border: "1px solid var(--chakra-colors-gray-200)",
                        fontSize: "1rem",
                      }}
                    />
                  )}
                </Box>
                {isFetchingWhisperModels && (
                  <Flex align="center" mt={2}>
                    <Spinner
                      size="xs"
                      mr={2}
                      color={currentColors.primaryButton}
                    />
                    <Text
                      fontSize="sm"
                      color={currentColors.textSecondary}
                      sx={{ fontFamily: '"Roboto", sans-serif' }}
                    >
                      Loading Whisper models...
                    </Text>
                  </Flex>
                )}
              </>
            )}
          </>
        )}
      </VStack>
    </MotionVStack>
  );
};
