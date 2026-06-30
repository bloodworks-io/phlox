import React from "react";
import { Box, Text, VStack, HStack } from "@chakra-ui/react";
import { Tooltip } from '@/components/ui/tooltip';
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

export const CitationList = ({ citations, colorMode, inline = false }) => {
    if (!citations || citations.length === 0) return null;

    const unique = [...new Set(citations)];

    return (
        <Box
            mt={inline ? 2 : 4}
            pt={inline ? 2 : 3}
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
                gap={2}
            >
                {unique.map(
                    (citation, i) => {
                        const Icon = getCitationIcon(
                            citation,
                        );
                        return (
                            <HStack
                                key={i}
                                gap={2}
                                align="start"
                            >
                                <Icon
                                    color="blue.500"
                                    mt="2px"
                                />
                                <Tooltip
                                    content={
                                        citation
                                    }
                                    showArrow
                                    fontSize="xs"
                                    maxWidth="400px"
                                    positioning={{
                                        placement: "top"
                                    }}
                                >
                                    <Text
                                        as="span"
                                        fontSize="xs"
                                        color="gray.600"
                                        _dark={{
                                            color: "gray.400",
                                        }}
                                        cursor="pointer"
                                        lineClamp={2}
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
