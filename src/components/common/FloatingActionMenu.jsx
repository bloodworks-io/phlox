import React from "react";
import { IconButton, Box } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { ChatIcon } from "./icons";
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
    showPreviousVisitDot = false,
    isEncounterSaved = false,
}) => {
    const surfaceBg = "surface";

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
            px={1.5}
            py={2}
        >
            {/* Document Upload button */}
            {isChatEnabled() && (
                <Tooltip
                    content="Upload Document"
                    positioning={{
                        placement: "left",
                    }}
                >
                    <IconButton
                        id="fab-document"
                        onClick={onOpenDocument}
                        aria-label="Open Document Upload"
                        size="xs"
                        borderRadius="full"
                        variant="ghost"
                        m={0}
                        bg={getButtonBg(isDocumentOpen)}
                        _hover={{ bg: surfaceBg }}
                        className="pill-box-icons"
                    >
                        <FaFileUpload />
                    </IconButton>
                </Tooltip>
            )}
            {/* Previous Visit button */}
            <Box position="relative" display="inline-block">
                <Tooltip
                    content={
                        hasPreviousVisitSummary
                            ? "Previous Visit"
                            : "No previous visit available"
                    }
                    positioning={{
                        placement: "left",
                    }}
                >
                    <IconButton
                        id="fab-previous-visit"
                        onClick={onOpenPreviousVisit}
                        aria-label="Open Previous Visit"
                        size="xs"
                        borderRadius="full"
                        variant="ghost"
                        m={0}
                        bg={getButtonBg(isPreviousVisitOpen)}
                        _hover={{ bg: surfaceBg }}
                        className="pill-box-icons"
                        disabled={!hasPreviousVisitSummary}
                        opacity={!hasPreviousVisitSummary ? 0.4 : 1}
                        cursor={
                            !hasPreviousVisitSummary ? "not-allowed" : "pointer"
                        }
                    >
                        <FaClock />
                    </IconButton>
                </Tooltip>
                {showPreviousVisitDot && hasPreviousVisitSummary && (
                    <Box
                        position="absolute"
                        top="0"
                        right="0"
                        w="8px"
                        h="8px"
                        borderRadius="full"
                        bg="dangerButton"
                        zIndex={2}
                        pointerEvents="none"
                    />
                )}
            </Box>
            {/* Chat button */}
            {isChatEnabled() && (
                <Tooltip
                    content="Chat with Phlox"
                    positioning={{
                        placement: "left",
                    }}
                >
                    <IconButton
                        id="fab-chat"
                        onClick={onOpenChat}
                        aria-label="Open Chat"
                        size="xs"
                        borderRadius="full"
                        m={0}
                        variant="ghost"
                        bg={getButtonBg(isChatOpen)}
                        _hover={{ bg: surfaceBg }}
                        className="pill-box-icons"
                    >
                        <ChatIcon />
                    </IconButton>
                </Tooltip>
            )}
            {/* Clinical Reasoning button */}
            {isChatEnabled() && onOpenReasoning && (
                <Box position="relative" display="inline-block">
                    <Tooltip
                        content={
                            isEncounterSaved
                                ? "Clinical Reasoning"
                                : "Save encounter to access Clinical Reasoning"
                        }
                        positioning={{
                            placement: "left",
                        }}
                    >
                        <IconButton
                            id="fab-reasoning"
                            onClick={onOpenReasoning}
                            aria-label="Open Reasoning"
                            size="xs"
                            borderRadius="full"
                            m={0}
                            variant="ghost"
                            bg={getButtonBg(isReasoningOpen)}
                            _hover={{ bg: surfaceBg }}
                            className="pill-box-icons"
                            disabled={!isEncounterSaved}
                            opacity={!isEncounterSaved ? 0.4 : 1}
                            cursor={
                                !isEncounterSaved ? "not-allowed" : "pointer"
                            }
                        >
                            <FaAtom />
                        </IconButton>
                    </Tooltip>
                    {hasCriticalReasoning && isEncounterSaved && (
                        <Box
                            position="absolute"
                            top="0"
                            right="0"
                            w="8px"
                            h="8px"
                            borderRadius="full"
                            bg="dangerButton"
                            zIndex={2}
                            pointerEvents="none"
                        />
                    )}
                </Box>
            )}
            {/* Letter button */}
            <Tooltip
                content={
                    isEncounterSaved
                        ? "Patient Letter"
                        : "Save encounter to access Letter"
                }
                positioning={{
                    placement: "left",
                }}
            >
                <IconButton
                    id="fab-letter"
                    onClick={onOpenLetter}
                    aria-label="Open Letter"
                    size="sm"
                    borderRadius="full"
                    m={0}
                    variant="ghost"
                    bg={getButtonBg(isLetterOpen)}
                    _hover={{ bg: surfaceBg }}
                    className="pill-box-icons"
                    disabled={!isEncounterSaved}
                    opacity={!isEncounterSaved ? 0.4 : 1}
                    cursor={!isEncounterSaved ? "not-allowed" : "pointer"}
                >
                    <FaEnvelope />
                </IconButton>
            </Tooltip>
        </PillBox>
    );
};

export default FloatingActionMenu;
