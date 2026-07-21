import {
    Box,
    Flex,
    HStack,
    IconButton,
    Text,
    Button,
    VStack,
    Badge,
} from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { AddIcon, DeleteIcon, EditIcon } from "../common/icons";
import { FaFileAlt } from "react-icons/fa";
import { Tooltip } from "@/components/ui/tooltip";
import { useState } from "react";
import TemplateEditor from "../modals/TemplateEditor";
import NewTemplateFromExampleModal from "../modals/NewTemplateFromExampleModal";
import DeleteConfirmationModal from "../modals/DeleteConfirmationModal";
import { templateApi } from "../../utils/api/templateApi";
import { useTemplate } from "../../utils/templates/templateContext";

const DEFAULT_TEMPLATE_KEYS = ["phlox_", "soap_", "progress_"];

const isDefaultTemplate = (templateKey) =>
    DEFAULT_TEMPLATE_KEYS.some((prefix) => templateKey.startsWith(prefix));

const TemplateSettingsPanel = ({ templates, setTemplates }) => {
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [selectedTemplateKey, setSelectedTemplateKey] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isNewTemplate, setIsNewTemplate] = useState(false);
    const [, setIsSaving] = useState(false);

    const [isNewTemplateModalOpen, setIsNewTemplateModalOpen] = useState(false);
    const [exampleNote, setExampleNote] = useState("");
    const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [templateToDelete, setTemplateToDelete] = useState(null);
    const { deleteTemplate } = useTemplate();

    const handleEditTemplate = (templateKey) => {
        const template = templates.find((t) => t.template_key === templateKey);
        if (template) {
            setSelectedTemplate(template);
            setSelectedTemplateKey(templateKey);
            setIsNewTemplate(false);
            setIsModalOpen(true);
        }
    };

    const handleSaveTemplate = async (_templateKey, _updatedTemplate) => {
        setIsSaving(true);
        try {
            const freshTemplates = await templateApi.fetchTemplates();
            setTemplates(freshTemplates);

            toaster.create({
                title: "Success",
                description: "Template saved successfully",
                type: "success",
                duration: 3000,
            });
        } catch (error) {
            console.error("Failed to save template:", error);
            toaster.create({
                title: "Error",
                description: "Failed to save template",
                type: "error",
                duration: 3000,
            });
        } finally {
            setIsSaving(false);
            setIsModalOpen(false);
        }
    };

    const handleDeleteTemplate = async (templateKey) => {
        try {
            const success = await deleteTemplate(templateKey);
            if (success) {
                const freshTemplates = await templateApi.fetchTemplates();
                setTemplates(freshTemplates);
                setIsDeleteModalOpen(false);
                setTemplateToDelete(null);
            }
        } catch (error) {
            console.error("Error deleting template:", error);
            toaster.create({
                title: "Error",
                description: error.message || "Failed to delete template",
                type: "error",
                duration: 3000,
            });
        }
    };

    const handleNewTemplateFromExample = async () => {
        setIsGeneratingTemplate(true);
        try {
            const newTemplate = await templateApi.generateTemplate(exampleNote);

            const freshTemplates = await templateApi.fetchTemplates();
            setTemplates(freshTemplates);

            setSelectedTemplate(newTemplate);
            setSelectedTemplateKey(newTemplate.template_key);
            setIsNewTemplateModalOpen(false);
            setIsNewTemplate(true);
            setIsModalOpen(true);
        } catch (error) {
            console.error("Error generating template from example:", error);
            toaster.create({
                title: "Error",
                description: "Failed to generate template from example",
                type: "error",
                duration: 3000,
            });
        } finally {
            setIsGeneratingTemplate(false);
            setExampleNote("");
        }
    };

    const sortedTemplates = Array.isArray(templates)
        ? [...templates].sort((a, b) => {
              const isDefaultA = isDefaultTemplate(a.template_key);
              const isDefaultB = isDefaultTemplate(b.template_key);
              if (isDefaultA && !isDefaultB) return -1;
              if (!isDefaultA && isDefaultB) return 1;
              return 0;
          })
        : [];

    return (
        <VStack gap={3} align="stretch">
            <Flex justify="space-between" align="center">
                <Text fontSize="xs" className="pill-box-icons" maxW="60%">
                    Templates control the structure of generated notes. Defaults
                    can be edited but not removed.
                </Text>
                <Button
                    onClick={() => setIsNewTemplateModalOpen(true)}
                    variant="outline"
                    size="sm"
                    className="nav-button"
                ><AddIcon />New Template
                </Button>
            </Flex>

            {sortedTemplates.length === 0 ? (
                <Box
                    p={6}
                    textAlign="center"
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="md"
                >
                    <FaFileAlt
                        size="1.5em"
                        style={{ opacity: 0.5, marginBottom: "8px" }}
                    />
                    <Text fontSize="sm" className="pill-box-icons">
                        No templates available
                    </Text>
                    <Text fontSize="xs" className="pill-box-icons" mt={1}>
                        Create a template to customize note structure
                    </Text>
                </Box>
            ) : (
                <VStack gap={2} align="stretch">
                    {sortedTemplates.map((template) => {
                        const isDefault = isDefaultTemplate(
                            template.template_key,
                        );
                        return (
                            <Box
                                key={template.template_key}
                                p={3}
                                borderWidth="1px"
                                borderColor="border"
                                borderRadius="md"
                            >
                                <Flex justify="space-between" align="center">
                                    <HStack gap={3}>
                                        <FaFileAlt
                                            style={{ opacity: 0.5 }}
                                        />
                                        <Text fontWeight="bold" fontSize="sm">
                                            {template.template_name}
                                        </Text>
                                        <Badge
                                            colorPalette={
                                                isDefault ? "green" : "gray"
                                            }
                                            fontSize="xs"
                                        >
                                            {isDefault ? "Default" : "Custom"}
                                        </Badge>
                                    </HStack>
                                    <HStack gap={1}>
                                        <Tooltip content="Edit template">
                                            <IconButton
                                                variant="ghost"
                                                size="sm"
                                                aria-label="Edit template"
                                                onClick={() =>
                                                    handleEditTemplate(
                                                        template.template_key,
                                                    )
                                                }
                                            ><EditIcon /></IconButton>
                                        </Tooltip>
                                        {!isDefault && (
                                            <Tooltip content="Delete template">
                                                <IconButton
                                                    variant="ghost"
                                                    size="sm"
                                                    colorPalette="red"
                                                    aria-label="Delete template"
                                                    onClick={() => {
                                                        setTemplateToDelete({
                                                            key: template.template_key,
                                                            name: template.template_name,
                                                        });
                                                        setIsDeleteModalOpen(
                                                            true,
                                                        );
                                                    }}
                                                ><DeleteIcon /></IconButton>
                                            </Tooltip>
                                        )}
                                    </HStack>
                                </Flex>
                            </Box>
                        );
                    })}
                </VStack>
            )}

            <TemplateEditor
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                template={selectedTemplate}
                templateKey={selectedTemplateKey}
                onSave={handleSaveTemplate}
                isNewTemplate={isNewTemplate}
            />
            <NewTemplateFromExampleModal
                isOpen={isNewTemplateModalOpen}
                onClose={() => setIsNewTemplateModalOpen(false)}
                onCreate={handleNewTemplateFromExample}
                exampleNote={exampleNote}
                setExampleNote={setExampleNote}
                isLoading={isGeneratingTemplate}
            />
            <DeleteConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setTemplateToDelete(null);
                }}
                onConfirm={() => handleDeleteTemplate(templateToDelete?.key)}
                itemName={templateToDelete?.name}
                title="Delete Template"
            />
        </VStack>
    );
};

export default TemplateSettingsPanel;
