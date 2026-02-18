import {
  Box,
  Flex,
  IconButton,
  Text,
  Collapse,
  Button,
  VStack,
  HStack,
  Input,
  Textarea,
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
  EditIcon,
} from "@chakra-ui/icons";
import { FaEnvelopeOpenText } from "react-icons/fa";
import { useState, useEffect } from "react";
import { settingsService } from "../../utils/settings/settingsUtils";

const LetterTemplatesPanel = ({ isCollapsed, setIsCollapsed }) => {
  const [letterTemplates, setLetterTemplates] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);
  const toast = useToast();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await settingsService.fetchLetterTemplates();
      setLetterTemplates(response.templates || []);
    } catch (error) {
      console.error("Failed to fetch letter templates", error);
      toast({
        title: "Error",
        description: "Failed to fetch letter templates",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleSave = async (template) => {
    try {
      await settingsService.saveLetterTemplate(template);
      // Show success toast
      toast({
        title: "Success",
        description: `Letter template ${editTemplate ? "updated" : "created"} successfully`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      fetchTemplates();
      setIsEditing(false);
      setEditTemplate(null);
    } catch (error) {
      console.error("Failed to save letter template", error);
      // Show error toast
      toast({
        title: "Error",
        description: "Failed to save letter template",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleDelete = async (templateId) => {
    try {
      await settingsService.deleteLetterTemplate(templateId);
      toast({
        title: "Success",
        description: "Letter template deleted successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      fetchTemplates();
    } catch (error) {
      console.error("Failed to delete letter template", error);
      toast({
        title: "Error",
        description: "Failed to delete letter template",
        status: "error",
        duration: 3000,
        isClosable: true,
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
            icon={isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label="Toggle collapse"
            variant="outline"
            size="sm"
            mr="2"
            className="collapse-toggle"
          />
          <FaEnvelopeOpenText size="1.2em" style={{ marginRight: "5px" }} />
          <Text as="h3">Letter Templates</Text>
        </Flex>
        <HStack>
          <Button
            leftIcon={<AddIcon />}
            onClick={() => {
              setEditTemplate(null);
              setIsEditing(true);
            }}
            className="grey-button"
          >
            New Template
          </Button>
          <Button onClick={handleReset} className="red-button">
            Reset to Defaults
          </Button>
        </HStack>
      </Flex>

      <Collapse in={!isCollapsed} animateOpacity>
        <VStack spacing={4} mt={4}>
          {letterTemplates.map((template) => (
            <Box
              key={template.id}
              p={4}
              border="1px"
              borderColor="gray.200"
              borderRadius="sm"
              width="100%"
            >
              <Flex justify="space-between" align="center">
                <Text fontWeight="bold">{template.name}</Text>
                <HStack>
                  <IconButton
                    size="sm"
                    icon={<EditIcon />}
                    onClick={() => {
                      setEditTemplate(template);
                      setIsEditing(true);
                    }}
                    aria-label="Edit"
                  />
                  {template.name !== "Dictation" && (
                    <IconButton
                      size="sm"
                      icon={<DeleteIcon />}
                      onClick={() => handleDelete(template.id)}
                      colorScheme="red"
                      aria-label="Delete"
                    />
                  )}
                </HStack>
              </Flex>
              <Text mt={2} fontSize="sm" color="gray.600">
                {template.instructions}
              </Text>
            </Box>
          ))}
        </VStack>
      </Collapse>

      {/* Edit/New Template Modal */}
      <Modal isOpen={isEditing} onClose={() => setIsEditing(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {editTemplate ? "Edit Template" : "New Template"}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Input
                placeholder="Template Name"
                value={editTemplate?.name || ""}
                onChange={(e) =>
                  setEditTemplate((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                isDisabled={editTemplate?.name === "Dictation"}
              />
              <Textarea
                placeholder="Instructions for letter generation..."
                value={editTemplate?.instructions || ""}
                onChange={(e) =>
                  setEditTemplate((prev) => ({
                    ...prev,
                    instructions: e.target.value,
                  }))
                }
              />
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button
              mr={3}
              onClick={() => {
                setIsEditing(false);
                setEditTemplate(null);
              }}
              className="red-button"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleSave(editTemplate)}
              className="green-button"
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default LetterTemplatesPanel;
