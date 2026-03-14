import React from "react";
import { Box, Text, VStack, HStack, Tooltip } from "@chakra-ui/react";
import {
    FaWikipediaW,
    FaBookMedical,
    FaHistory,
    FaDatabase,
    FaGlobe,
} from "react-icons/fa";

const getCitationIcon = (citation) => {
    const lower = citation.toLowerCase();
    if (lower.includes("wikipedia") || lower.includes("wiki:"))
        return FaWikipediaW;
    if (lower.includes("pubmed")) return FaBookMedical;
    if (
        lower.includes("previous encounter") ||
        lower.includes("encounter from")
    )
        return FaHistory;
    if (
        lower.includes("clinical guidelines") ||
        lower.includes("according to")
    )
        return FaDatabase;
    return FaGlobe; // MCP tools / other
};

export const CitationList = ({ citations, colorMode }) => {
    if (!citations || citations.length === 0) return null;

    return (
        <Box
            mt={4}
            pt={3}
            borderTop="1px solid"
            borderColor="gray.200"
            _dark={{
                borderColor: "gray.700",
            }}
        >
            <Text
                fontSize="xs"
                fontWeight="medium"
                color="gray.500"
                _dark={{
                    color: "gray.400",
                }}
                mb={2}
            >
                Sources Used
            </Text>
            <VStack
                align="stretch"
                spacing={2}
            >
                {citations.map(
                    (citation, i) => {
                        const Icon = getCitationIcon(
                            citation,
                        );
                        return (
                            <HStack
                                key={i}
                                spacing={2}
                                align="start"
                            >
                                <Icon
                                    color="blue.500"
                                    mt="2px"
                                />
                                <Tooltip
                                    label={
                                        citation
                                    }
                                    placement="top"
                                    hasArrow
                                    fontSize="xs"
                                    maxWidth="400px"
                                >
                                    <Text
                                        as="span"
                                        fontSize="xs"
                                        color="gray.600"
                                        _dark={{
                                            color: "gray.400",
                                        }}
                                        cursor="pointer"
                                        noOfLines={2}
                                        title={
                                            citation
                                        }
                                    >
                                        {citation.length >
                                        100
                                            ? citation.substring(
                                                  0,
                                                  100,
                                              ) +
                                              "..."
                                            : citation}
                                    </Text>
                                </Tooltip>
                            </HStack>
                        );
                    },
                )}
            </VStack>
        </Box>
    );
};
