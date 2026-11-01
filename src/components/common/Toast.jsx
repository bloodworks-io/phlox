import { Box, Flex } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { LuX } from "react-icons/lu";
import {
    CheckCircleIcon,
    InfoIcon,
    WarningIcon,
    WarningTwoIcon,
} from "./icons";

// Status roles map toast types to their status color and icon.
const STATUS_ROLES = {
    success: { icon: CheckCircleIcon, color: "folio.success" },
    error: { icon: WarningTwoIcon, color: "folio.danger" },
    warning: { icon: WarningIcon, color: "folio.warning" },
    info: { icon: InfoIcon, color: "folio.info" },
};

export function CustomToast(props) {
    const { status, title, description, onClose } = props;
    const { t } = useTranslation();

    const role = STATUS_ROLES[status];
    const StatusIcon = role?.icon;

    return (
        <Box
            position="relative"
            width={{ md: "sm" }}
            backgroundColor="folio.paper"
            border="1px solid"
            borderColor="folio.line"
            borderRadius="folioPanel"
            boxShadow="overlay"
            color="folio.ink"
            px="4"
            py="3"
            marginTop="-5px"
            marginBottom="10px"
            pointerEvents="auto"
        >
            <Flex align="center" gap={3}>
                {StatusIcon && (
                    <StatusIcon boxSize={5} color={role.color} />
                )}
                <Box flex="1">
                    {title && (
                        <Box fontWeight="600" color="folio.ink" fontSize="md">
                            {title}
                        </Box>
                    )}
                    {description && (
                        <Box color="folio.muted" fontSize="sm">
                            {description}
                        </Box>
                    )}
                </Box>
            </Flex>
            <Box
                as="button"
                position="absolute"
                top="2"
                right="2"
                onClick={onClose}
                background="none"
                border="none"
                cursor="pointer"
                padding="2px"
                color="folio.muted"
                opacity={0.6}
                _hover={{ opacity: 1 }}
                aria-label={t("action.close")}
            >
                <LuX size={12} strokeWidth={1.6} />
            </Box>
        </Box>
    );
}
