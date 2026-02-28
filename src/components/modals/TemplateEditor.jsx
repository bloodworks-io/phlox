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
import { FaThumbtack } from "react-icons/fa";
import { useState, useEffect } from "react";
import { typography } from "../../theme/typography";
import { colors } from "../../theme/colors";

// Preview component that mimics Summary.jsx field rendering
const FieldPreview = ({ field }) => {
    const { colorMode } = useColorMode();
    const content = field.style_example || "";

    return (
        <Box className="cohesive-field">
            <Text className="cohesive-field-label">
                {field.field_name || "Unnamed Field"}
                {field.persistent && (
                    <Tooltip
                        label="Persists between encounters."
                        hasArrow
                        placement="right"
                    >
                        <Box as="span" className="cohesive-persistent-marker">
                            <FaThumbtack />
                        </Box>
                    </Tooltip>
                )}
            </Text>
            <Box
                className="cohesive-textarea"
                minH="60px"
                p="2"
                borderRadius="sm"
                whiteSpace="pre-wrap"
                fontSize="sm"
                color={
                    colorMode === "light"
                        ? colors.light.textTertiary
                        : colors.dark.textTertiary
                }
            >
                {content || (
                    <Text
                        as="i"
                        color={
                            colorMode === "light"
                                ? colors.light.textSecondary
                                : colors.dark.textSecondary
                        }
                    >
                        {field.persistent
                            ? "Persistent field content carries over..."
                            : "This field will be generated from the transcript..."}
                    </Text>
                )}
            </Box>
        </Box>
    );
};

const FieldEditor = ({
    field,
    idx,
    updateField,
    removeField,
    isNewTemplate,
}) => {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const { colorMode } = useColorMode();
    const isPlanField = field.field_name?.toLowerCase() === "plan";
    const canEdit = isNewTemplate; // Only allow editing/deleting for new templates

    return (
        <Box className="panels-bg" p="3" borderRadius="sm">
            <Flex maxW="530px" align="center" mb={2}>
                {canEdit ? (
                    <Tooltip label="Click to edit field name">
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
                                sx={{
                                    "&::placeholder": {
                                        fontWeight: "600",
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
                                            ? colors.light.textSecondary
                                            : colors.dark.textSecondary,
                                }}
                            />
                            <EditIcon
                                className="edit-icon"
                                position="absolute"
                                right="0"
                                display="none"
                                color="gray.500"
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
                        color={
                            colorMode === "light"
                                ? colors.light.textSecondary
                                : colors.dark.textSecondary
                        }
                        flex="1"
                    >
                        {field.field_name || "Unnamed Field"}
                    </Text>
                )}
                <Flex align="center" flexShrink={0}>
                    <Tooltip
                        label={
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
                                        fontSize="11px"
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
                    {/* Show delete button only for new templates and non-Plan fields */}
                    {canEdit && !isPlanField && (
                        <IconButton
                            icon={<DeleteIcon />}
                            onClick={() => removeField(idx)}
                            aria-label="Remove field"
                            size="sm"
                            variant="ghost"
                            ml={3}
                            color="red.400"
                            _hover={{ bg: "red.400", color: "white" }}
                        />
                    )}
                </Flex>
            </Flex>
            <VStack spacing={3} align="stretch">
                {/* System prompt */}
                <Box width="full">
                    <Text fontSize="sm" color="gray.400" mb={1}>
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
                    <HStack spacing={2}>
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
                            variant="ghost"
                            size="sm"
                            className="collapse-toggle"
                        />
                        <Text fontSize="sm" color="gray.400">
                            Advanced Settings
                        </Text>
                    </HStack>
                    <Collapse in={showAdvanced} animateOpacity>
                        <VStack spacing={3} mt={3}>
                            <HStack>
                                <Box flex="1">
                                    <Text fontSize="sm" color="gray.400" mb={1}>
                                        Format Schema
                                    </Text>
                                    <Select
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
                                        }}
                                    >
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
                                    </Select>
                                </Box>
                                {field.format_schema?.type === "bullet" && (
                                    <Box flex="1">
                                        <Text
                                            fontSize="sm"
                                            color="gray.400"
                                            mb={1}
                                        >
                                            Bullet Character
                                        </Text>
                                        <Select
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
                                            }}
                                        >
                                            <option value="•">•</option>
                                            <option value="-">-</option>
                                            <option value="*">*</option>
                                            <option value="→">→</option>
                                        </Select>
                                    </Box>
                                )}
                            </HStack>

                            {/* Style Example */}
                            <Box width="full">
                                <Text fontSize="sm" color="gray.400" mb={1}>
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
                    </Collapse>
                </Box>
            </VStack>
        </Box>
    );
};

const TemplateEditor = ({
    isOpen,
    onClose,
    template,
    templateKey,
    onSave,
    isNewTemplate = false,
}) => {
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
                <ModalContent className="modal-style">
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
                    style_example: "",
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
        <Modal isOpen={isOpen} onClose={onClose} scrollBehavior="inside">
            <ModalOverlay />
            <ModalContent className="modal-style" maxW="1200px">
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

                <ModalBody p={0}>
                    {isNewTemplate && (
                        <Box
                            px={6}
                            py={4}
                            bg={colorMode === "light" ? "blue.50" : "blue.900"}
                            borderLeft="4px solid"
                            borderLeftColor="blue.400"
                            borderBottom="1px solid"
                            borderBottomColor="whiteAlpha.200"
                        >
                            <HStack align="start" spacing={3}>
                                <Box color="blue.500" mt={0.5}>
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </Box>
                                <VStack align="start" spacing={1} flex="1">
                                    <Text fontWeight="600" fontSize="sm">
                                        Creating a New Note Template
                                    </Text>
                                    <Text fontSize="xs" opacity={0.8}>
                                        Define the structure of your clinical
                                        letter. Add fields, set which ones
                                        persist between encounters, and provide
                                        instructions for AI generation.
                                    </Text>
                                </VStack>
                            </HStack>
                        </Box>
                    )}
                    <Flex h="500px">
                        {/* Left Column - Editor */}
                        <VStack
                            flex="1"
                            align="stretch"
                            borderRight="1px"
                            borderColor="whiteAlpha.200"
                            h="full"
                        >
                            <Box px={4} pt={4} pb={2}>
                                <Text
                                    sx={{
                                        ...typography.styles.h4,
                                        color:
                                            colorMode === "light"
                                                ? colors.light.textTertiary
                                                : colors.dark.textTertiary,
                                    }}
                                >
                                    Editor
                                </Text>
                            </Box>
                            <Box
                                flex="1"
                                px={4}
                                pb={4}
                                overflowY="auto"
                                className="custom-scrollbar"
                            >
                                <Box className="cohesive-fields-container">
                                    <VStack spacing={2} align="stretch">
                                        {editedTemplate.fields?.map(
                                            (field, idx) => (
                                                <FieldEditor
                                                    key={field.field_key}
                                                    field={field}
                                                    idx={idx}
                                                    updateField={updateField}
                                                    removeField={removeField}
                                                    isNewTemplate={
                                                        isNewTemplate
                                                    }
                                                />
                                            ),
                                        )}
                                        {isNewTemplate && (
                                            <>
                                                <Box
                                                    px={3}
                                                    py={2}
                                                    fontSize="xs"
                                                    opacity={0.7}
                                                    textAlign="center"
                                                    bg="transparent"
                                                    borderRadius="sm"
                                                >
                                                    <strong>Pin</strong> =
                                                    Carries over between
                                                    encounters &nbsp;•&nbsp;{" "}
                                                    <strong>Dyn</strong> =
                                                    Generated from transcript
                                                </Box>
                                                <Button
                                                    leftIcon={<AddIcon />}
                                                    onClick={addField}
                                                    className="summary-buttons"
                                                    size="sm"
                                                >
                                                    Add Field
                                                </Button>
                                            </>
                                        )}
                                    </VStack>
                                </Box>
                            </Box>
                        </VStack>

                        {/* Right Column - Preview */}
                        <VStack flex="1" align="stretch" h="full">
                            <Box px={4} pt={4} pb={2}>
                                <Text
                                    sx={{
                                        ...typography.styles.h4,
                                        color:
                                            colorMode === "light"
                                                ? colors.light.textTertiary
                                                : colors.dark.textTertiary,
                                    }}
                                >
                                    Preview
                                </Text>
                            </Box>
                            <Box
                                flex="1"
                                px={4}
                                pb={4}
                                overflowY="auto"
                                className="custom-scrollbar"
                            >
                                {isNewTemplate &&
                                    !editedTemplate.fields?.some(
                                        (f) => f.style_example,
                                    ) && (
                                        <Box
                                            px={4}
                                            py={3}
                                            mb={2}
                                            bg={
                                                colorMode === "light"
                                                    ? "gray.50"
                                                    : "gray.800"
                                            }
                                            borderRadius="md"
                                            fontSize="xs"
                                            opacity={0.8}
                                        >
                                            <Text mb={1}>
                                                💡 <strong>Tip:</strong> Add
                                                "Style Examples" in Advanced
                                                Settings to see how fields will
                                                appear in the final letter.
                                            </Text>
                                        </Box>
                                    )}
                                <Box className="cohesive-fields-container">
                                    <VStack spacing={0} align="stretch">
                                        {editedTemplate.fields?.map((field) => (
                                            <FieldPreview
                                                key={field.field_key}
                                                field={field}
                                            />
                                        ))}
                                    </VStack>
                                </Box>
                            </Box>
                        </VStack>
                    </Flex>
                </ModalBody>

                <ModalFooter>
                    <Button
                        onClick={onClose}
                        size="md"
                        borderRadius="2xl !important"
                        className="switch-mode"
                        sx={{
                            fontFamily: '"Space Grotesk", sans-serif',
                            fontWeight: "600",
                        }}
                        mr={3}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        size="md"
                        borderRadius="2xl !important"
                        className="switch-mode"
                        sx={{
                            fontFamily: '"Space Grotesk", sans-serif',
                            fontWeight: "600",
                        }}
                    >
                        Save Changes
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default TemplateEditor;
