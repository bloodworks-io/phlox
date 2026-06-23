// Template list panel for PDF form templates.
import React from "react";
import { useColorModeValue } from "../ui/color-mode";
import { Steps, Box, Text, List, IconButton, Spinner, HStack, Flex } from "@chakra-ui/react";
import { useToast } from "@/utils/useToastShim";
import { DeleteIcon } from "../common/icons";
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
    <List.Root gap="1">
      {templates.map((tmpl) => (
        <List.Item
          key={tmpl.id}
          p="2"
          borderRadius="sm"
          cursor="pointer"
          _hover={{ bg: hoverBg }}
          onClick={() => onSelect(tmpl.id)}
        >
          <HStack justify="space-between">
            <HStack gap="2" overflow="hidden">
              <Box color="blue.400" flexShrink={0} asChild><FiFileText /></Box>
              <Box overflow="hidden">
                <Text fontSize="sm" fontWeight="medium" lineClamp={1}>
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
              variant="ghost"
              size="sm"
              colorPalette="red"
              aria-label="Delete template"
              onClick={(e) => handleDelete(e, tmpl.id, tmpl.name)}><DeleteIcon /></IconButton>
          </HStack>
        </List.Item>
      ))}
    </List.Root>
  );
};

export default FormTemplateList;
