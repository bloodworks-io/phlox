import {
  Box,
  Flex,
  IconButton,
  Text,
  HStack,
  Tooltip,
  Spinner,
  useColorMode,
} from "@chakra-ui/react";
import { FaSync, FaClock, FaCogs } from "react-icons/fa";
import { useTranscription } from "../../../utils/hooks/useTranscription";
import FloatingPanel from "../../common/FloatingPanel";

const TranscriptionPanel = ({
  isOpen,
  onClose,
  rawTranscription,
  transcriptionDuration,
  processDuration,
  isTranscribing,
  onReprocess,
  isAmbient,
  name,
  gender,
  dob,
  templateKey,
}) => {
  const { colorMode } = useColorMode();
  const { reprocessTranscription } = useTranscription(onReprocess, () => {});

  const handleReprocess = async () => {
    if (!rawTranscription) return;
    try {
      await reprocessTranscription(
        rawTranscription,
        { name, gender, dob, templateKey },
        transcriptionDuration,
        isAmbient,
      );
    } catch (error) {
      console.error("Failed to reprocess transcription:", error);
    }
  };

  return (
    <FloatingPanel
      isOpen={isOpen}
      position="bottom-center"
      showArrow={false}
      width="280px"
      maxHeight="280px"
    >
      <Box
        p={3}
        maxHeight="280px"
        backdropFilter="blur(12px)"
        borderRadius="xl"
        css={{
          "&::-webkit-scrollbar": { width: "4px" },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": {
            background: colorMode === "light" ? "#CBD5E0" : "#4A5568",
            borderRadius: "24px",
          },
        }}
      >
        {isTranscribing ? (
          <Flex justify="center" align="center" py={6}>
            <Spinner size="sm" />
          </Flex>
        ) : rawTranscription ? (
          <>
            {/* Transcription text - scrollable */}
            <Box
              maxHeight="180px"
              overflowY="auto"
              mb={2}
              css={{
                "&::-webkit-scrollbar": { width: "4px" },
                "&::-webkit-scrollbar-track": { background: "transparent" },
                "&::-webkit-scrollbar-thumb": {
                  background: colorMode === "light" ? "#CBD5E0" : "#4A5568",
                  borderRadius: "24px",
                },
              }}
            >
              <Text whiteSpace="pre-wrap" fontSize="xs" lineHeight="1.5">
                {rawTranscription}
              </Text>
            </Box>

            {/* Footer: Reprocess button and stats */}
            <Flex justify="space-between" align="center">
              {/* Stats */}
              {transcriptionDuration && (
                <HStack fontSize="10px" color="gray.500" spacing={2}>
                  <Tooltip label="Transcription time" hasArrow placement="top">
                    <HStack spacing={1}>
                      <Box as={FaClock} size="8px" />
                      <Text>{transcriptionDuration}s</Text>
                    </HStack>
                  </Tooltip>
                  <Tooltip label="Processing time" hasArrow placement="top">
                    <HStack spacing={1}>
                      <Box as={FaCogs} size="8px" />
                      <Text>{processDuration}s</Text>
                    </HStack>
                  </Tooltip>
                </HStack>
              )}

              {/* Reprocess button */}
              <Tooltip label="Reprocess" hasArrow placement="top">
                <IconButton
                  icon={
                    isTranscribing ? (
                      <Spinner size="xs" />
                    ) : (
                      <FaSync size="12px" />
                    )
                  }
                  onClick={handleReprocess}
                  isDisabled={isTranscribing}
                  aria-label="Reprocess"
                  size="xs"
                  variant="ghost"
                  opacity={0.5}
                  _hover={{ opacity: 1 }}
                />
              </Tooltip>
            </Flex>
          </>
        ) : (
          <Text color="gray.500" textAlign="center" fontSize="xs" py={3}>
            No transcription
          </Text>
        )}
      </Box>
    </FloatingPanel>
  );
};

export default TranscriptionPanel;
