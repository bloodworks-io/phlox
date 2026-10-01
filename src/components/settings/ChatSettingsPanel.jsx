import { HStack, Text, Input, InputGroup, VStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { QuestionIcon } from "../common/icons";

const ChatSettingsPanel = ({ userSettings, setUserSettings }) => {
    const { t } = useTranslation();
    const handleQuickChatChange = (key, value) => {
        setUserSettings((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    return (
        <VStack gap={2} align="stretch">
            <Text fontSize="xs" className="pill-box-icons">
                {t("settings.chat.description")}
            </Text>
            <HStack gap={2}>
                <Text
                    fontSize="xs"
                    color="overlay0"
                    fontWeight="medium"
                    w="40%"
                >
                    {t("settings.chat.buttonText")}
                </Text>
                <Text fontSize="xs" color="overlay0" fontWeight="medium" flex="1">
                    {t("settings.chat.prompt")}
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
                            placeholder={t("settings.chat.buttonTextPlaceholder")}
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
                        placeholder={t("settings.chat.promptPlaceholder")}
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
