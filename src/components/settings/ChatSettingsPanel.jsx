import { HStack, Text, Input, InputGroup, VStack } from "@chakra-ui/react";
import { QuestionIcon } from "../common/icons";

const ChatSettingsPanel = ({ userSettings, setUserSettings }) => {
    const handleQuickChatChange = (key, value) => {
        setUserSettings((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    return (
        <VStack gap={2} align="stretch">
            <Text fontSize="xs" className="pill-box-icons">
                Configure the quick chat buttons that appear in the chat
                interface.
            </Text>
            <HStack gap={2}>
                <Text
                    fontSize="xs"
                    color="overlay0"
                    fontWeight="medium"
                    w="40%"
                >
                    Button Text
                </Text>
                <Text fontSize="xs" color="overlay0" fontWeight="medium" flex="1">
                    Prompt
                </Text>
            </HStack>
            {[1, 2, 3].map((n) => (
                <HStack key={n} gap={2}>
                    <InputGroup
                        size="sm"
                        startElement={<QuestionIcon />}
                        w="40%"
                    >
                        <Input
                            className="input-style quick-chat-title-input"
                            placeholder="Button text"
                            value={
                                userSettings[`quick_chat_${n}_title`] || ""
                            }
                            onChange={(e) =>
                                handleQuickChatChange(
                                    `quick_chat_${n}_title`,
                                    e.target.value,
                                )
                            }
                        />
                    </InputGroup>
                    <Input
                        size="sm"
                        flex="1"
                        className="input-style"
                        placeholder="Prompt sent to AI"
                        value={
                            userSettings[`quick_chat_${n}_prompt`] || ""
                        }
                        onChange={(e) =>
                            handleQuickChatChange(
                                `quick_chat_${n}_prompt`,
                                e.target.value,
                            )
                        }
                    />
                </HStack>
            ))}
        </VStack>
    );
};

export default ChatSettingsPanel;
