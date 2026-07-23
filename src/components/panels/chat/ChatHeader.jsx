import { Flex, Text } from "@chakra-ui/react";
import { ChatIcon } from "../../common/icons";

const ChatHeader = ({ title = "Chat With Phlox", _onClose }) => {
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
                <Text fontWeight="bold">{title}</Text>
            </Flex>
        </Flex>
    );
};

export default ChatHeader;
