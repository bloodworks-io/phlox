import { useState } from "react";
import { useColorMode } from "../../ui/color-mode";
import { Box, Flex, IconButton, Text, HStack, Spinner } from "@chakra-ui/react";
import { Tooltip } from '@/components/ui/tooltip';
import { FaSync, FaClock, FaCogs, FaCheck } from "react-icons/fa";
import { useTranscription } from "../../../utils/hooks/useTranscription";
import FloatingPanel from "../../common/FloatingPanel";

const TranscriptionPanel = ({
  isOpen,
  onClose,
  rawTranscription,
  transcriptionDuration,
  processDuration,
  isTranscribing: parentIsTranscribing,
  onReprocess,
  isAmbient,
  name,
  gender,
  dob,
  templateKey,
  noteId,
}) => {
  const { colorMode } = useColorMode();
  const [showSuccess, setShowSuccess] = useState(false);
  const { reprocessTranscription, isTranscribing } = useTranscription(onReprocess, () => {});

  const handleReprocess = async () => {
    if (!rawTranscription) return;
    try {
      await reprocessTranscription(
        rawTranscription,
        { name, gender, dob, templateKey, noteId },
        transcriptionDuration,
        isAmbient,
      );
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
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
        position="relative"
        css={{
          "&::-webkit-scrollbar": { width: "4px" },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": {
            background: colorMode === "light" ? "#CBD5E0" : "#4A5568",
            borderRadius: "24px",
          },
        }}
      >
        {/* Success overlay */}
        {showSuccess && (
          <Flex
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="rgba(72, 187, 120, 0.2)"
            borderRadius="xl"
            justify="center"
            align="center"
            zIndex={10}
            animation="fadeOut 1.5s ease-out forwards"
            css={{
              '& @keyframes fadeOut': {
                "0%": { opacity: 1 },
                "70%": { opacity: 1 },
                "100%": { opacity: 0 },
              }
            }}
          >
            <Box size="32px" color="#48BB78" opacity={0.8} asChild><FaCheck /></Box>
          </Flex>
        )}

        {rawTranscription ? (
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
                <HStack fontSize="10px" color="gray.500" gap={2}>
                  <Tooltip content="Transcription time" showArrow positioning={{
                    placement: "top"
                  }}>
                    <HStack gap={1}>
                      <Box size="8px" asChild><FaClock /></Box>
                      <Text>{transcriptionDuration}s</Text>
                    </HStack>
                  </Tooltip>
                  <Tooltip content="Processing time" showArrow positioning={{
                    placement: "top"
                  }}>
                    <HStack gap={1}>
                      <Box size="8px" asChild><FaCogs /></Box>
                      <Text>{processDuration}s</Text>
                    </HStack>
                  </Tooltip>
                </HStack>
              )}

              {/* Reprocess button */}
              <Tooltip content="Reprocess" showArrow positioning={{
                placement: "top"
              }}>
                <IconButton
                  onClick={handleReprocess}
                  disabled={isTranscribing}
                  aria-label="Reprocess"
                  size="xs"
                  variant="ghost"
                  opacity={0.5}
                  _hover={{ opacity: 1 }}>{isTranscribing ? (
                    <Spinner size="xs" />
                  ) : (
                    <FaSync size="12px" />
                  )}</IconButton>
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
