import React from "react";
import { Button, Box, HStack } from "@chakra-ui/react";
import { Tooltip } from '@/components/ui/tooltip';
import { QuestionIcon } from "../../common/icons";

const QuickChatButtons = ({ userSettings, handleSendMessage }) => {
    if (!userSettings) return null;

    return (
        <HStack spacing="2" mb="2" width="100%" className="anim-fade-slide-up">
            {[1, 2, 3].map((n) => {
                const title = userSettings[`quick_chat_${n}_title`];
                const prompt = userSettings[`quick_chat_${n}_prompt`];
                if (!title || !prompt) return null;
                const showTip = title.length > 25;
                return (
                    <Tooltip
                        key={n}
                        content={title}
                        disabled={!showTip}
                        showArrow
                        fontSize="xs"
                        positioning={{
                            placement: "top"
                        }}
                    >
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendMessage(prompt)}
                            className="quick-chat-buttons-collapsed"
                            flex="1"
                            minWidth="0"><QuestionIcon /><Box
                                as="span"
                                overflow="hidden"
                                textOverflow="ellipsis"
                                whiteSpace="nowrap"
                                display="block"
                                textAlign="left"
                            >
                                {title}
                            </Box></Button>
                    </Tooltip>
                );
            })}
        </HStack>
    );
};

export default QuickChatButtons;
