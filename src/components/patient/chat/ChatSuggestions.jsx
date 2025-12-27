import React from "react";
import { Flex, Button } from "@chakra-ui/react";
import { QuestionIcon } from "@chakra-ui/icons";

const ChatSuggestions = ({ handleSendMessage, userSettings }) => {
    if (!userSettings) return null;

    return (
        <Flex
            justify="center"
            align="center"
            flex="1"
            flexDirection="column"
            wrap="wrap"
        >
            <Flex wrap="wrap" justify="center">
                {[1, 2, 3].map((n) => {
                    const title = userSettings[`quick_chat_${n}_title`];
                    const prompt = userSettings[`quick_chat_${n}_prompt`];
                    if (!title || !prompt) return null;
                    return (
                        <Button
                            key={n}
                            leftIcon={<QuestionIcon />}
                            m="1.5"
                            size="md"
                            variant="outline"
                            onClick={() => handleSendMessage(prompt)}
                            className="chat-suggestions"
                        >
                            {title}
                        </Button>
                    );
                })}
            </Flex>
        </Flex>
    );
};

export default ChatSuggestions;
