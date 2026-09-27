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
                    content={t("common.fab.uploadDocument")}
                    positioning={{
                        placement: "left",
                    }}
                >
                    <IconButton
                        id="fab-document"
                        onClick={onOpenDocument}
                        aria-label={t("common.fab.openDocumentUpload")}
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
                        aria-label={t("common.fab.openPreviousVisit")}
                        size="xs"
                        borderRadius="full"
                        variant="ghost"
                        m={0}
                        bg={getButtonBg(isPreviousVisitOpen)}
                        _hover={{ bg: surfaceBg }}
                        className="pill-box-icons"
                        disabled={!hasPreviousVisit}
                        opacity={!hasPreviousVisit ? 0.4 : 1}
                        cursor={
                            !hasPreviousVisit ? "not-allowed" : "pointer"
                        }
                    >
                        <FaClock />
                    </IconButton>
                </Tooltip>
                {showPreviousVisitDot && hasPreviousVisit && (
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
                    content={t("common.fab.chatWithPhlox")}
                    positioning={{
                        placement: "left",
                    }}
                >
                    <IconButton
                        id="fab-chat"
                        onClick={onOpenChat}
                        aria-label={t("common.fab.openChat")}
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
                            aria-label={t("common.fab.openReasoning")}
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
