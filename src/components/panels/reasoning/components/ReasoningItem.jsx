import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Text, Badge, HStack, VStack } from "@chakra-ui/react";

export const ReasoningItem = ({ item, section }) => {
    const { t } = useTranslation();
    // Check if item is in legacy format (string) or new format (object)
    const isLegacyFormat = typeof item === "string";

    // Get border accent color for structured items
    const getAccentColor = (section) => {
        switch (section) {
            case "differentials":
                return "folio.info";
            case "investigations":
                return "folio.success";
            case "considerations":
                return "folio.warning";
            default:
                return "folio.accent";
        }
    };

    const isCritical = !isLegacyFormat && item.critical === true;

    return (
        <Box
            p={2}
            borderRadius="sm"
            bg="folio.paper"
            borderLeft="3px solid"
            borderColor={
                isCritical
                    ? "folio.danger"
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
                                bg="folio.danger"
                                color="folio.dangerInk"
                                fontSize="xs"
                                textTransform="uppercase"
                            >
                                {t("reasoning.priority")}
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
                                            color="folio.muted"
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
