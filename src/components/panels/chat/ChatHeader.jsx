import { Flex, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { ChatIcon } from "../../common/icons";

const ChatHeader = ({ title, _onClose }) => {
    const { t } = useTranslation();
    return (
        <Flex
            align="center"
            justify="space-between"
            p="3"
            borderBottomWidth="1px"
            className="panel-header"
            flexShrink={0}
        >
            <Flex align="center">
                <ChatIcon mr="2" />
                <Text fontWeight="bold">{title ?? t("chat.title")}</Text>
            </Flex>
        </Flex>
    );
};

export default ChatHeader;
