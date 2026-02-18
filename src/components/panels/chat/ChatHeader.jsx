import { Flex, Text, IconButton } from "@chakra-ui/react";
import { ChatIcon, CloseIcon } from "@chakra-ui/icons";

const ChatHeader = ({ title = "Chat With Phlox", onClose }) => {
    return (
        <Flex
            align="center"
            justify="space-between"
            p="4"
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
