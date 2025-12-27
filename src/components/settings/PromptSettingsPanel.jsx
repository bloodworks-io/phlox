// Component for managing and editing prompts for LLMs.
import { useState } from "react";
import {
    Box,
    Flex,
    IconButton,
    Text,
    Collapse,
    Textarea,
    Tooltip,
    NumberInput,
    NumberInputField,
    HStack,
} from "@chakra-ui/react";
import { ChevronRightIcon, ChevronDownIcon } from "@chakra-ui/icons";
import { FaPencilAlt } from "react-icons/fa";

const PromptSettingsPanel = ({
    isCollapsed,
    setIsCollapsed,
    prompts,
    handlePromptChange,
    options,
    handleOptionChange,
    config,
}) => {
    const [
        isClinicalHistoryPromptCollapsed,
        setIsClinicalHistoryPromptCollapsed,
    ] = useState(true);
    const [isPlanPromptCollapsed, setIsPlanPromptCollapsed] = useState(true);
    const [isRefinementPromptCollapsed, setIsRefinementPromptCollapsed] =
        useState(true);
    const [isChatCollapsed, setIsChatCollapsed] = useState(true);
    const [isSummaryPromptCollapsed, setIsSummaryPromptCollapsed] =
        useState(true);
    const [isLetterPromptCollapsed, setIsLetterPromptCollapsed] =
        useState(true);
    const [isPromptOptionsCollapsed, setIsPromptOptionsCollapsed] =
        useState(true);
    const [isReasoningPromptCollapsed, setIsReasoningPromptCollapsed] =
        useState(true);

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
                    <FaPencilAlt size="1.2em" style={{ marginRight: "5px" }} />
                    <Text as="h3">Prompt Settings</Text>
                </Flex>
            </Flex>
            <Collapse in={!isCollapsed} animateOpacity>
                <Box mt="4" borderRadius="sm">
                    <Box mt="4">
                        <IconButton
                            icon={
                                isRefinementPromptCollapsed ? (
                                    <ChevronRightIcon />
                                ) : (
                                    <ChevronDownIcon />
                                )
                            }
                            onClick={() =>
                                setIsRefinementPromptCollapsed(
                                    !isRefinementPromptCollapsed,
                                )
                            }
                            aria-label="Toggle Refinement Prompt"
                            variant="outline"
                            size="10"
                            mr="2"
                            className="collapse-toggle"
                        />
                        <Tooltip label="System prompt used for refining the generated outputs">
                            <Text fontSize="sm" mb="1" mt="4" display="inline">
                                Refinement Prompt
                            </Text>
                        </Tooltip>
                        <Collapse
                            in={!isRefinementPromptCollapsed}
                            animateOpacity
                        >
                            <Textarea
                                size="sm"
                                mt="4"
                                value={prompts?.refinement?.system}
                                onChange={(e) =>
                                    handlePromptChange(
                                        "refinement",
                                        "system",
                                        e.target.value,
                                    )
                                }
                                rows={10}
                                className="textarea-style"
                            />
                        </Collapse>
                    </Box>
                    <Box mt="4">
                        <IconButton
                            icon={
                                isSummaryPromptCollapsed ? (
                                    <ChevronRightIcon />
                                ) : (
                                    <ChevronDownIcon />
                                )
                            }
                            onClick={() =>
                                setIsSummaryPromptCollapsed(
                                    !isSummaryPromptCollapsed,
                                )
                            }
                            aria-label="Toggle Summary Prompt"
                            variant="outline"
                            size="10"
                            mr="2"
                            className="collapse-toggle"
                        />
                        <Tooltip label="System prompt used for generating summaries">
                            <Text fontSize="sm" mb="1" mt="4" display="inline">
                                Summary Prompt
                            </Text>
                        </Tooltip>
                        <Collapse in={!isSummaryPromptCollapsed} animateOpacity>
                            <Textarea
                                size="sm"
                                value={prompts?.summary?.system}
                                onChange={(e) =>
                                    handlePromptChange(
                                        "summary",
                                        "system",
                                        e.target.value,
                                    )
                                }
                                rows={10}
                                mt="4"
                                className="textarea-style"
                            />
                        </Collapse>
                    </Box>
                    <Box mt="4">
                        <IconButton
                            icon={
                                isChatCollapsed ? (
                                    <ChevronRightIcon />
                                ) : (
                                    <ChevronDownIcon />
                                )
                            }
                            onClick={() => setIsChatCollapsed(!isChatCollapsed)}
                            aria-label="Toggle Chat Prompt"
                            variant="outline"
                            size="10"
                            mr="2"
                            className="collapse-toggle"
                        />
                        <Tooltip label="System prompt used for chat interactions">
                            <Text fontSize="sm" mb="1" mt="4" display="inline">
                                Chat Prompt
                            </Text>
                        </Tooltip>
                        <Collapse in={!isChatCollapsed} animateOpacity>
                            <Textarea
                                size="sm"
                                value={prompts?.chat?.system}
                                onChange={(e) =>
                                    handlePromptChange(
                                        "chat",
                                        "system",
                                        e.target.value,
                                    )
                                }
                                rows={10}
                                className="textarea-style"
                            />
                        </Collapse>
                    </Box>
                    <Box mt="4">
                        <IconButton
                            icon={
                                isLetterPromptCollapsed ? (
                                    <ChevronRightIcon />
                                ) : (
                                    <ChevronDownIcon />
                                )
                            }
                            onClick={() =>
                                setIsLetterPromptCollapsed(
                                    !isLetterPromptCollapsed,
                                )
                            }
                            aria-label="Toggle Letter Prompt"
                            variant="outline"
                            size="10"
                            mr="2"
                            className="collapse-toggle"
                        />
                        <Tooltip label="System prompt used for generating letters">
                            <Text fontSize="sm" mb="1" mt="4" display="inline">
                                Letter Prompt
                            </Text>
                        </Tooltip>
                        <Collapse in={!isLetterPromptCollapsed} animateOpacity>
                            <Textarea
                                size="sm"
                                value={prompts?.letter?.system}
                                onChange={(e) =>
                                    handlePromptChange(
                                        "letter",
                                        "system",
                                        e.target.value,
                                    )
                                }
                                rows={10}
                                className="textarea-style"
                            />
                        </Collapse>
                    </Box>
                    {config?.REASONING_ENABLED && ( // Only show if reasoning is enabled
                        <Box mt="4">
                            <IconButton
                                icon={
                                    isReasoningPromptCollapsed ? (
                                        <ChevronRightIcon />
                                    ) : (
                                        <ChevronDownIcon />
                                    )
                                }
                                onClick={() =>
                                    setIsReasoningPromptCollapsed(
                                        !isReasoningPromptCollapsed,
                                    )
                                }
                                aria-label="Toggle Reasoning Prompt"
                                variant="outline"
                                size="10"
                                mr="2"
                                className="collapse-toggle"
                            />
                            <Tooltip label="System prompt used for clinical reasoning analysis">
                                <Text
                                    fontSize="sm"
                                    mb="1"
                                    mt="4"
                                    display="inline"
                                >
                                    Reasoning Prompt
                                </Text>
                            </Tooltip>
                            <Collapse
                                in={!isReasoningPromptCollapsed}
                                animateOpacity
                            >
                                <Textarea
                                    size="sm"
                                    value={prompts?.reasoning?.system}
                                    onChange={(e) =>
                                        handlePromptChange(
                                            "reasoning",
                                            "system",
                                            e.target.value,
                                        )
                                    }
                                    rows={10}
                                    mt="4"
                                    className="textarea-style"
                                />
                            </Collapse>
                        </Box>
                    )}
                    <Box mt="4">
                        <IconButton
                            icon={
                                isPromptOptionsCollapsed ? (
                                    <ChevronRightIcon />
                                ) : (
                                    <ChevronDownIcon />
                                )
                            }
                            onClick={() =>
                                setIsPromptOptionsCollapsed(
                                    !isPromptOptionsCollapsed,
                                )
                            }
                            aria-label="Toggle Prompt Options"
                            variant="outline"
                            size="10"
                            mr="2"
                            className="collapse-toggle"
                        />
                        <Text fontSize="sm" mb="1" mt="4" display="inline">
                            Advanced Options
                        </Text>
                        <Collapse in={!isPromptOptionsCollapsed} animateOpacity>
                            <HStack mt="2" spacing="24" wrap="wrap">
                                <Box mt="4">
                                    <Text fontSize="md" fontWeight="bold">
                                        Primary Model
                                    </Text>
                                    <Box>
                                        <Tooltip label="Context window size for the primary model">
                                            <Text fontSize="sm">num_ctx</Text>
                                        </Tooltip>
                                        <NumberInput
                                            size="sm"
                                            value={options?.general?.num_ctx}
                                            onChange={(newValue) =>
                                                handleOptionChange(
                                                    "general",
                                                    "num_ctx",
                                                    newValue,
                                                )
                                            }
                                        >
                                            <NumberInputField
                                                className="input-style"
                                                width="100px"
                                            />
                                        </NumberInput>
                                    </Box>
                                </Box>
                                <Box mt="4">
                                    <Text fontSize="md" fontWeight="bold">
                                        Secondary Model
                                    </Text>
                                    <Box>
                                        <Tooltip label="Context window size for the secondary model">
                                            <Text fontSize="sm">num_ctx</Text>
                                        </Tooltip>
                                        <NumberInput
                                            size="sm"
                                            value={options?.secondary?.num_ctx}
                                            onChange={(newValue) =>
                                                handleOptionChange(
                                                    "secondary",
                                                    "num_ctx",
                                                    newValue,
                                                )
                                            }
                                        >
                                            <NumberInputField
                                                className="input-style"
                                                width="100px"
                                            />
                                        </NumberInput>
                                    </Box>
                                </Box>
                                <Box mt="4">
                                    <Text fontSize="md" fontWeight="bold">
                                        Letter Options
                                    </Text>
                                    <Box>
                                        <Tooltip label="Temperature setting for the letter generation model">
                                            <Text fontSize="sm">
                                                temperature
                                            </Text>
                                        </Tooltip>
                                        <NumberInput
                                            size="sm"
                                            value={options?.letter?.temperature}
                                            onChange={(newValue) =>
                                                handleOptionChange(
                                                    "letter",
                                                    "temperature",
                                                    newValue,
                                                )
                                            }
                                        >
                                            <NumberInputField
                                                className="input-style"
                                                width="100px"
                                            />
                                        </NumberInput>
                                    </Box>
                                </Box>
                                {config?.REASONING_ENABLED && (
                                    <Box mt="4">
                                        <Text fontSize="md" fontWeight="bold">
                                            Reasoning Options
                                        </Text>
                                        <Flex gap="4" align="center">
                                            <Box>
                                                <Tooltip label="Context window size for the reasoning model">
                                                    <Text fontSize="sm">
                                                        num_ctx
                                                    </Text>
                                                </Tooltip>
                                                <NumberInput
                                                    size="sm"
                                                    value={
                                                        options?.reasoning
                                                            ?.num_ctx
                                                    }
                                                    onChange={(newValue) =>
                                                        handleOptionChange(
                                                            "reasoning",
                                                            "num_ctx",
                                                            newValue,
                                                        )
                                                    }
                                                >
                                                    <NumberInputField
                                                        className="input-style"
                                                        width="100px"
                                                    />
                                                </NumberInput>
                                            </Box>
                                            <Box>
                                                <Tooltip label="Temperature setting for the reasoning model">
                                                    <Text fontSize="sm">
                                                        temperature
                                                    </Text>
                                                </Tooltip>
                                                <NumberInput
                                                    size="sm"
                                                    value={
                                                        options?.reasoning
                                                            ?.temperature
                                                    }
                                                    onChange={(newValue) =>
                                                        handleOptionChange(
                                                            "reasoning",
                                                            "temperature",
                                                            newValue,
                                                        )
                                                    }
                                                >
                                                    <NumberInputField
                                                        className="input-style"
                                                        width="100px"
                                                    />
                                                </NumberInput>
                                            </Box>
                                        </Flex>
                                    </Box>
                                )}
                            </HStack>
                        </Collapse>
                    </Box>
                </Box>
            </Collapse>
        </Box>
    );
};

export default PromptSettingsPanel;
