// Template list panel for PDF form templates.
import React from "react";
import { Box, Text, List, IconButton, Spinner, HStack, Flex } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { DeleteIcon, RepeatIcon } from "../common/icons";
import { FiFileText } from "react-icons/fi";
import { pdfFormsApi } from "../../utils/api/pdfFormsApi";

const FormTemplateList = ({ templates, loading, onSelect, onDelete, onReplace }) => {

  const handleDelete = async (e, id, name) => {
    e.stopPropagation();
    try {
      await pdfFormsApi.deleteTemplate(id);
      toaster.create({
        title: "Deleted",
        description: `"${name}" deleted`,
        type: "success",
        duration: 2000,
      });
      onDelete(id);
    } catch (error) {
      toaster.create({
        title: "Error",
        description: error.message,
        type: "error",
        duration: 3000,
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
        <Text color="overlay0" fontSize="sm">
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
          _hover={{ bg: "surfaceMuted" }}
          onClick={() => onSelect(tmpl.id)}
        >
          <HStack justify="space-between">
            <HStack gap="2" overflow="hidden">
              <Box color="primaryButton" flexShrink={0} asChild><FiFileText /></Box>
              <Box overflow="hidden">
                <Text fontSize="sm" fontWeight="medium" lineClamp={1}>
                  {tmpl.name}
                </Text>
                <Text fontSize="xs" color="overlay0">
                  {tmpl.page_count} page{tmpl.page_count !== 1 ? "s" : ""} ·{" "}
                  {tmpl.field_count || 0} field
                  {(tmpl.field_count || 0) !== 1 ? "s" : ""}
                </Text>
              </Box>
            </HStack>
            <HStack gap="1" flexShrink={0}>
              <IconButton
                variant="ghost"
                size="sm"
                aria-label="Replace PDF"
                title="Replace PDF (keep fields)"
                onClick={(e) => {
                  e.stopPropagation();
                  onReplace(tmpl);
                }}
              ><RepeatIcon /></IconButton>
              <IconButton
                variant="ghost"
                size="sm"
                colorPalette="red"
                aria-label="Delete template"
                onClick={(e) => handleDelete(e, tmpl.id, tmpl.name)}><DeleteIcon /></IconButton>
            </HStack>
          </HStack>
        </List.Item>
      ))}
    </List.Root>
  );
};

export default FormTemplateList;
