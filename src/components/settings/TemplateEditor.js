import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalFooter,
    ModalBody,
    ModalCloseButton,
    Button,
    VStack,
    HStack,
    Input,
    Select,
    Textarea,
    Box,
    IconButton,
    Text,
    Tooltip,
    Flex,
    Collapse,
    useColorMode,
} from "@chakra-ui/react";
import {
    AddIcon,
    ChevronRightIcon,
    ChevronDownIcon,
    DeleteIcon,
    EditIcon,
} from "@chakra-ui/icons";
import { useState, useEffect } from "react";
import { typography } from "../../theme/typography";
import { colors } from "../../theme/colors";

const FieldEditor = ({ field, idx, updateField, removeField }) => {
    const [showAdvanced, setShowAdvanced] = useState(false);
    // New state for showing system prompt for persistent fields
    const [showPersistentSystemPrompt, setShowPersistentSystemPrompt] =
        useState(false);
    const isPlanField = field.field_name?.toLowerCase() === "plan";

    return (
        <Box className="panels-bg" p="4" borderRadius="sm">
            <Flex
                className="template-field-header"
                justify="space-between"
                align="center"
                mb={0}
            >
                <Tooltip
                    label={
                        isPlanField
                            ? "Plan is a required field"
                            : "Click to edit field name"
                    }
                >
                    <Flex
                        align="center"
                        cursor={isPlanField ? "default" : "pointer"}
                        position="relative"
                        width="350px"
                        role="group"
                    >
                        <Input
                            placeholder="Unnamed Field"
                            value={field.field_name || ""}
                            onChange={(e) =>
                                !isPlanField &&
                                updateField(idx, "field_name", e.target.value)
                            }
                            isReadOnly={isPlanField}
                            variant="unstyled"
                            sx={{
                                ...typography.styles.h6,
                                "&::placeholder": {
                                    ...typography.styles.h6,
                                },
                                "&:hover": {
                                    bg: isPlanField
                                        ? "transparent"
                                        : "whiteAlpha.200",
                                    borderRadius: "sm",
                                },
                                "&:focus": {
                                    bg: isPlanField
                                        ? "transparent"
                                        : "whiteAlpha.100",
                                    borderRadius: "sm",
                                    outline: "none",
                                },
                                transition: "all 0.2s",
                            }}
                        />
                        {!isPlanField && (
                            <EditIcon
                                position="absolute"
                                right="-20px"
                                display="none"
                                color="gray.500"
                                _groupHover={{
                                    display: "block",
                                    opacity: 0.5,
                                }}
                            />
                        )}
                    </Flex>
                </Tooltip>
                <HStack spacing={3}>
                    <Tooltip
                        label={
                            isPlanField
                                ? "The Plan section is always dynamic as it needs to be generated from each encounter"
                                : "Persistent fields carry over between encounters. Dynamic fields are generated from the transcript"
                        }
                    >
                        <Box position="relative" width="200px">
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
                                        onClick={() =>
                                            !isPlanField &&
                                            updateField(idx, "persistent", true)
                                        }
                                        isDisabled={isPlanField}
                                    >
                                        Persistent
                                    </Button>
                                    <Button
                                        className={`template-mode-selector-button ${
                                            !field.persistent ? "active" : ""
                                        }`}
                                        size="sm"
                                        flex="1"
                                        onClick={() =>
                                            !isPlanField &&
                                            updateField(
                                                idx,
                                                "persistent",
                                                false,
                                            )
                                        }
                                        isDisabled={isPlanField}
                                    >
                                        Dynamic
                                    </Button>
                                </Flex>
                            </Flex>
                        </Box>
                    </Tooltip>
                    {/* Only show delete button if not Plan field */}
                    {!isPlanField && (
                        <IconButton
                            icon={<DeleteIcon />}
                            onClick={() => removeField(idx)}
                            aria-label="Remove field"
                            size="sm"
                            className="red-button"
                        />
                    )}
                </HStack>
            </Flex>
            <VStack spacing={3} align="stretch">
                {/* For persistent fields, show a button to expose system prompt */}
                {field.persistent && (
                    <Box mt={4}>
                        <Button
                            size="sm"
                            variant="outline"
                            leftIcon={
                                showPersistentSystemPrompt ? (
                                    <ChevronDownIcon />
                                ) : (
                                    <ChevronRightIcon />
                                )
                            }
                            onClick={() =>
                                setShowPersistentSystemPrompt(
                                    !showPersistentSystemPrompt,
                                )
                            }
                            mb={2}
                        >
                            {showPersistentSystemPrompt ? "Hide" : "Show"}{" "}
                            System Prompt
                        </Button>

                        <Collapse
                            in={showPersistentSystemPrompt}
                            animateOpacity
                        >
                            <Box width="full">
                                <Text fontSize="sm" mb={1}>
                                    System Prompt
                                </Text>
                                <Tooltip label="Instructions for the AI on how to process this persistent field (for example, in document processing)">
                                    <Textarea
                                        value={field.system_prompt || ""}
                                        rows={6}
                                        onChange={(e) =>
                                            updateField(
                                                idx,
                                                "system_prompt",
                                                e.target.value,
                                            )
                                        }
                                        sx={{ overflowY: "auto !important" }}
                                        style={{
                                            lineHeight: "1.5",
                                            overflowY: "auto !important",
                                        }}
                                        className="textarea-style"
                                        placeholder="Enter system prompt for this persistent field (for example, in document processing)..."
                                    />
                                </Tooltip>
                            </Box>
                        </Collapse>
                    </Box>
                )}

                {/* For dynamic fields, show all the existing fields */}
                {!field.persistent && (
                    <>
                        <Tooltip label="The type of content this field will contain"></Tooltip>
                        <Tooltip label="Instructions for the AI on how to process this field">
                            <Box width="full">
                                <Text fontSize="sm" mb={1}>
                                    System Prompt
                                </Text>
                                <Textarea
                                    value={field.system_prompt || ""}
                                    rows={6}
                                    onChange={(e) =>
                                        updateField(
                                            idx,
                                            "system_prompt",
                                            e.target.value,
                                        )
                                    }
                                    sx={{ overflowY: "auto !important" }}
                                    style={{
                                        lineHeight: "1.5",
                                        overflowY: "auto !important",
                                    }}
                                    className="textarea-style"
                                />
                            </Box>
                        </Tooltip>

                        <Box mt="4">
                            <IconButton
                                icon={
                                    showAdvanced ? (
                                        <ChevronDownIcon />
                                    ) : (
                                        <ChevronRightIcon />
                                    )
                                }
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                aria-label="Toggle Advanced Settings"
                                variant="outline"
                                size="10"
                                mr="2"
                                className="collapse-toggle"
                            />
                            <Text fontSize="sm" mb="1" mt="4" display="inline">
                                Advanced Settings
                            </Text>
                            <Collapse in={showAdvanced} animateOpacity>
                                <VStack spacing={3} mt="4">
                                    <Tooltip label="Initial text to guide the AI's response format">
                                        <Box width="full">
                                            <Text fontSize="sm" mb={1}>
                                                Initial Prompt
                                            </Text>
                                            <Textarea
                                                size="sm"
                                                value={
                                                    field.initial_prompt
                                                        ? field.initial_prompt.replace(
                                                              /\n/g,
                                                              "\\n",
                                                          )
                                                        : ""
                                                }
                                                onChange={(e) => {
                                                    // Replace \\n with actual newlines when saving
                                                    const value =
                                                        e.target.value.replace(
                                                            /\\n/g,
                                                            "\n",
                                                        );
                                                    updateField(
                                                        idx,
                                                        "initial_prompt",
                                                        value,
                                                    );
                                                }}
                                                className="textarea-style"
                                            />
                                        </Box>
                                    </Tooltip>
                                    <Tooltip label="Specify the format structure for the response">
                                        <Box width="full">
                                            <Text fontSize="sm" mb={1}>
                                                Format Schema
                                            </Text>
                                            <Select
                                                size="sm"
                                                className="input-style"
                                                value={
                                                    field.format_schema?.type ||
                                                    "none"
                                                }
                                                onChange={(e) => {
                                                    const value =
                                                        e.target.value;
                                                    if (value === "none") {
                                                        updateField(
                                                            idx,
                                                            "format_schema",
                                                            null,
                                                        );
                                                    } else {
                                                        let schema = {
                                                            type: value,
                                                        };
                                                        if (
                                                            value === "bullet"
                                                        ) {
                                                            schema.bullet_char =
                                                                "•"; // Default bullet
                                                        }
                                                        updateField(
                                                            idx,
                                                            "format_schema",
                                                            schema,
                                                        );
                                                    }
                                                }}
                                            >
                                                <option value="none">
                                                    Free Text
                                                </option>
                                                <option value="bullet">
                                                    Bullet List
                                                </option>
                                                <option value="numbered">
                                                    Numbered List
                                                </option>
                                                <option value="narrative">
                                                    Narrative Paragraph
                                                </option>
                                            </Select>

                                            {/* Show bullet character selector if bullet format is selected */}
                                            {field.format_schema?.type ===
                                                "bullet" && (
                                                <Box mt={2}>
                                                    <Text fontSize="sm" mb={1}>
                                                        Bullet Character
                                                    </Text>
                                                    <Select
                                                        size="sm"
                                                        className="input-style"
                                                        value={
                                                            field.format_schema
                                                                ?.bullet_char ||
                                                            "•"
                                                        }
                                                        onChange={(e) => {
                                                            updateField(
                                                                idx,
                                                                "format_schema",
                                                                {
                                                                    ...field.format_schema,
                                                                    bullet_char:
                                                                        e.target
                                                                            .value,
                                                                },
                                                            );
                                                        }}
                                                    >
                                                        <option value="•">
                                                            • (Bullet)
                                                        </option>
                                                        <option value="-">
                                                            - (Dash)
                                                        </option>
                                                        <option value="*">
                                                            * (Asterisk)
                                                        </option>
                                                        <option value="→">
                                                            → (Arrow)
                                                        </option>
                                                    </Select>
                                                </Box>
                                            )}
                                        </Box>
                                    </Tooltip>
                                    <Tooltip label="Rules for refining the AI's response">
                                        <Box width="full">
                                            <Text fontSize="sm" mb={1}>
                                                Refinement Rules
                                            </Text>
                                            <Select
                                                size="sm"
                                                className="input-style"
                                                value={
                                                    field.refinement_rules ||
                                                    "default"
                                                }
                                                onChange={(e) =>
                                                    updateField(
                                                        idx,
                                                        "refinement_rules",
                                                        e.target.value,
                                                    )
                                                }
                                            >
                                                <option value="default">
                                                    Default Rules
                                                </option>
                                                <option value="custom">
                                                    Custom Rules
                                                </option>
                                            </Select>
                                        </Box>
                                    </Tooltip>
                                </VStack>
                            </Collapse>
                        </Box>
                    </>
                )}
            </VStack>
        </Box>
    );
};

const TemplateEditor = ({ isOpen, onClose, template, templateKey, onSave }) => {
    const [editedTemplate, setEditedTemplate] = useState(null);
    const { colorMode } = useColorMode();
    useEffect(() => {
        if (template) {
            setEditedTemplate({
                ...template,
                fields: template.fields || [],
            });
        }
    }, [template]);

    if (!editedTemplate) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} size="xl">
                <ModalOverlay />
                <ModalContent className="template-editor-modal">
                    <ModalHeader>Loading Template...</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <Text>Loading template data...</Text>
                    </ModalBody>
                </ModalContent>
            </Modal>
        );
    }

    const addField = () => {
        setEditedTemplate((prev) => ({
            ...prev,
            fields: [
                ...(prev.fields || []),
                {
                    field_key: `field_${Date.now()}`,
                    field_name: "",
                    field_type: "text",
                    required: false,
                    persistent: false,
                    system_prompt: "",
                    initial_prompt: "",
                    format_schema: null,
                    refinement_rules: "default",
                },
            ],
        }));
    };

    const updateField = (fieldIndex, key, value) => {
        setEditedTemplate((prev) => ({
            ...prev,
            fields: prev.fields.map((field, idx) =>
                idx === fieldIndex ? { ...field, [key]: value } : field,
            ),
        }));
    };

    const removeField = (fieldIndex) => {
        const fieldToRemove = editedTemplate.fields[fieldIndex];
        if (fieldToRemove.field_name?.toLowerCase() === "plan") {
            return; // Don't remove Plan field
        }

        setEditedTemplate((prev) => ({
            ...prev,
            fields: prev.fields.filter((_, idx) => idx !== fieldIndex),
        }));
    };

    const updateTemplateName = (value) => {
        setEditedTemplate((prev) => ({
            ...prev,
            template_name: value,
        }));
    };

    const handleSave = () => {
        onSave(templateKey, editedTemplate);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size={{
                base: "90%",
                md: "60vw",
            }}
            scrollBehavior="inside"
        >
            <ModalOverlay />
            <ModalContent className="template-editor-modal">
                <ModalHeader>
                    <Tooltip label="Click to edit template name">
                        <Flex
                            align="center"
                            cursor="pointer"
                            position="relative"
                            width="100%"
                            role="group"
                        >
                            <Box position="relative" width="fit-content">
                                <Input
                                    placeholder="Template Name"
                                    value={editedTemplate.template_name || ""}
                                    onChange={(e) =>
                                        updateTemplateName(e.target.value)
                                    }
                                    variant="unstyled"
                                    sx={{
                                        ...typography.styles.h2,
                                        "&::placeholder": {
                                            ...typography.styles.h2,
                                        },
                                        "&:hover": {
                                            bg: "whiteAlpha.200",
                                            borderRadius: "sm",
                                        },
                                        "&:focus": {
                                            bg: "whiteAlpha.100",
                                            borderRadius: "sm",
                                            outline: "none",
                                            "& + .edit-icon": {
                                                display: "none",
                                            },
                                        },
                                        transition: "all 0.2s",
                                        color:
                                            colorMode === "light"
                                                ? `${colors.light.textSecondary} !important`
                                                : `${colors.dark.textSecondary} !important`,
                                    }}
                                />
                                <EditIcon
                                    className="edit-icon"
                                    position="absolute"
                                    right="4px"
                                    top="50%"
                                    transform="translateY(-50%)"
                                    display="none"
                                    color="gray.500"
                                    fontSize="16px"
                                    _groupHover={{
                                        display: "block",
                                        opacity: 0.5,
                                    }}
                                />
                            </Box>
                        </Flex>
                    </Tooltip>
                </ModalHeader>
                <ModalCloseButton />

                <ModalBody className="template-editor-body">
                    <VStack spacing={4} align="stretch">
                        {editedTemplate.fields?.map((field, idx) => (
                            <FieldEditor
                                key={field.field_key}
                                field={field}
                                idx={idx}
                                updateField={updateField}
                                removeField={removeField}
                            />
                        ))}
                        <Button
                            leftIcon={<AddIcon />}
                            onClick={addField}
                            className="summary-buttons"
                        >
                            Add Field
                        </Button>
                    </VStack>
                </ModalBody>

                <ModalFooter className="template-editor-footer">
                    <Button className="red-button" mr={3} onClick={onClose}>
                        Cancel
                    </Button>
                    <Button className="green-button" onClick={handleSave}>
                        Save Changes
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default TemplateEditor;
