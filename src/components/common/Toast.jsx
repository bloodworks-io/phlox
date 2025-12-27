// Custom toast component for displaying notifications with different statuses.
import {
    Alert,
    AlertTitle,
    AlertDescription,
    Box,
    CloseButton,
    Flex,
} from "@chakra-ui/react";
import {
    CheckCircleIcon,
    InfoIcon,
    WarningIcon,
    WarningTwoIcon,
} from "@chakra-ui/icons";

export function CustomToast(props) {
    const {
        status,
        variant = "solid",
        id,
        title,
        description,
        isClosable,
        onClose,
        colorScheme,
    } = props;

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

    const ids = id
        ? {
              root: `toast-${id}`,
              title: `toast-${id}-title`,
              description: `toast-${id}-description`,
          }
        : undefined;

    return (
        <Alert
            addRole={false}
            status={status}
            variant={variant}
            id={ids?.root}
            colorScheme={colorScheme}
            borderRadius="sm"
            marginTop="-5px"
            marginBottom="10px"
        >
            <Flex align="center" gap={3}>
                {getStatusIcon(status)}
                <Box flex="1">
                    {title && <AlertTitle id={ids?.title}>{title}</AlertTitle>}
                    {description && (
                        <AlertDescription id={ids?.description}>
                            {description}
                        </AlertDescription>
                    )}
                </Box>
            </Flex>
            {isClosable && (
                <CloseButton
                    size="sm"
                    onClick={onClose}
                    position="absolute"
                    top={2}
                    right={2}
                    className="dark-toggle"
                />
            )}
        </Alert>
    );
}
