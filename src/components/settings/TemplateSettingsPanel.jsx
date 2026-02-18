import {
  Box,
  Flex,
  IconButton,
  Text,
  Collapse,
  Button,
  VStack,
  HStack,
  Textarea,
  useColorMode,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
} from "@chakra-ui/react";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  AddIcon,
  DeleteIcon,
} from "@chakra-ui/icons";
import { FaFileAlt } from "react-icons/fa";
import { useState } from "react";
import TemplateEditor from "./TemplateEditor";
import { templateApi } from "../../utils/api/templateApi";
import { useTemplate } from "../../utils/templates/templateContext";
import { buildApiUrl } from "../../utils/helpers/apiConfig";
import { universalFetch } from "../../utils/helpers/apiHelpers";

const TemplateSettingsPanel = ({
  isCollapsed,
  setIsCollapsed,
  templates,
  setTemplates,
}) => {
  const { colorMode } = useColorMode();
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

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
      setIsModalOpen(true);
    }
  };

  const handleSaveTemplate = async (templateKey, updatedTemplate) => {
    setIsSaving(true);
    try {
      // Save to backend
      // eslint-disable-next-line no-unused-vars
      const response = await templateApi.saveTemplates([updatedTemplate]);

      // Fetch fresh templates list
      const freshTemplates = await templateApi.fetchTemplates();
      setTemplates(freshTemplates);

      toast({
        title: "Success",
        description: "Template saved successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Failed to save template:", error);
      toast({
        title: "Error",
        description: "Failed to save template",
        status: "error",
        duration: 3000,
        isClosable: true,
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
      toast({
        title: "Error",
        description: error.message || "Failed to delete template",
        status: "error",
        duration: 3000,
        isClosable: true,
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
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error generating template from example:", error);
      toast({
        title: "Error",
        description: "Failed to generate template from example",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsGeneratingTemplate(false);
      setExampleNote("");
    }
  };

  return (
    <Box className="panels-bg" p="4" borderRadius="sm">
      <Flex align="center" justify="space-between">
        <Flex align="center">
          <IconButton
            icon={isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label="Toggle collapse"
            variant="outline"
            size="sm"
            mr="2"
            className="collapse-toggle"
          />
          <FaFileAlt size="1.2em" style={{ marginRight: "5px" }} />
          <Text as="h3">Note Templates</Text>
        </Flex>
        <Button
          leftIcon={<AddIcon />}
          onClick={() => setIsNewTemplateModalOpen(true)}
          className="grey-button"
        >
          New Template
        </Button>
      </Flex>
      <Collapse in={!isCollapsed} animateOpacity>
        <VStack spacing={4} align="stretch" mt={4}>
          {Array.isArray(templates) ? (
            // Sort templates: default templates first, custom templates last
            templates
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
                  borderColor={colorMode === "light" ? "gray.200" : "gray.600"}
                  borderRadius="sm"
                >
                  <Flex align="center" justify="space-between">
                    <Text fontSize="lg" fontWeight="bold">
                      {template.template_name}
                    </Text>
                    <HStack spacing={2}>
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
                          icon={<DeleteIcon />}
                          onClick={() => {
                            setTemplateToDelete({
                              key: template.template_key,
                              name: template.template_name,
                            });
                            setIsDeleteModalOpen(true);
                          }}
                          colorScheme="red"
                          aria-label="Delete template"
                        />
                      )}
                    </HStack>
                  </Flex>
                </Box>
              ))
          ) : (
            <Text>No templates available</Text>
          )}
        </VStack>
      </Collapse>

      <TemplateEditor
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        template={selectedTemplate}
        templateKey={selectedTemplateKey}
        onSave={handleSaveTemplate}
      />

      {/* New Template from Example Modal */}
      <Modal
        isOpen={isNewTemplateModalOpen}
        onClose={() => setIsNewTemplateModalOpen(false)}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>New Template</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Textarea
              placeholder="Paste your example note here..."
              value={exampleNote}
              onChange={(e) => setExampleNote(e.target.value)}
              size="lg"
              minH="200px"
            />
          </ModalBody>
          <ModalFooter>
            <Button
              className="red-button"
              mr={3}
              onClick={() => setIsNewTemplateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="green-button"
              onClick={handleNewTemplateFromExample}
              isLoading={isGeneratingTemplate}
            >
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      {/* Add Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Delete Template</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            Are you sure you want to delete the template "
            {templateToDelete?.name}"? This action cannot be undone.
          </ModalBody>
          <ModalFooter>
            <Button
              className="red-button"
              mr={3}
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="green-button"
              onClick={() => handleDeleteTemplate(templateToDelete?.key)}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default TemplateSettingsPanel;
