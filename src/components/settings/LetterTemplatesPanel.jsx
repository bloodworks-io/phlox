import { Box, Flex, IconButton, Text, Collapsible, Button, VStack, HStack } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
const toast = toaster.create;
import {
  ChevronRightIcon,
  ChevronDownIcon,
  AddIcon,
  DeleteIcon,
  EditIcon,
} from "../common/icons";
import { FaEnvelopeOpenText } from "react-icons/fa";
import { useState, useEffect } from "react";
import { settingsService } from "../../utils/settings/settingsUtils";
import LetterTemplateEditModal from "../modals/LetterTemplateEditModal";

const LetterTemplatesPanel = ({ isCollapsed, setIsCollapsed }) => {
  const [letterTemplates, setLetterTemplates] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await settingsService.fetchLetterTemplates();
      setLetterTemplates(response.templates || []);
    } catch (error) {
      console.error("Failed to fetch letter templates", error);
      toaster.create({
        title: "Error",
        description: "Failed to fetch letter templates",
        type: "error",
        duration: 3000,
      });
    }
  };

  const handleSave = async (template, closeModal) => {
    try {
      await settingsService.saveLetterTemplate(template);
      // Show success toast
      toaster.create({
        title: "Success",
        description: `Letter template ${template?.id ? "updated" : "created"} successfully`,
        type: "success",
        duration: 3000,
      });

      fetchTemplates();
      if (closeModal) closeModal();
      setIsEditing(false);
      setEditTemplate(null);
    } catch (error) {
      console.error("Failed to save letter template", error);
      // Show error toast
      toaster.create({
        title: "Error",
        description: "Failed to save letter template",
        type: "error",
        duration: 3000,
      });
    }
  };

  const handleDelete = async (templateId) => {
    try {
      await settingsService.deleteLetterTemplate(templateId);
      toaster.create({
        title: "Success",
        description: "Letter template deleted successfully",
        type: "success",
        duration: 3000,
      });
      fetchTemplates();
    } catch (error) {
      console.error("Failed to delete letter template", error);
      toaster.create({
        title: "Error",
        description: "Failed to delete letter template",
        type: "error",
        duration: 3000,
      });
    }
  };

  const handleReset = async () => {
    try {
      await settingsService.resetLetterTemplates(toast);
      fetchTemplates();
    } catch (error) {
      console.error("Failed to reset letter templates", error);
    }
  };

  return (
    <Box p="4" borderRadius="sm" className="panels-bg">
      <Flex align="center" justify="space-between">
        <Flex align="center">
          <IconButton
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label="Toggle collapse"
            variant="outline"
            size="sm"
            mr="2"
            className="collapse-toggle">{isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}</IconButton>
          <FaEnvelopeOpenText size="1.2em" style={{ marginRight: "5px" }} />
          <Text as="h3">Letter Templates</Text>
        </Flex>
        <HStack>
          <Button
            onClick={() => {
              setEditTemplate(null);
              setIsEditing(true);
            }}
            className="grey-button"><AddIcon />New Template
                      </Button>
          <Button onClick={handleReset} className="red-button">
            Reset to Defaults
          </Button>
        </HStack>
      </Flex>
      <Collapsible.Root open={!isCollapsed}>
        <Collapsible.Content>
          <VStack gap={4} mt={4}>
            {letterTemplates.map((template) => (
              <Box
                key={template.id}
                p={4}
                border="1px"
                borderColor="border"
                borderRadius="sm"
                width="100%"
              >
                <Flex justify="space-between" align="center">
                  <Text fontWeight="bold">{template.name}</Text>
                  <HStack>
                    <IconButton
                      size="sm"
                      onClick={() => {
                        setEditTemplate(template);
                        setIsEditing(true);
                      }}
                      aria-label="Edit"><EditIcon /></IconButton>
                    {template.name !== "Dictation" && (
                      <IconButton
                        size="sm"
                        onClick={() => handleDelete(template.id)}
                        colorPalette="red"
                        aria-label="Delete"><DeleteIcon /></IconButton>
                    )}
                  </HStack>
                </Flex>
                <Text mt={2} fontSize="sm" color="textTertiary">
                  {template.instructions}
                </Text>
              </Box>
            ))}
          </VStack>
        </Collapsible.Content>
      </Collapsible.Root>
      {/* Edit/New Template Modal */}
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
    </Box>
  );
};

export default LetterTemplatesPanel;
