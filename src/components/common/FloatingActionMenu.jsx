import React from "react";
import { IconButton, Tooltip, useColorMode, Box } from "@chakra-ui/react";
import { ChatIcon } from "@chakra-ui/icons";
import { FaEnvelope, FaAtom, FaFileUpload, FaClock } from "react-icons/fa";
import PillBox from "./PillBox";
import { isChatEnabled } from "../../utils/helpers/featureFlags";

const FloatingActionMenu = ({
  onOpenChat,
  onOpenLetter,
  onOpenReasoning,
  onOpenDocument,
  onOpenPreviousVisit,
  isChatOpen,
  isLetterOpen,
  isReasoningOpen,
  isDocumentOpen,
  isPreviousVisitOpen,
  hasCriticalReasoning,
  hasPreviousVisitSummary = false,
  isEncounterSaved = false,
}) => {
  const { colorMode } = useColorMode();

  const surfaceBg = colorMode === "light" ? "#ccd0da" : "#363a4f";

  const getButtonBg = (isOpen) => (isOpen ? surfaceBg : "transparent");

  return (
    <PillBox
      className="floating-action-menu"
      right="50px"
      top="50%"
      transform="translateY(-50%)"
      zIndex="1040"
      flexDirection="column"
      gap={2}
      px={2}
      py={2}
    >
      {/* Document Upload button */}
      {isChatEnabled() && (
        <Tooltip label="Upload Document" placement="left">
          <IconButton
            icon={<FaFileUpload />}
            onClick={onOpenDocument}
            aria-label="Open Document Upload"
            size="sm"
            isRound
            variant="ghost"
            m={0}
            bg={getButtonBg(isDocumentOpen)}
            _hover={{ bg: surfaceBg }}
            className="pill-box-icons"
          />
        </Tooltip>
      )}

      {/* Previous Visit button */}
      <Tooltip
        label={
          hasPreviousVisitSummary
            ? "Previous Visit"
            : "No previous visit available"
        }
        placement="left"
      >
        <IconButton
          icon={<FaClock />}
          onClick={onOpenPreviousVisit}
          aria-label="Open Previous Visit"
          size="sm"
          isRound
          variant="ghost"
          m={0}
          bg={getButtonBg(isPreviousVisitOpen)}
          _hover={{ bg: surfaceBg }}
          className="pill-box-icons"
          isDisabled={!hasPreviousVisitSummary}
          opacity={!hasPreviousVisitSummary ? 0.4 : 1}
          cursor={!hasPreviousVisitSummary ? "not-allowed" : "pointer"}
        />
      </Tooltip>

      {/* Chat button */}
      {isChatEnabled() && (
        <Tooltip label="Chat with Phlox" placement="left">
          <IconButton
            icon={<ChatIcon />}
            onClick={onOpenChat}
            aria-label="Open Chat"
            size="sm"
            isRound
            m={0}
            variant="ghost"
            bg={getButtonBg(isChatOpen)}
            _hover={{ bg: surfaceBg }}
            className="pill-box-icons"
          />
        </Tooltip>
      )}

      {/* Clinical Reasoning button */}
      {isChatEnabled() && onOpenReasoning && (
        <Box position="relative" display="inline-block">
          <Tooltip
            label={
              isEncounterSaved
                ? "Clinical Reasoning"
                : "Save encounter to access Clinical Reasoning"
            }
            placement="left"
          >
            <IconButton
              icon={<FaAtom />}
              onClick={onOpenReasoning}
              aria-label="Open Reasoning"
              size="sm"
              isRound
              m={0}
              variant="ghost"
              bg={getButtonBg(isReasoningOpen)}
              _hover={{ bg: surfaceBg }}
              className="pill-box-icons"
              isDisabled={!isEncounterSaved}
              opacity={!isEncounterSaved ? 0.4 : 1}
              cursor={!isEncounterSaved ? "not-allowed" : "pointer"}
            />
          </Tooltip>
          {hasCriticalReasoning && isEncounterSaved && (
            <Box
              position="absolute"
              top="0"
              right="0"
              w="8px"
              h="8px"
              borderRadius="full"
              bg="red.500"
              zIndex={2}
              pointerEvents="none"
            />
          )}
        </Box>
      )}

      {/* Letter button */}
      <Tooltip
        label={
          isEncounterSaved
            ? "Patient Letter"
            : "Save encounter to access Letter"
        }
        placement="left"
      >
        <IconButton
          icon={<FaEnvelope />}
          onClick={onOpenLetter}
          aria-label="Open Letter"
          size="sm"
          isRound
          m={0}
          variant="ghost"
          bg={getButtonBg(isLetterOpen)}
          _hover={{ bg: surfaceBg }}
          className="pill-box-icons"
          isDisabled={!isEncounterSaved}
          opacity={!isEncounterSaved ? 0.4 : 1}
          cursor={!isEncounterSaved ? "not-allowed" : "pointer"}
        />
      </Tooltip>
    </PillBox>
  );
};

export default FloatingActionMenu;
