import React from "react";
import { Box, Text, Badge, HStack, VStack } from "@chakra-ui/react";
import { colors } from "../../../../theme/colors";

export const ReasoningItem = ({ item, section, colorMode }) => {
    // Check if item is in legacy format (string) or new format (object)
    const isLegacyFormat = typeof item === "string";

    // Get border accent color for structured items
    const getAccentColor = (section) => {
        switch (section) {
            case "differentials":
                return colors.light.primaryButton;
            case "investigations":
                return colors.light.successButton;
            case "considerations":
                return colors.light.secondaryButton;
            default:
                return colors.light.neutralButton;
        }
    };

    const isCritical = !isLegacyFormat && item.critical === true;

    return (
        <Box
            p={2}
            borderRadius="sm"
            bg={
                colorMode === "light"
                    ? "white"
                    : colors.dark.surface
            }
            borderLeft="3px solid"
            borderColor={
                isCritical
                    ? "red.500"
                    : getAccentColor(section)
            }
            shadow="sm"
        >
            {isLegacyFormat ? (
                <Text fontSize="sm">{item}</Text>
            ) : (
                <>
                    <HStack spacing={2} align="start">
                        <Text
                            fontWeight="medium"
                            fontSize="sm"
                            flex="1"
                        >
                            {item.suggestion}
                        </Text>
                        {isCritical && (
                            <Badge
                                colorScheme="red"
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
                                spacing={0}
                                mt={1}
                            >
                                {item.rationale.map(
                                    (point, j) => (
                                        <Text
                                            key={j}
                                            fontSize="xs"
                                            color={
                                                colorMode ===
                                                "light"
                                                    ? "gray.600"
                                                    : "gray.400"
                                            }
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
