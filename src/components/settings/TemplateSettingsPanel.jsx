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
import { useTranslation } from "react-i18next";
import { AddIcon, DeleteIcon, EditIcon, RepeatIcon } from "../common/icons";
import { FaFileAlt } from "react-icons/fa";
import { Tooltip } from "@/components/ui/tooltip";
import { useState } from "react";
import TemplateEditor from "../modals/TemplateEditor";
import NewTemplateFromExampleModal from "../modals/NewTemplateFromExampleModal";
import ConfirmDialog from "../common/ConfirmDialog";
import { templateApi } from "../../utils/api/templateApi";
import { useTemplate } from "../../utils/templates/templateContext";
import { isDefaultTemplate, isCustomizedDefault } from "../../utils/templates/templateService";

const TemplateSettingsPanel = () => {
    const { t } = useTranslation();
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
    const {
        templates,
        saveTemplate,
        deleteTemplate,
        refreshTemplates,
    } = useTemplate();

    const handleEditTemplate = (templateKey) => {
        const template = templates.find((t) => t.template_key === templateKey);
        if (template) {
            setSelectedTemplate(template);
            setSelectedTemplateKey(templateKey);
            setIsNewTemplate(false);
            setIsModalOpen(true);
        }
    };

    const handleSaveTemplate = async (templateKey, updatedTemplate) => {
        setIsSaving(true);
        try {

            const result = await saveTemplate(updatedTemplate);
            const newKey = result?.updated_keys?.[templateKey];

            toaster.create({
                title: t("toast.success"),
                description:
                    newKey && newKey !== templateKey
                        ? t("settings.templates.savedAsCopy", { key: newKey })
                        : t("settings.templates.savedSuccessfully"),
                type: "success",
                duration: 3000,
            });
        } catch (error) {
            console.error("Failed to save template:", error);
            toaster.create({
                title: t("toast.error"),
                description: t("settings.templates.saveFailed"),
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
                setIsDeleteModalOpen(false);
                setTemplateToDelete(null);
                if (isCustomizedDefault(templateKey)) {
                    toaster.create({
                        title: t("toast.success"),
                        description: t("settings.templates.resetToDefaultSuccess"),
                        type: "success",
                        duration: 3000,
                    });
                }
            }
        } catch (error) {
            console.error("Error deleting template:", error);
            toaster.create({
                title: t("toast.error"),
                description: error.message || t("settings.templates.deleteFailed"),
                type: "error",
                duration: 3000,
            });
        }
    };

    const handleNewTemplateFromExample = async () => {
        setIsGeneratingTemplate(true);
        try {
            const newTemplate = await templateApi.generateTemplate(exampleNote);

            // New template created server-side; sync the store's list.
            await refreshTemplates();

            setSelectedTemplate(newTemplate);
            setSelectedTemplateKey(newTemplate.template_key);
            setIsNewTemplateModalOpen(false);
            setIsNewTemplate(true);
            setIsModalOpen(true);
        } catch (error) {
            console.error("Error generating template from example:", error);
            toaster.create({
                title: t("toast.error"),
                description: t("settings.templates.generateFailed"),
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
                    {t("settings.templates.description")}
                </Text>
                <Button
                    onClick={() => setIsNewTemplateModalOpen(true)}
                    variant="outline"
                    size="sm"
                    className="nav-button"
                ><AddIcon />{t("settings.templates.newTemplate")}
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
                        {t("settings.templates.emptyTitle")}
                    </Text>
                    <Text fontSize="xs" className="pill-box-icons" mt={1}>
                        {t("settings.templates.emptyDescription")}
                    </Text>
                </Box>
            ) : (
                <VStack gap={2} align="stretch">
                    {sortedTemplates.map((template) => {
                        const isDefault = isDefaultTemplate(
                            template.template_key,
                        );
                        const isCustomized = isCustomizedDefault(
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
                                                isDefault
                                                    ? "green"
                                                    : isCustomized
                                                      ? "blue"
                                                      : "gray"
                                            }
                                            fontSize="xs"
                                        >
                                            {isDefault
                                                ? t("settings.templates.badgeDefault")
                                                : isCustomized
                                                  ? t("settings.templates.badgeCustomized")
                                                  : t("settings.templates.badgeCustom")}
                                        </Badge>
                                    </HStack>
                                    <HStack gap={1}>
                                        <Tooltip content={t("settings.templates.editTemplate")}>
                                            <IconButton
                                                variant="ghost"
                                                size="sm"
                                                aria-label={t("settings.templates.editTemplate")}
                                                onClick={() =>
                                                    handleEditTemplate(
                                                        template.template_key,
                                                    )
                                                }
                                            ><EditIcon /></IconButton>
                                        </Tooltip>
                                        {isCustomized ? (
                                            <Tooltip content={t("settings.templates.resetToDefault")}>
                                                <IconButton
                                                    variant="ghost"
                                                    size="sm"
                                                    aria-label={t("settings.templates.resetToDefault")}
                                                    onClick={() => {
                                                        setTemplateToDelete({
                                                            key: template.template_key,
                                                            name: template.template_name,
                                                        });
                                                        setIsDeleteModalOpen(
                                                            true,
                                                        );
                                                    }}
                                                ><RepeatIcon /></IconButton>
                                            </Tooltip>
                                        ) : !isDefault ? (
                                            <Tooltip content={t("settings.templates.deleteTemplate")}>
                                                <IconButton
                                                    variant="ghost"
                                                    size="sm"
                                                    colorPalette="red"
                                                    aria-label={t("settings.templates.deleteTemplate")}
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
                                        ) : null}
                                    </HStack>
                                </Flex>
                            </Box>
                        );
                    })}
                </VStack>
            )}

            <TemplateEditor
                key={selectedTemplateKey || selectedTemplate?.id || "new"}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                template={selectedTemplate}
                templateKey={selectedTemplateKey}
                onSave={handleSaveTemplate}
                isNewTemplate={isNewTemplate}
                isDefaultTemplate={
                    selectedTemplateKey ? isDefaultTemplate(selectedTemplateKey) : false
                }
            />
            <NewTemplateFromExampleModal
                isOpen={isNewTemplateModalOpen}
                onClose={() => setIsNewTemplateModalOpen(false)}
                onCreate={handleNewTemplateFromExample}
                exampleNote={exampleNote}
                setExampleNote={setExampleNote}
                isLoading={isGeneratingTemplate}
            />
            <ConfirmDialog
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setTemplateToDelete(null);
                }}
                onConfirm={() => handleDeleteTemplate(templateToDelete?.key)}
                title={
                    templateToDelete && isCustomizedDefault(templateToDelete.key)
                        ? t("settings.resetToDefault")
                        : t("settings.templates.deleteTitle")
                }
                body={
                    templateToDelete && isCustomizedDefault(templateToDelete.key)
                        ? t("settings.templates.resetBody", {
                              name: templateToDelete?.name,
                          })
                        : t("settings.templates.deleteBody", {
                              name: templateToDelete?.name,
                          })
                }
                confirmLabel={
                    templateToDelete && isCustomizedDefault(templateToDelete.key)
                        ? t("settings.templates.resetAction")
                        : t("settings.templates.deleteAction")
                }
            />
        </VStack>
    );
};

export default TemplateSettingsPanel;
