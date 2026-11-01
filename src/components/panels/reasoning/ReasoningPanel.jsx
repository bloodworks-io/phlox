import React, { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { Box, Flex, Text, Button } from "@chakra-ui/react";
import { Tooltip } from '@/components/ui/tooltip';
import { LuAtom, LuRefreshCw } from "react-icons/lu";

import FloatingPanel from "../../common/FloatingPanel";
import { useReasoning } from "../../../utils/hooks/useReasoning";
import { ReasoningContent } from "./components/ReasoningContent";
import { LoadingStatus, LoadingOverlay } from "./components/LoadingStatus";
import { EmptyState } from "./components/EmptyState";

const ReasoningPanel = forwardRef(
    (
        { isOpen, _onClose, noteId, initialReasoning, onReasoningGenerated },
        _ref,
    ) => {
        const { t } = useTranslation();
        const {
            loading,
            reasoning,
            status,
            tabIndex,
            setTabIndex,
            dimensions,
            resizerRef,
            handleGenerateReasoning,
            handleMouseDown,
        } = useReasoning({
            noteId,
            initialReasoning,
            onReasoningGenerated,
        });

        return (
            <FloatingPanel
                isOpen={isOpen}
                position="left-of-fab-grow-down"
                showArrow={true}
                triggerId="fab-reasoning"
                width={`${dimensions.width}px`}
                height={`${dimensions.height}px`}
                zIndex="1060"
            >
                <Box
                    borderRadius="lg"
                    display="flex"
                    flexDirection="column"
                    height="100%"
                    position="relative"
                >
                    {/* Header */}
                    <Flex
                        align="center"
                        justify="space-between"
                        p="3"
                        className="panel-header"
                        backgroundColor="folio.paper"
                        color="folio.ink"
                        borderBottomColor="folio.line"
                        flexShrink={0}
                    >
                        <Flex align="center" color="folio.accent">
                            <LuAtom size="1em" strokeWidth={1.6} style={{ marginRight: "8px" }} />
                            <Text fontWeight="bold">{t("common.fab.chartInsights")}</Text>
                        </Flex>
                        {reasoning && (
                            <Tooltip content={t("reasoning.regenerateTooltip")}>
                                <Button
                                    onClick={handleGenerateReasoning}
                                    loading={loading}
                                    size="xs"
                                    variant="folioSecondary"><LuRefreshCw size="10px" strokeWidth={1.6} />{t("reasoning.regenerate")}
                                                                    </Button>
                            </Tooltip>
                        )}
                    </Flex>

                    {/* Content */}
                    <Box
                        flex="1"
                        overflow="hidden"
                        display="flex"
                        flexDirection="column"
                    >
                        {reasoning ? (
                            <Box
                                flex="1"
                                display="flex"
                                flexDirection="column"
                                overflow="hidden"
                                className="anim-fade-scale"
                                css={{ animationDuration: "0.25s" }}
                            >
                                <ReasoningContent
                                    reasoning={reasoning}
                                    tabIndex={tabIndex}
                                    setTabIndex={setTabIndex}
                                />
                            </Box>
                        ) : (
                            <EmptyState
                                loading={loading}
                                status={status}
                                onGenerate={handleGenerateReasoning}
                            />
                        )}
                    </Box>

                    {/* Disclaimer */}
                    <Text
                        textAlign="center"
                        fontSize="xs"
                        color="folio.faint"
                        px="3"
                        pb="2"
                        flexShrink={0}
                    >
                        {t("reasoning.disclaimer")}
                    </Text>

                    {/* Resizer */}
                    <Box
                        ref={resizerRef}
                        position="absolute"
                        bottom="0"
                        left="0"
                        width="20px"
                        height="20px"
                        bg="transparent"
                        cursor="nesw-resize"
                        onMouseDown={handleMouseDown}
                    />

                    {/* Loading overlay with status */}
                    {loading && reasoning && status && (
                        <LoadingStatus status={status} />
                    )}
                    {loading && reasoning && !status && <LoadingOverlay />}
                </Box>
            </FloatingPanel>
        );
    },
);

export default ReasoningPanel;
