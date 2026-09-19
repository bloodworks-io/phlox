import React from "react";
import { Box, Text, HStack } from "@chakra-ui/react";
import { FaChevronUp } from "react-icons/fa";

import { AgentSymbol, StatusDot } from "./agentVisuals";
import { getStatusInfo } from "./agentStatus";

/* Minimised surface: one compact status bar above the scribe pill. */
export const LiveBar = ({ status, agentState, artifacts, onExpand }) => {
    const info = getStatusInfo(status, agentState);

    // The animation's transform would clobber the wrapper's translateX(-50%).
    return (
        <Box
            position="fixed"
            bottom="85px"
            left="50%"
            transform="translateX(-50%)"
            zIndex="1060"
        >
            <Box
                as="button"
                className="live-bar anim-fade-slide-up"
                display="flex"
                alignItems="center"
                gap={2.5}
                pl={3}
                pr={2.5}
                py={1.5}
                cursor="pointer"
                width="min(280px, calc(100vw - 48px))"
                onClick={onExpand}
                aria-label={`Live agent — ${info.label}. Expand live panel`}
            >
                <AgentSymbol
                    pulse={info.pulse}
                    boxSize="26px"
                    iconSize="11px"
                    radius="8px"
                />
                <Box flex="1" minW="0" textAlign="left">
                    <Text fontSize="xs" fontWeight="semibold" lineHeight="1.3">
                        Live agent
                    </Text>
                    <HStack gap={1.5} mt="2px">
                        <StatusDot color={info.color} pulse={info.pulse} />
                        <Text fontSize="xs" color="fg.subtle" truncate minW="0">
                            {info.label}
                        </Text>
                    </HStack>
                </Box>
                {artifacts.length > 0 && (
                    <Text
                        fontSize="xs"
                        color="accent"
                        bg="primaryButtonFaint"
                        borderRadius="full"
                        px={2}
                        py={0.5}
                        flexShrink={0}
                        whiteSpace="nowrap"
                    >
                        {artifacts.length} to review
                    </Text>
                )}
                <Box
                    as="span"
                    color="fg.subtle"
                    flexShrink={0}
                    display="flex"
                    alignItems="center"
                >
                    <FaChevronUp size="10px" />
                </Box>
            </Box>
        </Box>
    );
};
