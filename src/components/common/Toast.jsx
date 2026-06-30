// Custom toast component for displaying notifications with different statuses.
import { Alert, Box, CloseButton, Flex } from "@chakra-ui/react";
import {
  CheckCircleIcon,
  InfoIcon,
  WarningIcon,
  WarningTwoIcon,
} from "./icons";

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
    <Alert.Root
      status={status}
      variant={variant}
      id={ids?.root}
      colorPalette={colorScheme}
      marginTop="-5px"
      marginBottom="10px">
      <Flex align="center" gap={3}>
        {getStatusIcon(status)}
        <Box flex="1">
          {title && <Alert.Title id={ids?.title}>{title}</Alert.Title>}
          {description && (
            <Alert.Description id={ids?.description}>
              {description}
            </Alert.Description>
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
    </Alert.Root>
  );
}
