import React from "react";
import { Box, Text, Badge, HStack, VStack } from "@chakra-ui/react";

export const ReasoningItem = ({ item, section }) => {
    // Check if item is in legacy format (string) or new format (object)
    const isLegacyFormat = typeof item === "string";

    // Get border accent color for structured items
    const getAccentColor = (section) => {
        switch (section) {
            case "differentials":
                return "primaryButton";
            case "investigations":
                return "successButton";
            case "considerations":
                return "secondaryButton";
            default:
                return "neutralButton";
        }
    };

    const isCritical = !isLegacyFormat && item.critical === true;

    return (
        <Box
            p={2}
            borderRadius="sm"
            bg="cardBg"
            borderLeft="3px solid"
            borderColor={
                isCritical
                    ? "dangerButton"
                    : getAccentColor(section)
            }
            shadow="sm"
        >
            {isLegacyFormat ? (
                <Text fontSize="sm">{item}</Text>
            ) : (
                <>
                    <HStack gap={2} align="start">
                        <Text
                            fontWeight="medium"
                            fontSize="sm"
                            flex="1"
                        >
                            {item.suggestion}
                        </Text>
                        {isCritical && (
                            <Badge
                                colorPalette="red"
                                fontSize="xs"
                                textTransform="uppercase"
                            >
                                Critical
                            </Badge>
                        )}
                    </HStack>
                    {item.rationale &&
                        item.rationale.length > 0 && (
                            <VStack
                                align="stretch"
                                gap={0}
                                mt={1}
                            >
                                {item.rationale.map(
                                    (point, j) => (
                                        <Text
                                            key={j}
                                            fontSize="xs"
                                            color="textTertiary"
                                            pl={2}
                                        >
                                            • {point}
                                        </Text>
                                    ),
                                )}
                            </VStack>
                        )}
                </>
            )}
        </Box>
    );
};
