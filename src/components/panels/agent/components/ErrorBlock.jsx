import React from "react";
import { Box, Text, HStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FaRedo } from "react-icons/fa";

export const ErrorBlock = ({ message, onRetry, onDismiss }) => {
    const { t } = useTranslation();

    return (
    <Box
        p={2.5}
        borderWidth="1px"
        borderColor="dangerButton"
        borderRadius="8px"
        bg="dangerButtonFaint"
    >
        <Text fontSize="xs" fontWeight="semibold" color="dangerButton">
            {t("agent.status.connectionInterrupted")}
        </Text>
        <Text fontSize="xs" color="fg.subtle" mt={0.5}>
            {message || t("agent.error.fallback")}{" "}
            {t("agent.error.draftsStillAvailable")}
        </Text>
        <HStack gap={2} mt={2}>
            <Box
                as="button"
                display="inline-flex"
                alignItems="center"
                gap={1.5}
                px={2.5}
                py={1.5}
                borderRadius="6px"
                border="1px solid"
                borderColor="dangerButton"
                color="dangerButton"
                cursor="pointer"
                fontSize="xs"
                transition="all 0.15s ease"
                _hover={{ bg: "dangerButton", color: "invertedText" }}
                onClick={onRetry}
            >
                <FaRedo size="10px" /> {t("agent.error.reconnect")}
            </Box>
            <Box
                as="button"
                display="inline-flex"
                alignItems="center"
                px={2.5}
                py={1.5}
                borderRadius="6px"
                border="1px solid"
                borderColor="surface"
                color="fg.subtle"
                cursor="pointer"
                fontSize="xs"
                transition="all 0.15s ease"
                _hover={{ bg: "surface", color: "fg.muted" }}
                onClick={onDismiss}
            >
                {t("agent.error.dismiss")}
            </Box>
        </HStack>
    </Box>
    );
};
