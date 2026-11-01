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
            borderBottomColor="folio.line"
            className="panel-header"
            backgroundColor="folio.paper"
            color="folio.ink"
            flexShrink={0}
        >
            <Flex align="center" color="folio.accent">
                <ChatIcon mr="2" />
                <Text fontWeight="bold" color="folio.ink">{title ?? t("chat.title")}</Text>
            </Flex>
        </Flex>
    );
};

export default ChatHeader;
