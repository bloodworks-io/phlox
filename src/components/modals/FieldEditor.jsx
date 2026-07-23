import {
    Button,
    VStack,
    HStack,
    Input,
    NativeSelect,
    Textarea,
    Box,
    IconButton,
    Text,
    Flex,
    Collapsible,
} from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import {
    ChevronRightIcon,
    ChevronDownIcon,
    DeleteIcon,
    EditIcon,
} from "../common/icons";
import { useState } from "react";

export const FieldEditor = ({
    field,
    idx,
    updateField,
    removeField,
    isNewTemplate,
}) => {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const isPlanField = field.field_name?.toLowerCase() === "plan";
    const canEdit = isNewTemplate; // Only allow editing/deleting for new templates

    return (
        <Box className="panels-bg" p="3" borderRadius="sm">
            <Flex maxW="530px" align="center" mb={2}>
                {canEdit ? (
                    <Tooltip content="Click to edit field name">
                        <Flex
                            align="center"
                            cursor="pointer"
                            position="relative"
                            minWidth="0"
                            flex="1"
                            role="group"
                        >
                            <Input
                                placeholder="Unnamed Field"
                                value={field.field_name || ""}
                                onChange={(e) =>
                                    updateField(
                                        idx,
                                        "field_name",
                                        e.target.value,
                                    )
                                }
                                variant="unstyled"
                                fontSize="md"
                                fontWeight="600"
                                css={{
                                    '& &::placeholder': {
                                        fontWeight: "600",
                                    },

                                    '& &:hover': {
                                        bg: "whiteAlpha.200",
                                        borderRadius: "sm",
                                    },

                                    '& &:focus': {
                                        bg: "whiteAlpha.100",
                                        borderRadius: "sm",
                                        outline: "none",
                                        "& + .edit-icon": {
                                            display: "none",
                                        },
                                    },

                                    transition: "all 0.2s",

                                    color: "var(--chakra-colors-text-secondary)"
                                }}
                            />
                            <EditIcon
                                className="edit-icon"
                                position="absolute"
                                right="0"
                                display="none"
                                color="overlay0"
                                fontSize="14px"
                                _groupHover={{
                                    display: "block",
                                    opacity: 0.5,
                                }}
                            />
                        </Flex>
                    </Tooltip>
                ) : (
                    <Text
                        fontSize="md"
                        fontWeight="600"
                        color="textSecondary"
                        flex="1"
                    >
                        {field.field_name || "Unnamed Field"}
                    </Text>
                )}
                <Flex align="center" flexShrink={0}>
                    <Tooltip
                        content={
                            isPlanField
                                ? "The Plan section is always dynamic as it needs to be generated from each encounter"
                                : "Persistent fields carry over between encounters. Dynamic fields are generated from the transcript"
                        }
                    >
                        <Box position="relative">
                            <Flex
                                className="template-mode-selector"
                                alignItems="center"
                                p={1}
                            >
                                <Box
                                    className="template-mode-selector-indicator"
                                    left={
                                        field.persistent
                                            ? "2px"
                                            : "calc(50% - 2px)"
                                    }
                                />
                                <Flex
                                    width="full"
                                    position="relative"
                                    zIndex={1}
                                >
                                    <Button
                                        className={`template-mode-selector-button ${
                                            field.persistent ? "active" : ""
                                        }`}
                                        size="sm"
                                        flex="1"
                                        fontSize="11px"
                                        onClick={() =>
                                            !isPlanField &&
                                            updateField(idx, "persistent", true)
                                        }
                                        disabled={isPlanField}
                                    >
                                        Persistent
                                    </Button>
                                    <Button
                                        className={`template-mode-selector-button ${
                                            !field.persistent ? "active" : ""
                                        }`}
                                        size="sm"
                                        flex="1"
                                        fontSize="11px"
                                        onClick={() =>
                                            !isPlanField &&
                                            updateField(
                                                idx,
                                                "persistent",
                                                false,
                                            )
                                        }
                                        disabled={isPlanField}
                                    >
                                        Dynamic
                                    </Button>
                                </Flex>
                            </Flex>
                        </Box>
                    </Tooltip>
                    {/* Show delete button only for new templates and non-Plan fields */}
                    {canEdit && !isPlanField && (
                        <IconButton
                            onClick={() => removeField(idx)}
                            aria-label="Remove field"
                            size="sm"
                            variant="ghost"
                            ml={3}
                            color="dangerButton"
                            _hover={{ bg: "dangerButton", color: "white" }}><DeleteIcon /></IconButton>
                    )}
                </Flex>
            </Flex>
            <VStack gap={3} align="stretch">
                {/* System prompt */}
                <Box width="full">
                    <Text fontSize="sm" color="overlay0" mb={1}>
                        System Prompt
                    </Text>
                    <Textarea
                        value={field.system_prompt || ""}
                        size="sm"
                        rows={3}
                        onChange={(e) =>
                            updateField(idx, "system_prompt", e.target.value)
                        }
                        className="input-style"
                        placeholder={
                            field.persistent
                                ? "Instructions for persistent field..."
                                : "Instructions for dynamic field..."
                        }
                    />
                </Box>

                {/* Advanced settings */}
                <Box>
                    <HStack gap={2}>
                        <IconButton
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            aria-label="Toggle Advanced Settings"
                            variant="ghost"
                            size="sm"
                            className="collapse-toggle">{showAdvanced ? (
                                <ChevronDownIcon />
                            ) : (
                                <ChevronRightIcon />
                            )}</IconButton>
                        <Text fontSize="sm" color="overlay0">
                            Advanced Settings
                        </Text>
                    </HStack>
                    <Collapsible.Root open={showAdvanced}>
                        <Collapsible.Content>
                            <VStack gap={3} mt={3}>
                                <HStack>
                                    <Box flex="1">
                                        <Text fontSize="sm" color="overlay0" mb={1}>
                                            Format Schema
                                        </Text>
                                        <NativeSelect.Root>
                                            <NativeSelect.Field
                                                size="sm"
                                                className="input-style"
                                                value={
                                                    field.format_schema?.type || "none"
                                                }
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    if (value === "none") {
                                                        updateField(
                                                            idx,
                                                            "format_schema",
                                                            null,
                                                        );
                                                    } else {
                                                        let schema = { type: value };
                                                        if (value === "bullet") {
                                                            schema.bullet_char = "•";
                                                        }
                                                        updateField(
                                                            idx,
                                                            "format_schema",
                                                            schema,
                                                        );
                                                    }
                                                }}>
                                                <option value="none">Free Text</option>
                                                <option value="bullet">
                                                    Bullet List
                                                </option>
                                                <option value="numbered">
                                                    Numbered List
                                                </option>
                                                <option value="narrative">
                                                    Narrative
                                                </option>
                                            </NativeSelect.Field>
                                            <NativeSelect.Indicator />
                                        </NativeSelect.Root>
                                    </Box>
                                    {field.format_schema?.type === "bullet" && (
                                        <Box flex="1">
                                            <Text
                                                fontSize="sm"
                                                color="overlay0"
                                                mb={1}
                                            >
                                                Bullet Character
                                            </Text>
                                            <NativeSelect.Root>
                                                <NativeSelect.Field
                                                    size="sm"
                                                    className="input-style"
                                                    value={
                                                        field.format_schema
                                                            ?.bullet_char || "•"
                                                    }
                                                    onChange={(e) => {
                                                        updateField(
                                                            idx,
                                                            "format_schema",
                                                            {
                                                                ...field.format_schema,
                                                                bullet_char:
                                                                    e.target.value,
                                                            },
                                                        );
                                                    }}>
                                                    <option value="•">•</option>
                                                    <option value="-">-</option>
                                                    <option value="*">*</option>
                                                    <option value="→">→</option>
                                                    <option value="#">#</option>
                                                </NativeSelect.Field>
                                                <NativeSelect.Indicator />
                                            </NativeSelect.Root>
                                        </Box>
                                    )}
                                </HStack>

                                {/* Style Example */}
                                <Box width="full">
                                    <Text fontSize="sm" color="overlay0" mb={1}>
                                        Style Example (shows in preview)
                                    </Text>
                                    <Textarea
                                        size="sm"
                                        value={field.style_example || ""}
                                        onChange={(e) => {
                                            updateField(
                                                idx,
                                                "style_example",
                                                e.target.value,
                                            );
                                        }}
                                        className="input-style"
                                        placeholder="Enter an example of how this field should look..."
                                        rows={4}
                                    />
                                </Box>
                            </VStack>
                        </Collapsible.Content>
                    </Collapsible.Root>
                </Box>
            </VStack>
        </Box>
    );
};
