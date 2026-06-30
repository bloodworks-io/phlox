import React, { forwardRef } from "react";
import { useColorMode } from "../../ui/color-mode";
import { Box, Flex, Text, Button } from "@chakra-ui/react";
import { Tooltip } from '@/components/ui/tooltip';
import { FaAtom, FaSync } from "react-icons/fa";

import FloatingPanel from "../../common/FloatingPanel";
import { useReasoning } from "../../../utils/hooks/useReasoning";
import { ReasoningContent } from "./components/ReasoningContent";
import { LoadingStatus, LoadingOverlay } from "./components/LoadingStatus";
import { EmptyState } from "./components/EmptyState";

const ReasoningPanel = forwardRef(
    (
        { isOpen, onClose, noteId, initialReasoning, onReasoningGenerated },
        ref,
    ) => {
        const { colorMode } = useColorMode();
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
                        flexShrink={0}
                    >
                        <Flex align="center">
                            <FaAtom size="1em" style={{ marginRight: "8px" }} />
                            <Text fontWeight="bold">Clinical Reasoning</Text>
                        </Flex>
                        {reasoning && (
                            <Tooltip content="Regenerate reasoning">
                                <Button
                                    onClick={handleGenerateReasoning}
                                    loading={loading}
                                    size="xs"
                                    className="orange-button"><FaSync size="10px" />Regenerate
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
                            <ReasoningContent
                                reasoning={reasoning}
                                tabIndex={tabIndex}
                                setTabIndex={setTabIndex}
                                colorMode={colorMode}
                            />
                        ) : (
                            <EmptyState
                                loading={loading}
                                status={status}
                                onGenerate={handleGenerateReasoning}
                            />
                        )}
                    </Box>

                    {/* Resizer */}
                    <Box
                        ref={resizerRef}
                        position="absolute"
                        top="0"
                        left="0"
                        width="20px"
                        height="20px"
                        bg="transparent"
                        cursor="nwse-resize"
                        onMouseDown={handleMouseDown}
                    />

                    {/* Loading overlay with status */}
                    {loading && reasoning && status && (
                        <LoadingStatus status={status} colorMode={colorMode} />
                    )}
                    {loading && reasoning && !status && (
                        <LoadingOverlay colorMode={colorMode} />
                    )}
                </Box>
            </FloatingPanel>
        );
    },
);

export default ReasoningPanel;
