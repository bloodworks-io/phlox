import React from "react";
import { Box, Flex, Input, IconButton, Text, useColorMode } from "@chakra-ui/react";
import { ArrowUpIcon } from "@chakra-ui/icons";

const DashboardChatInput = ({
    value,
    onChange,
    onSend,
    isLoading,
    placeholder = "Message Phlox...",
    position = "centered", // "centered" | "bottom"
    showDisclaimer = true,
}) => {
    const { colorMode } = useColorMode();
    const isLight = colorMode === "light";

    const handleKeyPress = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    const isBottom = position === "bottom";

    return (
        <Flex
            position={isBottom ? "fixed" : "relative"}
            bottom={isBottom ? "20px" : "auto"}
            left={isBottom ? "50%" : "auto"}
            transform={isBottom ? "translateX(-50%)" : "none"}
            zIndex={isBottom ? "1000" : "auto"}
            direction="column"
            align="center"
            w="100%"
            maxW="800px"
            mx={isBottom ? "auto" : "0"}
            px={isBottom ? "20px" : "0"}
            flex={isBottom ? "none" : "0 0 auto"}
        >
            <Box
                className="dashboard-chat-input-container"
                w="100%"
                transition="all 0.3s ease"
            >
                <Flex align="center" gap={2}>
                    <Input
                        value={value}
                        onChange={onChange}
                        onKeyPress={handleKeyPress}
                        placeholder={placeholder}
                        variant="unstyled"
                        flex="1"
                        color={isLight ? "gray.800" : "white"}
                        _placeholder={{ color: isLight ? "gray.500" : "rgba(255, 255, 255, 0.6)" }}
                        fontSize="md"
                        isDisabled={isLoading}
                    />
                    <IconButton
                        icon={<ArrowUpIcon />}
                        onClick={onSend}
                        isDisabled={!value.trim() || isLoading}
                        isLoading={isLoading}
                        aria-label="Send message"
                        size="sm"
                        borderRadius="full"
                        bg={value.trim() ? (isLight ? "gray.700" : "white") : (isLight ? "gray.200" : "rgba(255, 255, 255, 0.2)")}
                        color={
                            value.trim()
                                ? (isLight ? "white" : "gray.800")
                                : (isLight ? "gray.400" : "rgba(255, 255, 255, 0.5)")
                        }
                        _hover={{
                            bg: value.trim()
                                ? (isLight ? "gray.600" : "gray.100")
                                : (isLight ? "gray.300" : "rgba(255, 255, 255, 0.3)"),
                            transform: "scale(1.05)",
                        }}
                        transition="all 0.2s ease"
                    />
                </Flex>
            </Box>
            {showDisclaimer && (
                <Text
                    textAlign="center"
                    fontSize="xs"
                    color="gray.500"
                    mt={2}
                    opacity={0.8}
                >
                    Phlox may make mistakes. Always verify critical information.
                </Text>
            )}
        </Flex>
    );
};

export default DashboardChatInput;
