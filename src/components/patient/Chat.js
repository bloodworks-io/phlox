import {
    Box,
    Flex,
    IconButton,
    Text,
    Tooltip,
    Input,
    Spinner,
    Button,
    HStack,
} from "@chakra-ui/react";
import {
    CloseIcon,
    ArrowUpIcon,
    QuestionIcon,
    ChatIcon,
} from "@chakra-ui/icons";
import { useEffect, useRef, useState } from "react";
import styled from "@emotion/styled";
import { keyframes } from "@emotion/react";

const loadingGradient = keyframes`
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
`;

const slideUp = keyframes`
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

const LoadingBox = styled(Box)`
    position: relative;
    overflow: hidden;

    &::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.4) 50%,
            rgba(255, 255, 255, 0) 100%
        );
        animation: ${loadingGradient} 1.5s ease-in-out infinite;
        background-size: 200% 100%;
    }
`;

const AnimatedHStack = styled(HStack)`
    animation: ${slideUp} 0.5s ease-out forwards;
`;

const Chat = ({
    chatExpanded,
    setChatExpanded,
    chatLoading,
    messages,
    setMessages,
    userInput,
    setUserInput,
    handleChat,
    showSuggestions,
    setShowSuggestions,
    rawTranscription,
    currentTemplate,
    patientData,
    patientId,
}) => {
    const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
    const messagesEndRef = useRef(null);
    const resizerRef = useRef(null);
    const [showTooltip, setShowTooltip] = useState(null);
    const [userSettings, setUserSettings] = useState(null);
    const isTemplateLoaded = currentTemplate?.fields !== undefined;

    const filteredMessages = messages.filter(
        (message) => message.role !== "system",
    );

    useEffect(() => {
        const fetchUserSettings = async () => {
            try {
                const response = await fetch("/api/config/user");
                if (!response.ok)
                    throw new Error("Failed to fetch user settings");
                const data = await response.json();
                setUserSettings(data);
            } catch (error) {
                console.error("Error fetching user settings:", error);
            }
        };
        fetchUserSettings();
    }, []);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    useEffect(() => {
        setMessages([]);
        setUserInput("");
    }, [patientId, setMessages, setUserInput]);

    const handleSendMessage = async (message) => {
        if (message.trim()) {
            handleChat(message, patientData, currentTemplate, rawTranscription);
            setUserInput("");
            setShowSuggestions(false);
        }
    };

    const handleMouseDown = (e) => {
        e.preventDefault();
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    };

    const handleMouseMove = (e) => {
        setDimensions((prev) => ({
            width:
                prev.width -
                (e.clientX - resizerRef.current.getBoundingClientRect().left),
            height:
                prev.height -
                (e.clientY - resizerRef.current.getBoundingClientRect().top),
        }));
    };

    const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
    };

    // Show quick chat buttons only when we have messages and not showing suggestions in main area
    const shouldShowQuickChatButtons =
        filteredMessages.length > 0 &&
        userSettings &&
        (!showSuggestions || filteredMessages.length > 0);

    return (
        <Box
            position="fixed"
            bottom="20px"
            right="20px"
            zIndex="1000"
            className="hover-chat-box"
        >
            {!chatExpanded && (
                <IconButton
                    icon={<ChatIcon boxSize="1.5em" />}
                    colorScheme="purple"
                    onClick={() => setChatExpanded(true)}
                    aria-label="Open Chat"
                    borderRadius="full"
                    size="lg"
                    bg="#c4a7e7"
                    className="chat-icon"
                    boxShadow="md"
                    width="3em"
                    height="3em"
                    fontSize="2xl"
                />
            )}
            {chatExpanded && (
                <Box
                    width={`${dimensions.width}px`}
                    height={`${dimensions.height - 24}px`}
                    borderRadius="xl"
                    boxShadow="md"
                    overflow="hidden"
                    position="relative"
                    className="chat-panel"
                >
                    <Box
                        borderRadius="xl"
                        display="flex"
                        flexDirection="column"
                        height="100%"
                    >
                        {/* Header */}
                        <Flex align="center" justify="space-between" p="4">
                            <Text>Chat With Phlox</Text>
                            <IconButton
                                icon={<CloseIcon />}
                                onClick={() => setChatExpanded(false)}
                                aria-label="Close chat"
                                variant="outline"
                                size="sm"
                                className="collapse-toggle"
                            />
                        </Flex>

                        {/* Messages Area */}
                        <Box
                            flex="1"
                            overflowY="auto"
                            p="4"
                            borderRadius="sm"
                            className="chat-main"
                        >
                            {filteredMessages.map((message, index) => (
                                <Flex
                                    key={`${index}-${
                                        message.content?.length || 0
                                    }`}
                                    justify={
                                        message.role === "assistant"
                                            ? "flex-start"
                                            : "flex-end"
                                    }
                                    mb="2"
                                >
                                    <Box
                                        className={`message-box ${message.role}`}
                                        px="4"
                                        py="2"
                                        borderRadius="sm"
                                        maxWidth="80%"
                                        fontSize="11pt"
                                    >
                                        {message.loading ? (
                                            <Spinner size="sm" />
                                        ) : (
                                            <>
                                                <Text whiteSpace="pre-wrap">
                                                    {message.content}
                                                </Text>
                                                {message.role === "assistant" &&
                                                    message.context && (
                                                        <>
                                                            {Object.keys(
                                                                message.context,
                                                            ).map((key) => {
                                                                const tooltipId = `${index}-${key}`;
                                                                return (
                                                                    <Tooltip
                                                                        key={
                                                                            tooltipId
                                                                        }
                                                                        label={
                                                                            message
                                                                                .context[
                                                                                key
                                                                            ]
                                                                        }
                                                                        placement="top"
                                                                        hasArrow
                                                                        fontSize="13"
                                                                        maxWidth="500px"
                                                                        shouldWrapChildren
                                                                    >
                                                                        <Text
                                                                            as="span"
                                                                            color="blue.500"
                                                                            cursor="pointer"
                                                                        >
                                                                            [
                                                                            {
                                                                                key
                                                                            }
                                                                            ]
                                                                        </Text>
                                                                    </Tooltip>
                                                                );
                                                            })}
                                                        </>
                                                    )}
                                            </>
                                        )}
                                    </Box>
                                </Flex>
                            ))}

                            {/* Chat suggestions - only show when no messages exist */}
                            {showSuggestions &&
                                filteredMessages.length === 0 &&
                                userSettings && (
                                    <Flex
                                        justify="center"
                                        mb="4"
                                        flexWrap="wrap"
                                        transform="translateY(40%)"
                                    >
                                        {[1, 2, 3].map((num) => {
                                            const title =
                                                userSettings[
                                                    `quick_chat_${num}_title`
                                                ];
                                            const prompt =
                                                userSettings[
                                                    `quick_chat_${num}_prompt`
                                                ];
                                            if (!title || !prompt) return null;
                                            return (
                                                <Button
                                                    key={num}
                                                    leftIcon={<QuestionIcon />}
                                                    m="2"
                                                    onClick={() =>
                                                        handleSendMessage(
                                                            prompt,
                                                        )
                                                    }
                                                    className="chat-suggestions"
                                                >
                                                    {title}
                                                </Button>
                                            );
                                        })}
                                    </Flex>
                                )}

                            <div ref={messagesEndRef} />
                        </Box>

                        {/* Input Area */}
                        <Box p="4">
                            {/* Quick chat buttons row - only show after messages have been sent */}
                            {shouldShowQuickChatButtons && (
                                <AnimatedHStack
                                    spacing="2"
                                    mb="2"
                                    justifyContent="space-between"
                                    width="100%"
                                >
                                    {[1, 2, 3].map((num) => {
                                        const title =
                                            userSettings[
                                                `quick_chat_${num}_title`
                                            ];
                                        const prompt =
                                            userSettings[
                                                `quick_chat_${num}_prompt`
                                            ];
                                        if (!title || !prompt) return null;

                                        return (
                                            <Tooltip
                                                key={num}
                                                label={title}
                                                placement="top"
                                                isDisabled={title.length <= 20}
                                            >
                                                <Button
                                                    leftIcon={<QuestionIcon />}
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        handleSendMessage(
                                                            prompt,
                                                        )
                                                    }
                                                    className="quick-chat-buttons-collapsed"
                                                    width="100%"
                                                >
                                                    <Box
                                                        className="quick-chat-buttons-text"
                                                        width="100%"
                                                    >
                                                        {title}
                                                    </Box>
                                                </Button>
                                            </Tooltip>
                                        );
                                    })}
                                </AnimatedHStack>
                            )}

                            <Flex mb="2">
                                <Input
                                    placeholder="Type your message..."
                                    value={userInput}
                                    onChange={(e) => {
                                        setUserInput(e.target.value);
                                    }}
                                    onKeyPress={(e) =>
                                        e.key === "Enter" &&
                                        handleSendMessage(userInput)
                                    }
                                    mr="2"
                                />
                                <IconButton
                                    icon={<ArrowUpIcon />}
                                    onClick={() => handleSendMessage(userInput)}
                                    colorScheme="purple"
                                    borderRadius="full"
                                    size="md"
                                    aria-label="Send"
                                />
                            </Flex>

                            {/* Disclaimer */}
                            <Text
                                textAlign="center"
                                fontSize="13"
                                fontWeight="normal"
                            >
                                LLMs make mistakes. Always verify output.
                            </Text>
                        </Box>
                    </Box>

                    {/* Resizer */}
                    <Box
                        ref={resizerRef}
                        position="absolute"
                        top="0"
                        left="0"
                        width="20px"
                        height="20px"
                        bg="transparent"
                        cursor="nwse-resize"
                        onMouseDown={handleMouseDown}
                    />
                </Box>
            )}
        </Box>
    );
};

export default Chat;
