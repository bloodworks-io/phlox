import React, { useEffect, useRef } from "react";
import { Box, Flex, Textarea, IconButton } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { ArrowUpIcon } from "../../common/icons";

const MIN_HEIGHT = 32;
const MAX_HEIGHT = 72; // ~3 lines, then scroll

const ChatInput = ({
    userInput,
    setUserInput,
    handleSendMessage,
    chatLoading,
}) => {
    const { t } = useTranslation();
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
        <Box
            className="attached-chat-input"
            w="100%"
            mb="2"
            backgroundColor="folio.paperAlt"
            border="1px solid"
            borderColor="folio.line"
            borderRadius="folioControl"
            p="10px 16px"
        >
            <Flex align="center" gap={2}>
                <Textarea
                    ref={textareaRef}
                    value={userInput}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder={t("chat.input.placeholder")}
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
                    color="folio.ink"
                    _placeholder={{ color: "folio.faint" }}
                    _focusVisible={{
                        boxShadow: "none",
                    }}
                    disabled={chatLoading}
                />

                <IconButton
                    onClick={() => handleSendMessage(userInput)}
                    disabled={!canSend}
                    loading={chatLoading}
                    aria-label={t("chat.input.send")}
                    size="sm"
                    alignSelf="center"
                    borderRadius="full"
                    bg={canSend ? "folio.accent" : "folio.paper"}
                    color={canSend ? "folio.accentInk" : "folio.faint"}
                    borderColor={canSend ? "folio.accent" : "folio.line"}
                    borderWidth="1px"
                    _hover={{
                        bg: canSend ? "folio.accent/90" : "folio.paper",
                        color: canSend ? "folio.accentInk" : "folio.faint",
                    }}
                    _focusVisible={{
                        outline: "2px solid",
                        outlineColor: "folio.focus",
                        outlineOffset: "2px",
                    }}
                    transition="color 160ms ease, background-color 160ms ease, border-color 160ms ease, opacity 160ms ease"
                ><ArrowUpIcon /></IconButton>
            </Flex>
        </Box>
    );
};

export default ChatInput;
