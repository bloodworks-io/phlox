import { Box, Flex } from "@chakra-ui/react";
import { useColorMode } from "../ui/color-mode";
import { colors } from "../../theme/colors";
import { FaTimes } from "react-icons/fa";
import {
    CheckCircleIcon,
    InfoIcon,
    WarningIcon,
    WarningTwoIcon,
} from "./icons";

export function CustomToast(props) {
    const { status, title, description, onClose } = props;

    const { colorMode } = useColorMode();
    const c = colors[colorMode];

    const getStatusIcon = (status) => {
        switch (status) {
            case "success":
                return <CheckCircleIcon boxSize={5} className="green-icon" />;
            case "error":
                return <WarningTwoIcon boxSize={5} className="red-icon" />;
            case "warning":
                return <WarningIcon boxSize={5} className="yellow-icon" />;
            case "info":
                return <InfoIcon boxSize={5} className="blue-icon" />;
            default:
                return null;
        }
    };

    return (
        <Box
            position="relative"
            width={{ md: "sm" }}
            backgroundColor={c.base}
            border="1px solid"
            borderColor={c.surface}
            borderRadius="lg"
            boxShadow="none"
            px="4"
            py="3"
            marginTop="-5px"
            marginBottom="10px"
            pointerEvents="auto"
        >
            <Flex align="center" gap={3}>
                {getStatusIcon(status)}
                <Box flex="1">
                    {title && (
                        <Box
                            fontWeight="600"
                            color={c.textPrimary}
                            fontSize="md"
                            css={{ fontFamily: '"Roboto", sans-serif' }}
                        >
                            {title}
                        </Box>
                    )}
                    {description && (
                        <Box
                            color={c.textSecondary}
                            fontSize="sm"
                            css={{ fontFamily: '"Roboto", sans-serif' }}
                        >
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
                color={c.textSecondary}
                opacity={0.6}
                _hover={{ opacity: 1 }}
                aria-label="Close"
            >
                <FaTimes size={12} />
            </Box>
        </Box>
    );
}
