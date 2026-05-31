import React from "react";
import { Flex, Spinner, Text, VStack } from "@chakra-ui/react";
import { colors } from "../../../../theme/colors";
import {
    FaWikipediaW,
    FaBookMedical,
    FaHistory,
    FaDatabase,
    FaCog,
} from "react-icons/fa";

const getStatusIcon = (status) => {
    const lower = status.toLowerCase();
    if (lower.includes("wikipedia") || lower.includes("wiki"))
        return FaWikipediaW;
    if (lower.includes("pubmed") || lower.includes("literature"))
        return FaBookMedical;
    if (lower.includes("encounter"))
        return FaHistory;
    if (lower.includes("guideline"))
        return FaDatabase;
    return FaCog; // Default / general
};

export const LoadingStatus = ({ status, colorMode }) => {
    if (!status) return null;

    const Icon = getStatusIcon(status);

    return (
        <Flex
            position="absolute"
            top="64px"
            left={0}
            right={0}
            bottom={0}
            justify="center"
            align="center"
            zIndex={2}
            bg={
                colorMode === "light"
                    ? "rgba(255,255,255,0.9)"
                    : "rgba(0,0,0,0.7)"
            }
            flexDirection="column"
            gap={4}
        >
            <VStack spacing={4}>
                <Spinner size="lg" color="orange.500" thickness="3px" />
                <Flex align="center" gap={3}>
                    <Icon size="1.2em" color="gray.500" />
                    <Text
                        fontSize="sm"
                        fontWeight="medium"
                        color="gray.700"
                        _dark={{ color: "gray.300" }}
                    >
                        {status}
                    </Text>
                </Flex>
            </VStack>
        </Flex>
    );
};

export const LoadingOverlay = ({ colorMode }) => {
    return (
        <Flex
            position="absolute"
            top="64px"
            left={0}
            right={0}
            bottom={0}
            justify="center"
            align="center"
            zIndex={2}
            bg={
                colorMode === "light"
                    ? "rgba(255,255,255,0.7)"
                    : "rgba(0,0,0,0.5)"
            }
        >
            <Spinner size="lg" />
        </Flex>
    );
};
