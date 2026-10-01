import {
    Button,
    VStack,
    HStack,
    Heading,
    Input,
    Box,
    Text,
    Flex,
    Dialog,
    Portal,
} from "@chakra-ui/react";
import { Tooltip } from '@/components/ui/tooltip';
import { useTranslation } from "react-i18next";
import {
    AddIcon,
    EditIcon,
} from "../common/icons";
import { useState } from "react";
import { typography } from "../../theme/typography";
import { FieldEditor } from "./FieldEditor";
import { FieldPreview } from "./FieldPreview";

const TemplateEditor = ({
    isOpen,
    onClose,
    template,
    templateKey,
    onSave,
    isNewTemplate = false,
    isDefaultTemplate = false,
}) => {
    const { t } = useTranslation();
    const [editedTemplate, setEditedTemplate] = useState(
        () => template ? { ...template, fields: template.fields || [] } : null,
    );

    if (!editedTemplate) {
        return (
            <Dialog.Root open={isOpen} size='xl' onOpenChange={e => {
                if (!e.open) {
                    onClose();
                }
            }}>
                <Portal>

                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content className="modal-style">
                            <Dialog.Header><Heading as="h2" size="md" fontFamily="heading">{t("modal.templateEditor.loadingTitle")}</Heading></Dialog.Header>
                            <Dialog.CloseTrigger />
                            <Dialog.Body>
                                <Text>{t("modal.templateEditor.loadingBody")}</Text>
                            </Dialog.Body>
                        </Dialog.Content>
                    </Dialog.Positioner>

                </Portal>
            </Dialog.Root>
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
        <Dialog.Root open={isOpen} scrollBehavior="inside" onOpenChange={e => {
            if (!e.open) {
                onClose();
            }
        }}>
            <Portal>

                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content className="modal-style" maxW="1200px">
                        <Dialog.Header>
                            <Tooltip content={t("modal.templateEditor.editTemplateNameTooltip")}>
                                <Flex
                                    align="center"
                                    cursor="pointer"
                                    position="relative"
                                    width="100%"
                                    role="group"
                                >
                                    <Box position="relative" width="fit-content">
                                        <Input
                                            placeholder={t("modal.templateNamePlaceholder")}
                                            value={editedTemplate.template_name || ""}
                                            onChange={(e) =>
                                                updateTemplateName(e.target.value)
                                            }
                                            variant="unstyled"
                                            css={{
                                                ...typography.styles.h2,

                                                '& &::placeholder': {
                                                    ...typography.styles.h2,
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

                                                color:
                                                    "var(--chakra-colors-text-secondary) !important"
                                            }}
                                        />
                                        <EditIcon
                                            className="edit-icon"
                                            position="absolute"
                                            right="4px"
                                            top="50%"
                                            transform="translateY(-50%)"
                                            display="none"
                                            color="overlay0"
                                            fontSize="16px"
                                            _groupHover={{
                                                display: "block",
                                                opacity: 0.5,
                                            }}
                                        />
                                    </Box>
                                </Flex>
                            </Tooltip>
                        </Dialog.Header>
                        <Dialog.CloseTrigger />
                        <Dialog.Body p={0}>
                            {isNewTemplate && (
                                <Box
                                    px={6}
                                    py={4}
                                    bg="surfaceMuted"
                                    borderLeft="4px solid"
                                    borderLeftColor="accent"
                                    borderBottom="1px solid"
                                    borderBottomColor="whiteAlpha.200"
                                >
                                    <HStack align="start" gap={3}>
                                        <Box color="primaryButton" mt={0.5}>
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
                                        <VStack align="start" gap={1} flex="1">
                                            <Text fontWeight="600" fontSize="sm">
                                                {t("modal.templateEditor.newTemplateBanner")}
                                            </Text>
                                            <Text fontSize="xs" opacity={0.8}>
                                                {t("modal.templateEditor.newTemplateDescription")}
                                            </Text>
                                        </VStack>
                                    </HStack>
                                </Box>
                            )}
                            {isDefaultTemplate && !isNewTemplate && (
                                <Box
                                    px={6}
                                    py={4}
                                    bg="surfaceMuted"
                                    borderLeft="4px solid"
                                    borderLeftColor="accent"
                                    borderBottom="1px solid"
                                    borderBottomColor="whiteAlpha.200"
                                >
                                    <HStack align="start" gap={3}>
                                        <Box color="primaryButton" mt={0.5}>
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
                                        <VStack align="start" gap={1} flex="1">
                                            <Text fontWeight="600" fontSize="sm">
                                                {t("modal.templateEditor.defaultTemplateBanner")}
                                            </Text>
                                            <Text fontSize="xs" opacity={0.8}>
                                                {t("modal.templateEditor.defaultTemplateDescription")}
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
                                            css={{
                                                ...typography.styles.h4,

                                                color: "var(--chakra-colors-text-tertiary)"
                                            }}
                                        >
                                            {t("modal.templateEditor.editor")}
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
                                            <VStack gap={2} align="stretch">
                                                {editedTemplate.fields?.map(
                                                    (field, idx) => (
                                                        <FieldEditor
                                                            key={field.field_key}
                                                            field={field}
                                                            idx={idx}
                                                            updateField={updateField}
                                                            removeField={removeField}
                                                        />
                                                    ),
                                                )}
                                                <Box
                                                    px={3}
                                                    py={2}
                                                    fontSize="xs"
                                                    opacity={0.7}
                                                    textAlign="center"
                                                    bg="transparent"
                                                    borderRadius="sm"
                                                >
                                                    <strong>{t("modal.templateEditor.pin")}</strong>{" = "}
                                                    {t("modal.templateEditor.pinCarriesOver")} &nbsp;•&nbsp;{" "}
                                                    <strong>{t("modal.templateEditor.dyn")}</strong>{" = "}
                                                    {t("modal.templateEditor.dynGenerated")}
                                                </Box>
                                                <Button onClick={addField} className="summary-buttons" size="sm"><AddIcon />{t("modal.templateEditor.addField")}
                                                </Button>
                                            </VStack>
                                        </Box>
                                    </Box>
                                </VStack>

                                {/* Right Column - Preview */}
                                <VStack flex="1" align="stretch" h="full">
                                    <Box px={4} pt={4} pb={2}>
                                        <Text
                                            css={{
                                                ...typography.styles.h4,

                                                color: "var(--chakra-colors-text-tertiary)"
                                            }}
                                        >
                                            {t("modal.templateEditor.preview")}
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
                                                    bg="surfaceInset"
                                                    borderRadius="md"
                                                    fontSize="xs"
                                                    opacity={0.8}
                                                >
                                                    <Text mb={1}>
                                                        💡 <strong>{t("modal.templateEditor.tipLabel")}</strong> {t("modal.templateEditor.tipBody")}
                                                    </Text>
                                                </Box>
                                            )}
                                        <Box className="cohesive-fields-container">
                                            <VStack gap={0} align="stretch">
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
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button
                                onClick={onClose}
                                size="md"
                                borderRadius="2xl"
                                className="switch-mode"
                                css={{
                                    fontFamily: '"Space Grotesk", sans-serif',
                                    fontWeight: "600"
                                }}
                                mr={3}
                            >
                                {t("action.cancel")}
                            </Button>
                            <Button
                                onClick={handleSave}
                                size="md"
                                borderRadius="2xl"
                                className="green-button"
                                css={{
                                    fontFamily: '"Space Grotesk", sans-serif',
                                    fontWeight: "600",
                                }}
                            >
                                {t("modal.templateEditor.saveChanges")}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>

            </Portal>
        </Dialog.Root>
    );
};

export default TemplateEditor;
