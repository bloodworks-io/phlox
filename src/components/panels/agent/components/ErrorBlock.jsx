import React from "react";
import { Box, Text, HStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { LuRotateCcw } from "react-icons/lu";

export const ErrorBlock = ({ message, onRetry, onDismiss }) => {
    const { t } = useTranslation();

    return (
    <Box
        p={2.5}
        borderWidth="1px"
        borderColor="folio.danger"
        borderRadius="folioPanel"
        bg="folio.dangerSoft"
    >
        <Text fontSize="xs" fontWeight="semibold" color="folio.danger">
            {t("agent.status.connectionInterrupted")}
        </Text>
        <Text fontSize="xs" color="folio.muted" mt={0.5}>
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
                borderRadius="folioControl"
                border="1px solid"
                borderColor="folio.danger"
                color="folio.danger"
                cursor="pointer"
                fontSize="xs"
                transition="all 0.15s ease"
                _hover={{ bg: "folio.danger", color: "folio.dangerInk" }}
                onClick={onRetry}
            >
                <LuRotateCcw size="10px" strokeWidth={1.6} /> {t("agent.error.reconnect")}
            </Box>
            <Box
                as="button"
                display="inline-flex"
                alignItems="center"
                px={2.5}
                py={1.5}
                borderRadius="folioControl"
                border="1px solid"
                borderColor="folio.line"
                color="folio.muted"
                cursor="pointer"
                fontSize="xs"
                transition="all 0.15s ease"
                _hover={{ bg: "folio.hover", color: "folio.ink" }}
                onClick={onDismiss}
            >
                {t("agent.error.dismiss")}
            </Box>
        </HStack>
    </Box>
    );
};
