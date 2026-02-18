import { useState } from "react";
import {
    Box,
    Flex,
    IconButton,
    Text,
    Collapse,
    Input,
    Textarea,
    VStack,
    FormControl,
    FormLabel,
} from "@chakra-ui/react";
import { ChevronRightIcon, ChevronDownIcon } from "@chakra-ui/icons";
import { FaComments } from "react-icons/fa";

const ChatSettingsPanel = ({
    isCollapsed,
    setIsCollapsed,
    userSettings,
    setUserSettings,
}) => {
    const [isQuickChat1Collapsed, setIsQuickChat1Collapsed] = useState(true);
    const [isQuickChat2Collapsed, setIsQuickChat2Collapsed] = useState(true);
    const [isQuickChat3Collapsed, setIsQuickChat3Collapsed] = useState(true);

    const handleQuickChatChange = (key, value) => {
        setUserSettings((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    return (
        <Box className="panels-bg" p="4" borderRadius="sm">
            <Flex align="center" justify="space-between">
                <Flex align="center">
                    <IconButton
                        icon={
                            isCollapsed ? (
                                <ChevronRightIcon />
                            ) : (
                                <ChevronDownIcon />
                            )
                        }
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        aria-label="Toggle collapse"
                        variant="outline"
                        size="sm"
                        mr="2"
                        className="collapse-toggle"
                    />
                    <FaComments size="1.2em" style={{ marginRight: "5px" }} />
                    <Text as="h3">Quick Chat Settings</Text>
                </Flex>
            </Flex>
            <Collapse in={!isCollapsed} animateOpacity>
                <VStack spacing={6} align="stretch" mt={4}>
                    <Box>
                        <Text fontSize="md" fontWeight="bold" mb={3}>
                            Quick Chat Buttons
                        </Text>
                        <Text fontSize="sm" mb={3}>
                            Configure the quick chat buttons that appear in the
                            chat interface.
                        </Text>

                        <VStack spacing={4} align="stretch">
                            <Box mt="4">
                                <IconButton
                                    icon={
                                        isQuickChat1Collapsed ? (
                                            <ChevronRightIcon />
                                        ) : (
                                            <ChevronDownIcon />
                                        )
                                    }
                                    onClick={() =>
                                        setIsQuickChat1Collapsed(
                                            !isQuickChat1Collapsed,
                                        )
                                    }
                                    aria-label="Toggle Quick Chat 1"
                                    variant="outline"
                                    size="10"
                                    mr="2"
                                    className="collapse-toggle"
                                />
                                <Text
                                    fontSize="sm"
                                    mb="1"
                                    mt="4"
                                    display="inline"
                                >
                                    Quick Chat Button 1
                                </Text>
                                <Collapse
                                    in={!isQuickChat1Collapsed}
                                    animateOpacity
                                >
                                    <Box mt="4">
                                        <FormControl mb={3}>
                                            <FormLabel fontSize="sm">
                                                Button Text
                                            </FormLabel>
                                            <Input
                                                size="sm"
                                                value={
                                                    userSettings.quick_chat_1_title ||
                                                    ""
                                                }
                                                onChange={(e) =>
                                                    handleQuickChatChange(
                                                        "quick_chat_1_title",
                                                        e.target.value,
                                                    )
                                                }
                                                className="input-style"
                                                placeholder="Button text"
                                            />
                                        </FormControl>
                                        <FormControl>
                                            <FormLabel fontSize="sm">
                                                Prompt
                                            </FormLabel>
                                            <Textarea
                                                size="sm"
                                                value={
                                                    userSettings.quick_chat_1_prompt ||
                                                    ""
                                                }
                                                onChange={(e) =>
                                                    handleQuickChatChange(
                                                        "quick_chat_1_prompt",
                                                        e.target.value,
                                                    )
                                                }
                                                className="input-style"
                                                placeholder="Prompt sent to AI"
                                                rows={4}
                                            />
                                        </FormControl>
                                    </Box>
                                </Collapse>
                            </Box>

                            <Box mt="4">
                                <IconButton
                                    icon={
                                        isQuickChat2Collapsed ? (
                                            <ChevronRightIcon />
                                        ) : (
                                            <ChevronDownIcon />
                                        )
                                    }
                                    onClick={() =>
                                        setIsQuickChat2Collapsed(
                                            !isQuickChat2Collapsed,
                                        )
                                    }
                                    aria-label="Toggle Quick Chat 2"
                                    variant="outline"
                                    size="10"
                                    mr="2"
                                    className="collapse-toggle"
                                />
                                <Text
                                    fontSize="sm"
                                    mb="1"
                                    mt="4"
                                    display="inline"
                                >
                                    Quick Chat Button 2
                                </Text>
                                <Collapse
                                    in={!isQuickChat2Collapsed}
                                    animateOpacity
                                >
                                    <Box mt="4">
                                        <FormControl mb={3}>
                                            <FormLabel fontSize="sm">
                                                Button Text
                                            </FormLabel>
                                            <Input
                                                size="sm"
                                                value={
                                                    userSettings.quick_chat_2_title ||
                                                    ""
                                                }
                                                onChange={(e) =>
                                                    handleQuickChatChange(
                                                        "quick_chat_2_title",
                                                        e.target.value,
                                                    )
                                                }
                                                className="input-style"
                                                placeholder="Button text"
                                            />
                                        </FormControl>
                                        <FormControl>
                                            <FormLabel fontSize="sm">
                                                Prompt
                                            </FormLabel>
                                            <Textarea
                                                size="sm"
                                                value={
                                                    userSettings.quick_chat_2_prompt ||
                                                    ""
                                                }
                                                onChange={(e) =>
                                                    handleQuickChatChange(
                                                        "quick_chat_2_prompt",
                                                        e.target.value,
                                                    )
                                                }
                                                className="input-style"
                                                placeholder="Prompt sent to AI"
                                                rows={4}
                                            />
                                        </FormControl>
                                    </Box>
                                </Collapse>
                            </Box>

                            <Box mt="4">
                                <IconButton
                                    icon={
                                        isQuickChat3Collapsed ? (
                                            <ChevronRightIcon />
                                        ) : (
                                            <ChevronDownIcon />
                                        )
                                    }
                                    onClick={() =>
                                        setIsQuickChat3Collapsed(
                                            !isQuickChat3Collapsed,
                                        )
                                    }
                                    aria-label="Toggle Quick Chat 3"
                                    variant="outline"
                                    size="10"
                                    mr="2"
                                    className="collapse-toggle"
                                />
                                <Text
                                    fontSize="sm"
                                    mb="1"
                                    mt="4"
                                    display="inline"
                                >
                                    Quick Chat Button 3
                                </Text>
                                <Collapse
                                    in={!isQuickChat3Collapsed}
                                    animateOpacity
                                >
                                    <Box mt="4">
                                        <FormControl mb={3}>
                                            <FormLabel fontSize="sm">
                                                Button Text
                                            </FormLabel>
                                            <Input
                                                size="sm"
                                                value={
                                                    userSettings.quick_chat_3_title ||
                                                    ""
                                                }
                                                onChange={(e) =>
                                                    handleQuickChatChange(
                                                        "quick_chat_3_title",
                                                        e.target.value,
                                                    )
                                                }
                                                className="input-style"
                                                placeholder="Button text"
                                            />
                                        </FormControl>
                                        <FormControl>
                                            <FormLabel fontSize="sm">
                                                Prompt
                                            </FormLabel>
                                            <Textarea
                                                size="sm"
                                                value={
                                                    userSettings.quick_chat_3_prompt ||
                                                    ""
                                                }
                                                onChange={(e) =>
                                                    handleQuickChatChange(
                                                        "quick_chat_3_prompt",
                                                        e.target.value,
                                                    )
                                                }
                                                className="input-style"
                                                placeholder="Prompt sent to AI"
                                                rows={4}
                                            />
                                        </FormControl>
                                    </Box>
                                </Collapse>
                            </Box>
                        </VStack>
                    </Box>
                </VStack>
            </Collapse>
        </Box>
    );
};

export default ChatSettingsPanel;
