import React, { useEffect, useRef } from "react";
import { Box, Flex, Textarea, IconButton } from "@chakra-ui/react";
import { ArrowUpIcon } from "../../common/icons";

const MIN_HEIGHT = 32;
const MAX_HEIGHT = 72; // ~3 lines, then scroll

const ChatInput = ({
    userInput,
    setUserInput,
    handleSendMessage,
    chatLoading,
}) => {
    const textareaRef = useRef(null);

    const canSend = Boolean(userInput.trim()) && !chatLoading;

    const resizeTextarea = () => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = "auto";
        const nextHeight = Math.min(textarea.scrollHeight, MAX_HEIGHT);
        textarea.style.height = `${Math.max(nextHeight, MIN_HEIGHT)}px`;
        textarea.style.overflowY =
            textarea.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
    };

    useEffect(() => {
        resizeTextarea();
    }, [userInput]);

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (canSend) {
                handleSendMessage(userInput);
            }
        }
    };

    const handleChange = (e) => {
        setUserInput(e.target.value);
        resizeTextarea();
    };

    return (
        <Box className="dashboard-chat-input-container" w="100%" mb="2">
            <Flex align="center" gap={2}>
                <Textarea
                    ref={textareaRef}
                    value={userInput}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Message Phlox..."
                    rows={1}
                    resize="none"
                    variant="unstyled"
                    flex="1"
                    minH={`${MIN_HEIGHT}px`}
                    maxH={`${MAX_HEIGHT}px`}
                    py="1.5"
                    px="3"
                    fontSize="sm"
                    lineHeight="1.35"
                    color="sendButtonText"
                    _placeholder={{ color: "sendButtonTextDisabled" }}
                    _focusVisible={{
                        boxShadow: "none",
                    }}
                    disabled={chatLoading}
                />

                <IconButton
                    onClick={() => handleSendMessage(userInput)}
                    disabled={!canSend}
                    loading={chatLoading}
                    aria-label="Send message"
                    size="sm"
                    alignSelf="center"
                    borderRadius="full"
                    bg={canSend ? "sendButton" : "sendButtonDisabled"}
                    color={canSend ? "sendButtonText" : "sendButtonTextDisabled"}
                    _hover={{
                        bg: canSend
                            ? "sendButtonHover"
                            : "sendButtonHoverDisabled",
                        transform: "scale(1.05)",
                    }}
                    transition="all 0.2s ease"><ArrowUpIcon /></IconButton>
            </Flex>
        </Box>
    );
};

export default ChatInput;
