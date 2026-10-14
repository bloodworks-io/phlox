import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Flex, IconButton, Text, HStack, Spinner } from "@chakra-ui/react";
import { Tooltip } from '@/components/ui/tooltip';
import { FaSync, FaClock, FaCogs, FaCheck } from "react-icons/fa";
import { useTranscription } from "../../../utils/hooks/useTranscription";
import SpeakerText from "../../transcript/SpeakerText";

// How long a citation-driven highlight stays lit before auto-clearing.
const HIGHLIGHT_CLEAR_MS = 2500;

interface TranscriptionPanelProps {
  rawTranscription: string | null;
  transcriptionDuration: number | null;
  processDuration: number | null;
  isTranscribing?: boolean;
  onReprocess: (data: unknown, triggerResize?: boolean) => void;
  isAmbient: boolean;
  name: string;
  gender: string;
  dob: string;
  templateKey: string | null;
  noteId: number | null;
  /** Transcript line to scroll to and highlight (citation navigation). */
  highlightLine?: number | null;
  onHighlightLineConsumed?: () => void;
}

const TranscriptionPanel = ({
  rawTranscription,
  transcriptionDuration,
  processDuration,
  isTranscribing: _parentIsTranscribing,
  onReprocess,
  isAmbient,
  name,
  gender,
  dob,
  templateKey,
  noteId,
  highlightLine,
  onHighlightLineConsumed,
}: TranscriptionPanelProps) => {
  const [showSuccess, setShowSuccess] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const { reprocessTranscription, isTranscribing } = useTranscription(onReprocess, () => {});

  useEffect(() => {
    if (highlightLine == null) return undefined;
    const element = scrollRef.current?.querySelector(`[data-line="${highlightLine}"]`);
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const id = window.setTimeout(() => onHighlightLineConsumed?.(), HIGHLIGHT_CLEAR_MS);
    return () => window.clearTimeout(id);
  }, [highlightLine, onHighlightLineConsumed]);

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
    <Box
      p={3}
      maxHeight="280px"
      backdropFilter="blur(12px)"
      borderRadius="xl"
      position="relative"
      className="slim-scrollbar"
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
            <FaCheck size="32px" color="#48BB78" opacity={0.8} />
          </Flex>
        )}

        {rawTranscription ? (
          <>
            {/* Transcription text - scrollable */}
            <Box
              ref={scrollRef}
              className="slim-scrollbar"
              maxHeight="180px"
              overflowY="auto"
              mb={2}
            >
              <SpeakerText
                text={rawTranscription}
                fontSize="xs"
                lineHeight="1.5"
                highlightIndex={highlightLine}
              />
            </Box>

            {/* Footer: Reprocess button and stats */}
            <Flex justify="space-between" align="center">
              {/* Stats (guard with > 0: a bare falsy check renders "0" in JSX) */}
              {Number(transcriptionDuration) > 0 && (
                <HStack fontSize="10px" color="overlay0" gap={2}>
                  <Tooltip content={t("transcription.transcriptionTime")} showArrow positioning={{
                    placement: "top"
                  }}>
                    <HStack gap={1}>
                      <FaClock size="8px" />
                      <Text>{t("transcription.durationSeconds", { duration: transcriptionDuration })}</Text>
                    </HStack>
                  </Tooltip>
                  <Tooltip content={t("transcription.processingTime")} showArrow positioning={{
                    placement: "top"
                  }}>
                    <HStack gap={1}>
                      <FaCogs size="8px" />
                      <Text>{t("transcription.durationSeconds", { duration: processDuration })}</Text>
                    </HStack>
                  </Tooltip>
                </HStack>
              )}

              {/* Reprocess button */}
              <Tooltip content={t("transcription.reprocess")} showArrow positioning={{
                placement: "top"
              }}>
                <IconButton
                  onClick={handleReprocess}
                  disabled={isTranscribing}
                  aria-label={t("transcription.reprocess")}
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
          <Text color="overlay0" textAlign="center" fontSize="xs" py={3}>
            {t("transcription.empty")}
          </Text>
        )}
      </Box>
  );
};

export default TranscriptionPanel;
