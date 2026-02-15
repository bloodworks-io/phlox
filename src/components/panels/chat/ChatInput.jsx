import React from "react";
import { Flex, Input, IconButton } from "@chakra-ui/react";
import { ArrowUpIcon } from "@chakra-ui/icons";

const ChatInput = ({
    userInput,
    setUserInput,
    handleSendMessage,
    chatLoading,
}) => {
    return (
        <Flex mb="2">
            <Input
                placeholder="Ask Phlox anything..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) =>
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    (e.preventDefault(), handleSendMessage(userInput))
                }
                mr="2"
                size="sm"
                className="chat-input"
            />
            <IconButton
                icon={<ArrowUpIcon />}
                onClick={() => handleSendMessage(userInput)}
                isDisabled={!userInput.trim() || chatLoading}
                isLoading={chatLoading}
                size="sm"
                aria-label="Send Message"
                className="chat-send-button"
            />
        </Flex>
    );
};

export default ChatInput;
