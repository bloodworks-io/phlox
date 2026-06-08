// Template list panel for PDF form templates.
import React from "react";
import {
  Box,
  Text,
  List,
  ListItem,
  IconButton,
  Spinner,
  HStack,
  Flex,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import { DeleteIcon } from "@chakra-ui/icons";
import { FiFileText } from "react-icons/fi";
import { pdfFormsApi } from "../../utils/api/pdfFormsApi";

const FormTemplateList = ({ templates, loading, onSelect, onDelete }) => {
  const toast = useToast();
  const hoverBg = useColorModeValue("gray.100", "gray.700");
  const mutedColor = useColorModeValue("gray.500", "gray.400");

  const handleDelete = async (e, id, name) => {
    e.stopPropagation();
    try {
      await pdfFormsApi.deleteTemplate(id);
      toast({
        title: "Deleted",
        description: `"${name}" deleted`,
        status: "success",
        duration: 2000,
        isClosable: true,
      });
      onDelete(id);
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  if (loading) {
    return (
      <Flex justify="center" py="4">
        <Spinner size="sm" />
      </Flex>
    );
  }

  if (!templates.length) {
    return (
      <Box py="4" textAlign="center">
        <Text color={mutedColor} fontSize="sm">
          No form templates yet. Upload a PDF to get started.
        </Text>
      </Box>
    );
  }

  return (
    <List spacing="1">
      {templates.map((tmpl) => (
        <ListItem
          key={tmpl.id}
          p="2"
          borderRadius="sm"
          cursor="pointer"
          _hover={{ bg: hoverBg }}
          onClick={() => onSelect(tmpl.id)}
        >
          <HStack justify="space-between">
            <HStack spacing="2" overflow="hidden">
              <Box as={FiFileText} color="blue.400" flexShrink={0} />
              <Box overflow="hidden">
                <Text fontSize="sm" fontWeight="medium" noOfLines={1}>
                  {tmpl.name}
                </Text>
                <Text fontSize="xs" color={mutedColor}>
                  {tmpl.page_count} page{tmpl.page_count !== 1 ? "s" : ""} ·{" "}
                  {tmpl.field_count || 0} field
                  {(tmpl.field_count || 0) !== 1 ? "s" : ""}
                </Text>
              </Box>
            </HStack>
            <IconButton
              icon={<DeleteIcon />}
              variant="ghost"
              size="sm"
              colorScheme="red"
              aria-label="Delete template"
              onClick={(e) => handleDelete(e, tmpl.id, tmpl.name)}
            />
          </HStack>
        </ListItem>
      ))}
    </List>
  );
};

export default FormTemplateList;
