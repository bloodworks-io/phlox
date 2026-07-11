import { Box, Flex, IconButton, Text, Collapsible, Button, VStack, HStack } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  AddIcon,
  DeleteIcon,
} from "../common/icons";
import { FaFileAlt } from "react-icons/fa";
import { useState } from "react";
import TemplateEditor from "../modals/TemplateEditor";
import NewTemplateFromExampleModal from "../modals/NewTemplateFromExampleModal";
import DeleteConfirmationModal from "../modals/DeleteConfirmationModal";
import { templateApi } from "../../utils/api/templateApi";
import { useTemplate } from "../../utils/templates/templateContext";
import { buildApiUrl } from "../../utils/helpers/apiConfig";
import { universalFetch } from "../../utils/helpers/apiHelpers";

const TemplateSettingsPanel = ({
  isCollapsed,
  setIsCollapsed,
  templates,
  setTemplates,
  embedded,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewTemplate, setIsNewTemplate] = useState(false);
   
  const [, setIsSaving] = useState(false);

  // State for new template from example
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
      // Save to backend
       

      // Fetch fresh templates list
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

  const DefaultTemplates = {
    // List of default template keys
    DEFAULT_TEMPLATE_KEYS: ["phlox_", "soap_", "progress_"],

    // Check if a template is a default one
    isDefaultTemplate: (templateKey) => {
      return DefaultTemplates.DEFAULT_TEMPLATE_KEYS.some((prefix) =>
        templateKey.startsWith(prefix),
      );
    },
  };

  const handleDeleteTemplate = async (templateKey) => {
    try {
      const success = await deleteTemplate(templateKey);
      if (success) {
        // Fetch fresh templates list
        const freshTemplates = await templateApi.fetchTemplates();

        // Update the local state with the new templates
        setTemplates(freshTemplates);

        // Close the delete confirmation modal
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
      const response = await universalFetch(
        await buildApiUrl("/api/templates/generate"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ exampleNote }),
        },
      );
      if (!response.ok) {
        throw new Error("Failed to generate template");
      }
      const newTemplate = await response.json();

      // Update local templates with the new one
      const freshTemplates = await templateApi.fetchTemplates();
      // Make sure we're setting templates as an array
      setTemplates(freshTemplates);

      setSelectedTemplate(newTemplate);
      setSelectedTemplateKey(newTemplate.template_key);
      setIsNewTemplateModalOpen(false);
      setIsNewTemplate(true); // Mark as new template to allow field editing
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

  const actionsContent = (
    <Button onClick={() => setIsNewTemplateModalOpen(true)} className="grey-button"><AddIcon />New Template
    </Button>
  );

  const bodyContent = (
    <VStack gap={4} align="stretch" mt={4}>
            {Array.isArray(templates) ? (
              // Sort templates: default templates first, custom templates last
              (templates
                .sort((a, b) => {
                  const isDefaultA = DefaultTemplates.isDefaultTemplate(
                    a.template_key,
                  );
                  const isDefaultB = DefaultTemplates.isDefaultTemplate(
                    b.template_key,
                  );

                  if (isDefaultA && !isDefaultB) return -1;
                  if (!isDefaultA && isDefaultB) return 1;
                  return 0;
                })
                .map((template) => (
                  <Box
                    key={template.template_key}
                    p={4}
                    border="1px"
                    borderColor="border"
                    borderRadius="sm"
                  >
                    <Flex align="center" justify="space-between">
                      <Text fontSize="lg" fontWeight="bold">
                        {template.template_name}
                      </Text>
                      <HStack gap={2}>
                        <Button
                          size="sm"
                          onClick={() =>
                            handleEditTemplate(template.template_key)
                          }
                          className="summary-buttons"
                        >
                          Edit Template
                        </Button>
                        {!DefaultTemplates.isDefaultTemplate(
                          template.template_key,
                        ) && (
                          <IconButton
                            size="sm"
                            onClick={() => {
                              setTemplateToDelete({
                                key: template.template_key,
                                name: template.template_name,
                              });
                              setIsDeleteModalOpen(true);
                            }}
                            colorPalette="red"
                            aria-label="Delete template"><DeleteIcon /></IconButton>
                        )}
                      </HStack>
                    </Flex>
                  </Box>
                )))
            ) : (
              <Text>No templates available</Text>
            )}
    </VStack>
  );

  const shell = embedded ? (
    <VStack gap={4} align="stretch" mt={4}>
      <Flex justify="flex-end">{actionsContent}</Flex>
      {bodyContent}
    </VStack>
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
            className="collapse-toggle">{isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}</IconButton>
          <FaFileAlt size="1.2em" style={{ marginRight: "5px" }} />
          <Text as="h3">Note Templates</Text>
        </Flex>
        {actionsContent}
      </Flex>
      <Collapsible.Root open={!isCollapsed}>
        <Collapsible.Content>
          {bodyContent}
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );

  return (
    <>
      {shell}
      <TemplateEditor
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        template={selectedTemplate}
        templateKey={selectedTemplateKey}
        onSave={handleSaveTemplate}
        isNewTemplate={isNewTemplate}
      />
      {/* New Template from Example Modal */}
      <NewTemplateFromExampleModal
        isOpen={isNewTemplateModalOpen}
        onClose={() => setIsNewTemplateModalOpen(false)}
        onCreate={handleNewTemplateFromExample}
        exampleNote={exampleNote}
        setExampleNote={setExampleNote}
        isLoading={isGeneratingTemplate}
      />
      {/* Delete Confirmation Modal */}
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
    </>
  );
};

export default TemplateSettingsPanel;
