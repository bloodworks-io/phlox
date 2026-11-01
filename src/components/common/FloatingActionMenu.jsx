import React from "react";
import { useTranslation } from "react-i18next";
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
    hasPreviousVisit = false,
    showPreviousVisitDot = false,
    isEncounterSaved = false,
}) => {
    const { t } = useTranslation();

    const previousVisitLabel = showPreviousVisitDot
        ? `${t("common.fab.openPreviousVisit")}, ${t("common.fab.previousVisitUnread")}`
        : t("common.fab.openPreviousVisit");
    const reasoningLabel = hasCriticalReasoning
        ? `${t("common.fab.openReasoning")}, ${t("common.fab.criticalReasoning")}`
        : t("common.fab.openReasoning");
    const buttonState = (isOpen) => ({
        bg: isOpen ? "folio.accentSoft" : "transparent",
        color: isOpen ? "folio.accent" : "folio.muted",
        _hover: {
            bg: "folio.hover",
            color: "folio.ink",
        },
        _focusVisible: {
            outline: "2px solid",
            outlineColor: "folio.focus",
            outlineOffset: "2px",
        },
    });

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
                    content={t("common.fab.uploadDocument")}
                    positioning={{
                        placement: "left",
                    }}
                >
                    <IconButton
                        id="fab-document"
                        onClick={onOpenDocument}
                        aria-label={t("common.fab.openDocumentUpload")}
                        aria-pressed={isDocumentOpen}
                        size="xs"
                        borderRadius="full"
                        variant="ghost"
                        m={0}
                        className="folio-rail-button"
                        {...buttonState(isDocumentOpen)}
                    >
                        <FaFileUpload />
                    </IconButton>
                </Tooltip>
            )}
            {/* Previous Visit button */}
            <Box position="relative" display="inline-block">
                <Tooltip
                    content={
                        hasPreviousVisit
                            ? t("common.fab.previousVisit")
                            : t("common.fab.noPreviousVisit")
                    }
                    positioning={{
                        placement: "left",
                    }}
                >
                    <IconButton
                        id="fab-previous-visit"
                        onClick={onOpenPreviousVisit}
                        aria-label={previousVisitLabel}
                        aria-pressed={isPreviousVisitOpen}
                        size="xs"
                        borderRadius="full"
                        variant="ghost"
                        m={0}
                        className="folio-rail-button"
                        disabled={!hasPreviousVisit}
                        opacity={!hasPreviousVisit ? 0.4 : 1}
                        cursor={
                            !hasPreviousVisit ? "not-allowed" : "pointer"
                        }
                        {...(hasPreviousVisit
                            ? buttonState(isPreviousVisitOpen)
                            : { color: "folio.faint" })}
                    >
                        <FaClock />
                    </IconButton>
                </Tooltip>
                {showPreviousVisitDot && hasPreviousVisit && (
                    <Box
                        aria-hidden="true"
                        position="absolute"
                        top="0"
                        right="0"
                        w="8px"
                        h="8px"
                        borderRadius="full"
                        bg="folio.danger"
                        zIndex={2}
                        pointerEvents="none"
                    />
                )}
            </Box>
            {/* Chat button */}
            {isChatEnabled() && (
                <Tooltip
                    content={t("common.fab.chatWithPhlox")}
                    positioning={{
                        placement: "left",
                    }}
                >
                    <IconButton
                        id="fab-chat"
                        onClick={onOpenChat}
                        aria-label={t("common.fab.openChat")}
                        aria-pressed={isChatOpen}
                        size="xs"
                        borderRadius="full"
                        m={0}
                        variant="ghost"
                        className="folio-rail-button"
                        {...buttonState(isChatOpen)}
                    >
                        <ChatIcon />
                    </IconButton>
                </Tooltip>
            )}
            {/* Chart Insights button */}
            {isChatEnabled() && onOpenReasoning && (
                <Box position="relative" display="inline-block">
                    <Tooltip
                        content={
                            isEncounterSaved
                                ? t("common.fab.chartInsights")
                                : t("common.fab.saveForChartInsights")
                        }
                        positioning={{
                            placement: "left",
                        }}
                    >
                        <IconButton
                            id="fab-reasoning"
                            onClick={onOpenReasoning}
                            aria-label={reasoningLabel}
                            aria-pressed={isReasoningOpen}
                            size="xs"
                            borderRadius="full"
                            m={0}
                            variant="ghost"
                            className="folio-rail-button"
                            disabled={!isEncounterSaved}
                            opacity={!isEncounterSaved ? 0.4 : 1}
                            cursor={
                                !isEncounterSaved ? "not-allowed" : "pointer"
                            }
                            {...(isEncounterSaved
                                ? buttonState(isReasoningOpen)
                                : { color: "folio.faint" })}
                        >
                            <FaAtom />
                        </IconButton>
                    </Tooltip>
                    {hasCriticalReasoning && isEncounterSaved && (
                        <Box
                            aria-hidden="true"
                            position="absolute"
                            top="0"
                            right="0"
                            w="8px"
                            h="8px"
                            borderRadius="full"
                            bg="folio.danger"
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
                        ? t("common.fab.patientLetter")
                        : t("common.fab.saveForLetter")
                }
                positioning={{
                    placement: "left",
                }}
            >
                <IconButton
                    id="fab-letter"
                    onClick={onOpenLetter}
                    aria-label={t("common.fab.openLetter")}
                    aria-pressed={isLetterOpen}
                    size="sm"
                    borderRadius="full"
                    m={0}
                    variant="ghost"
                    className="folio-rail-button"
                    disabled={!isEncounterSaved}
                    opacity={!isEncounterSaved ? 0.4 : 1}
                    cursor={!isEncounterSaved ? "not-allowed" : "pointer"}
                    {...(isEncounterSaved
                        ? buttonState(isLetterOpen)
                        : { color: "folio.faint" })}
                >
                    <FaEnvelope />
                </IconButton>
            </Tooltip>
        </PillBox>
    );
};

export default FloatingActionMenu;
