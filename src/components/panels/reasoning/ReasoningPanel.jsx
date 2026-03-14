import React, { forwardRef } from "react";
import { Box, Flex, Text, Button, useColorMode, Tooltip } from "@chakra-ui/react";
import { FaAtom, FaSync } from "react-icons/fa";

import FloatingPanel from "../../common/FloatingPanel";
import { useReasoning } from "../../../utils/hooks/useReasoning";
import { ReasoningContent } from "./components/ReasoningContent";
import { LoadingStatus, LoadingOverlay } from "./components/LoadingStatus";
import { EmptyState } from "./components/EmptyState";

const ReasoningPanel = forwardRef(
    (
        { isOpen, onClose, patientId, initialReasoning, onReasoningGenerated },
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
            patientId,
            initialReasoning,
            onReasoningGenerated,
        });

        return (
            <FloatingPanel
                isOpen={isOpen}
                position="left-of-fab"
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
                        p="4"
                        className="panel-header"
                        flexShrink={0}
                    >
                        <Flex align="center">
                            <FaAtom size="1em" style={{ marginRight: "8px" }} />
                            <Text fontWeight="bold">Clinical Reasoning</Text>
                        </Flex>
                        {reasoning && (
                            <Tooltip label="Regenerate reasoning">
                                <Button
                                    leftIcon={<FaSync size="10px" />}
                                    onClick={handleGenerateReasoning}
                                    isLoading={loading}
                                    size="xs"
                                    className="orange-button"
                                >
                                    Regenerate
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
