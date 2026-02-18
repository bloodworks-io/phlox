import React from "react";
import { Tooltip, Button, Box } from "@chakra-ui/react";
import { QuestionIcon } from "@chakra-ui/icons";
import { emergeFromButton, AnimatedHStack } from "../../../theme/animations";

const QuickChatButtons = ({ userSettings, handleSendMessage }) => {
    if (!userSettings) return null;

    return (
        <AnimatedHStack spacing="2" mb="2" width="100%">
            {[1, 2, 3].map((n) => {
                const title = userSettings[`quick_chat_${n}_title`];
                const prompt = userSettings[`quick_chat_${n}_prompt`];
                if (!title || !prompt) return null;
                const showTip = title.length > 25;
                return (
                    <Tooltip
                        key={n}
                        label={title}
                        placement="top"
                        isDisabled={!showTip}
                        hasArrow
                        fontSize="xs"
                    >
                        <Button
                            leftIcon={<QuestionIcon />}
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendMessage(prompt)}
                            className="quick-chat-buttons-collapsed"
                            flex="1"
                            minWidth="0"
                        >
                            <Box
                                as="span"
                                overflow="hidden"
                                textOverflow="ellipsis"
                                whiteSpace="nowrap"
                                display="block"
                                textAlign="left"
                            >
                                {title}
                            </Box>
                        </Button>
                    </Tooltip>
                );
            })}
        </AnimatedHStack>
    );
};

export default QuickChatButtons;
