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


import { AddIcon, DeleteIcon, EditIcon } from "../common/icons";
import { FaEnvelopeOpenText } from "react-icons/fa";
import { Tooltip } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import { settingsService } from "../../utils/settings/settingsUtils";
import LetterTemplateEditModal from "../modals/LetterTemplateEditModal";

const LetterTemplatesPanel = () => {
    const { t } = useTranslation();
    const [letterTemplates, setLetterTemplates] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editTemplate, setEditTemplate] = useState(null);

    const fetchTemplates = async () => {
        try {
            const response = await settingsService.fetchLetterTemplates();
            setLetterTemplates(response.templates || []);
        } catch (error) {
            console.error("Failed to fetch letter templates", error);
            toaster.create({
                title: t("toast.error"),
                description: t("settings.letterTemplates.fetchFailed"),
                type: "error",
                duration: 3000,
            });
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleSave = async (template, closeModal) => {
        try {
            await settingsService.saveLetterTemplate(template);
            toaster.create({
                title: t("toast.success"),
                description: template?.id
                    ? t("settings.letterTemplates.updatedSuccessfully")
                    : t("settings.letterTemplates.createdSuccessfully"),
                type: "success",
                duration: 3000,
            });

            fetchTemplates();
            if (closeModal) closeModal();
            setIsEditing(false);
            setEditTemplate(null);
        } catch (error) {
            console.error("Failed to save letter template", error);
            toaster.create({
                title: t("toast.error"),
                description: t("settings.letterTemplates.saveFailed"),
                type: "error",
                duration: 3000,
            });
        }
    };

    const handleDelete = async (templateId) => {
        try {
            await settingsService.deleteLetterTemplate(templateId);
            toaster.create({
                title: t("toast.success"),
                description: t("settings.letterTemplates.deletedSuccessfully"),
                type: "success",
                duration: 3000,
            });
            fetchTemplates();
        } catch (error) {
            console.error("Failed to delete letter template", error);
            toaster.create({
                title: t("toast.error"),
                description: t("settings.letterTemplates.deleteFailed"),
                type: "error",
                duration: 3000,
            });
        }
    };

    const handleReset = async () => {
        try {
            await settingsService.resetLetterTemplates();
            fetchTemplates();
        } catch (error) {
            console.error("Failed to reset letter templates", error);
        }
    };

    return (
        <VStack gap={3} align="stretch">
            <Flex justify="space-between" align="center">
                <Text fontSize="xs" className="settings-meta" maxW="55%">
                    {t("settings.letterTemplates.description")}
                </Text>
                <HStack>
                    <Button
                        onClick={handleReset}
                        size="sm"
                        variant="folioDanger"
                    >
                        {t("settings.letterTemplates.resetToDefaults")}
                    </Button>
                    <Button
                        onClick={() => {
                            setEditTemplate(null);
                            setIsEditing(true);
                        }}
                        size="sm"
                        variant="folioSecondary"
                    ><AddIcon />{t("settings.templates.newTemplate")}
                    </Button>
                </HStack>
            </Flex>

            {letterTemplates.length === 0 ? (
                <Box
                    p={6}
                    textAlign="center"
                    borderWidth="1px"
                    borderColor="folio.line"
                    borderRadius="md"
                >
                    <FaEnvelopeOpenText
                        size="1.5em"
                        style={{ opacity: 0.5, marginBottom: "8px" }}
                    />
                    <Text fontSize="sm" className="settings-meta">
                        {t("settings.letterTemplates.emptyTitle")}
                    </Text>
                    <Text fontSize="xs" className="settings-meta" mt={1}>
                        {t("settings.letterTemplates.emptyDescription")}
                    </Text>
                </Box>
            ) : (
                <VStack gap={2} align="stretch">
                    {letterTemplates.map((template) => {
                        const isDefault = template.name === "Dictation";
                        return (
                            <Box
                                key={template.id}
                                p={3}
                                borderWidth="1px"
                                borderColor="folio.line"
                                borderRadius="md"
                            >
                                <Flex justify="space-between" align="center">
                                    <HStack gap={3} align="flex-start">
                                        <FaEnvelopeOpenText
                                            style={{
                                                opacity: 0.5,
                                                marginTop: "2px",
                                            }}
                                        />
                                        <Box>
                                            <HStack>
                                                <Text
                                                    fontWeight="bold"
                                                    fontSize="sm"
                                                >
                                                    {template.name}
                                                </Text>
                                                <Badge
                                                    bg={
                                                        isDefault
                                                            ? "folio.successSoft"
                                                            : "folio.paperAlt"
                                                    }
                                                    color={
                                                        isDefault
                                                            ? "folio.success"
                                                            : "folio.muted"
                                                    }
                                                    fontSize="xs"
                                                >
                                                    {isDefault
                                                        ? t("settings.templates.badgeDefault")
                                                        : t("settings.templates.badgeCustom")}
                                                </Badge>
                                            </HStack>
                                            {template.instructions && (
                                                <Text
                                                    fontSize="xs"
                                                    className="settings-meta"
                                                    mt={1}
                                                >
                                                    {template.instructions}
                                                </Text>
                                            )}
                                        </Box>
                                    </HStack>
                                    <HStack gap={1}>
                                        <Tooltip content={t("settings.templates.editTemplate")}>
                                            <IconButton
                                                variant="ghost"
                                                size="sm"
                                                aria-label={t("settings.templates.editTemplate")}
                                                onClick={() => {
                                                    setEditTemplate(template);
                                                    setIsEditing(true);
                                                }}
                                            ><EditIcon /></IconButton>
                                        </Tooltip>
                                        {!isDefault && (
                                            <Tooltip content={t("settings.templates.deleteTemplate")}>
                                                <IconButton
                                                    variant="ghost"
                                                    size="sm"
                                                    color="folio.danger"
                                                    _hover={{ bg: "folio.dangerSoft" }}
                                                    aria-label={t("settings.templates.deleteTemplate")}
                                                    onClick={() =>
                                                        handleDelete(
                                                            template.id,
                                                        )
                                                    }
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

            <LetterTemplateEditModal
                isOpen={isEditing}
                onClose={() => {
                    setIsEditing(false);
                    setEditTemplate(null);
                }}
                onSave={(template) => handleSave(template)}
                template={editTemplate}
                setTemplate={setEditTemplate}
            />
        </VStack>
    );
};

export default LetterTemplatesPanel;
