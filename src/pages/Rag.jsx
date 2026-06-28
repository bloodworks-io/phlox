// Page component for document management (upload, explore, and PDF form templates).
import React from "react";
import { Steps, Box, Text, HStack, Tabs } from "@chakra-ui/react";
import { FaBook, FaFileAlt } from "react-icons/fa";
import { isRagEnabled, isPdfFormsEnabled } from "../utils/helpers/featureFlags";
import { useRagDocuments } from "../utils/hooks/useRagDocuments";
import { usePdfForms } from "../utils/hooks/usePdfForms";
import DeleteModal from "../components/rag/DeleteModal";
import KnowledgeBasePanel from "../components/rag/KnowledgeBasePanel";
import FormTemplatesPanel from "../components/pdf-forms/FormTemplatesPanel";
import UploadTemplateModal from "../components/pdf-forms/UploadTemplateModal";
import FillFormModal from "../components/pdf-forms/FillFormModal";

const Rag = () => {
  const rag = useRagDocuments();
  const forms = usePdfForms();

  const ragEnabled = isRagEnabled();
  const formsEnabled = isPdfFormsEnabled();
  const showTabs = ragEnabled && formsEnabled;

  const knowledgeBaseProps = {
    collapseExplorer: rag.collapseExplorer,
    collapseUploader: rag.collapseUploader,
    collections: rag.collections,
    setCollections: rag.setCollections,
    loading: rag.loading,
    setItemToDelete: rag.setItemToDelete,
  };

  const formTemplatesProps = {
    templates: forms.templates,
    templatesLoading: forms.templatesLoading,
    selectedTemplate: forms.selectedTemplate,
    fields: forms.fields,
    selectedField: forms.selectedField,
    selectedFieldId: forms.selectedFieldId,
    saving: forms.saving,
    isDrawingMode: forms.isDrawingMode,
    activeFieldType: forms.activeFieldType,
    visionCapable: forms.visionCapable,
    detecting: forms.detecting,
    onSetDrawingMode: forms.setIsDrawingMode,
    onSetFieldType: forms.setActiveFieldType,
    onAutoDetect: forms.handleAutoDetectFields,
    onOpenUpload: () => forms.setShowUploadModal(true),
    onSelectTemplate: forms.handleTemplateSelected,
    onDeleteTemplate: forms.handleTemplateDeleted,
    onFieldsChange: forms.setFields,
    onSelectField: forms.setSelectedFieldId,
    onUpdateField: forms.handleUpdateField,
    onDeleteField: forms.handleDeleteField,
    onSaveFields: forms.handleSaveFields,
  };

  return (
    <>
      <Box p="5" w="100%">
        <Text as="h2" mb="4">
          Documents
        </Text>

        <Box p={[2, 3, 4]} borderRadius="sm" className="panels-bg">
          {showTabs ? (
            <Tabs.Root variant='enclosed' defaultValue="0">
              <Tabs.List>
                <Tabs.Trigger className="tab-style" value="0">
                  <HStack gap="1">
                    <FaBook size="0.85em" />
                    <Text>Knowledge Base</Text>
                  </HStack>
                </Tabs.Trigger>
                <Tabs.Trigger className="tab-style" value="1">
                  <HStack gap="1">
                    <FaFileAlt size="0.85em" />
                    <Text>Form Templates</Text>
                  </HStack>
                </Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content className="floating-main" px="4" py="3" value="0">
                <KnowledgeBasePanel {...knowledgeBaseProps} />
              </Tabs.Content>
              <Tabs.Content className="floating-main" px="4" py="3" value="1">
                <FormTemplatesPanel {...formTemplatesProps} />
              </Tabs.Content>
            </Tabs.Root>
          ) : formsEnabled ? (
            <FormTemplatesPanel {...formTemplatesProps} />
          ) : ragEnabled ? (
            <KnowledgeBasePanel {...knowledgeBaseProps} />
          ) : null}
        </Box>
      </Box>
      {ragEnabled && (
        <DeleteModal
          isOpen={!!rag.itemToDelete}
          onClose={() => rag.setItemToDelete(null)}
          onDelete={rag.handleDelete}
          item={rag.itemToDelete}
        />
      )}
      {formsEnabled && (
        <>
          <UploadTemplateModal
            isOpen={forms.showUploadModal}
            onClose={() => forms.setShowUploadModal(false)}
            onCreated={forms.handleTemplateCreated}
          />
          {forms.selectedTemplate && (
            <FillFormModal
              isOpen={forms.showFillModal}
              onClose={() => forms.setShowFillModal(false)}
              template={forms.selectedTemplate}
            />
          )}
        </>
      )}
    </>
  );
};

export default Rag;
