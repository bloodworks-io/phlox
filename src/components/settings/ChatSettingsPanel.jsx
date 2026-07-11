import { useState } from "react";
import {
    Box,
    Flex,
    IconButton,
    Text,
    Collapsible,
    Input,
    Textarea,
    VStack,
    Field,
} from "@chakra-ui/react";
import { ChevronRightIcon, ChevronDownIcon } from "../common/icons";
import { FaComments } from "react-icons/fa";

const ChatSettingsPanel = ({
    isCollapsed,
    setIsCollapsed,
    userSettings,
    setUserSettings,
    embedded,
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

    const bodyContent = (
                    <VStack gap={6} align="stretch" mt={4}>
                        <Box>
                            <Text fontSize="md" fontWeight="bold" mb={3}>
                                Quick Chat Buttons
                            </Text>
                            <Text fontSize="sm" mb={3}>
                                Configure the quick chat buttons that appear in the
                                chat interface.
                            </Text>

                            <VStack gap={4} align="stretch">
                                <Box mt="4">
                                    <IconButton
                                        onClick={() =>
                                            setIsQuickChat1Collapsed(
                                                !isQuickChat1Collapsed,
                                            )
                                        }
                                        aria-label="Toggle Quick Chat 1"
                                        variant="outline"
                                        size="10"
                                        mr="2"
                                        className="collapse-toggle">{isQuickChat1Collapsed ? (
                                            <ChevronRightIcon />
                                        ) : (
                                            <ChevronDownIcon />
                                        )}</IconButton>
                                    <Text
                                        fontSize="sm"
                                        mb="1"
                                        mt="4"
                                        display="inline"
                                    >
                                        Quick Chat Button 1
                                    </Text>
                                    <Collapsible.Root open={!isQuickChat1Collapsed}>
                                        <Collapsible.Content>
                                            <Box mt="4">
                                                <Field.Root mb={3}>
                                                    <Field.Label fontSize="sm">
                                                        Button Text
                                                    </Field.Label>
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
                                                </Field.Root>
                                                <Field.Root>
                                                    <Field.Label fontSize="sm">
                                                        Prompt
                                                    </Field.Label>
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
                                                </Field.Root>
                                            </Box>
                                        </Collapsible.Content>
                                    </Collapsible.Root>
                                </Box>

                                <Box mt="4">
                                    <IconButton
                                        onClick={() =>
                                            setIsQuickChat2Collapsed(
                                                !isQuickChat2Collapsed,
                                            )
                                        }
                                        aria-label="Toggle Quick Chat 2"
                                        variant="outline"
                                        size="10"
                                        mr="2"
                                        className="collapse-toggle">{isQuickChat2Collapsed ? (
                                            <ChevronRightIcon />
                                        ) : (
                                            <ChevronDownIcon />
                                        )}</IconButton>
                                    <Text
                                        fontSize="sm"
                                        mb="1"
                                        mt="4"
                                        display="inline"
                                    >
                                        Quick Chat Button 2
                                    </Text>
                                    <Collapsible.Root open={!isQuickChat2Collapsed}>
                                        <Collapsible.Content>
                                            <Box mt="4">
                                                <Field.Root mb={3}>
                                                    <Field.Label fontSize="sm">
                                                        Button Text
                                                    </Field.Label>
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
                                                </Field.Root>
                                                <Field.Root>
                                                    <Field.Label fontSize="sm">
                                                        Prompt
                                                    </Field.Label>
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
                                                </Field.Root>
                                            </Box>
                                        </Collapsible.Content>
                                    </Collapsible.Root>
                                </Box>

                                <Box mt="4">
                                    <IconButton
                                        onClick={() =>
                                            setIsQuickChat3Collapsed(
                                                !isQuickChat3Collapsed,
                                            )
                                        }
                                        aria-label="Toggle Quick Chat 3"
                                        variant="outline"
                                        size="10"
                                        mr="2"
                                        className="collapse-toggle">{isQuickChat3Collapsed ? (
                                            <ChevronRightIcon />
                                        ) : (
                                            <ChevronDownIcon />
                                        )}</IconButton>
                                    <Text
                                        fontSize="sm"
                                        mb="1"
                                        mt="4"
                                        display="inline"
                                    >
                                        Quick Chat Button 3
                                    </Text>
                                    <Collapsible.Root open={!isQuickChat3Collapsed}>
                                        <Collapsible.Content>
                                            <Box mt="4">
                                                <Field.Root mb={3}>
                                                    <Field.Label fontSize="sm">
                                                        Button Text
                                                    </Field.Label>
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
                                                </Field.Root>
                                                <Field.Root>
                                                    <Field.Label fontSize="sm">
                                                        Prompt
                                                    </Field.Label>
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
                                                </Field.Root>
                                            </Box>
                                        </Collapsible.Content>
                                    </Collapsible.Root>
                                </Box>
                            </VStack>
                        </Box>
                    </VStack>
    );

    const shell = embedded ? (
        bodyContent
    ) : (
        <Box className="panels-bg" p="4" borderRadius="sm">
            <Flex align="center" justify="space-between">
                <Flex align="center">
                    <IconButton
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        aria-label="Toggle collapse"
                        variant="outline"
                        size="sm"
                        mr="2"
                        className="collapse-toggle">{isCollapsed ? (
                            <ChevronRightIcon />
                        ) : (
                            <ChevronDownIcon />
                        )}</IconButton>
                    <FaComments size="1.2em" style={{ marginRight: "5px" }} />
                    <Text as="h3">Quick Chat Settings</Text>
                </Flex>
            </Flex>
            <Collapsible.Root open={!isCollapsed}>
                <Collapsible.Content>
                    {bodyContent}
                </Collapsible.Content>
            </Collapsible.Root>
        </Box>
    );

    return shell;
};

export default ChatSettingsPanel;
