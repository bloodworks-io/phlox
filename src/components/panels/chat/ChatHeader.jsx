import { Flex, Text, IconButton } from "@chakra-ui/react";
import { ChatIcon, CloseIcon } from "../../common/icons";

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
            {onClose && (
                <IconButton
                    icon={<CloseIcon />}
                    onClick={onClose}
                    variant="ghost"
                    size="sm"
                    aria-label="Close chat"
                />
            )}
        </Flex>
    );
};

export default ChatHeader;
