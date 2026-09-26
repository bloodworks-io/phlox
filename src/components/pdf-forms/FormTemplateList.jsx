// Template list panel for PDF form templates.
import React from "react";
import { Box, Text, VStack, IconButton, Spinner, HStack, Flex } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { DeleteIcon, RepeatIcon } from "../common/icons";
import { FiFileText } from "react-icons/fi";
import { pdfFormsApi } from "../../utils/api/pdfFormsApi";
import { useTranslation } from "react-i18next";

const FormTemplateList = ({ templates, loading, onSelect, onDelete, onReplace, selectedTemplateId }) => {
  const { t } = useTranslation();

  const handleDelete = async (e, id, name) => {
    e.stopPropagation();
    try {
      await pdfFormsApi.deleteTemplate(id);
      toaster.create({
        title: t("forms.deleted"),
        description: t("forms.templateDeleted", { name }),
        type: "success",
        duration: 2000,
      });
      onDelete(id);
    } catch (error) {
      toaster.create({
        title: t("toast.error"),
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
          {t("forms.noTemplatesYet")}
        </Text>
      </Box>
    );
  }

  return (
    <VStack
      gap="1"
      align="stretch"
      className="anim-stagger"
      css={{ "& > *": { animationDuration: "0.15s" } }}
    >
      {templates.map((tmpl) => {
        const isSelected = tmpl.id === selectedTemplateId;
        return (
          <Box
            key={tmpl.id}
            p="2"
            w="full"
            borderRadius="sm"
            cursor="pointer"
            bg={isSelected ? "surfaceMuted" : undefined}
            _hover={{ bg: "surfaceMuted" }}
            transition="background-color 0.15s ease"
            aria-current={isSelected ? "true" : undefined}
            onClick={() => onSelect(tmpl.id)}
          >
            <HStack justify="space-between" gap="2">
              <HStack gap="2" css={{ minWidth: 0, flex: "1 1 0" }}>
                <Box color="primaryButton" flexShrink={0} asChild><FiFileText /></Box>
                <Box css={{ minWidth: 0, flex: "1 1 0", overflow: "hidden" }}>
                  <Text
                    fontSize="sm"
                    fontWeight="medium"
                    css={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {tmpl.name}
                  </Text>
                  <Text
                    fontSize="xs"
                    color="overlay0"
                    css={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {t("forms.pageCount", { count: tmpl.page_count })} ·{" "}
                    {t("forms.fieldCount", { count: tmpl.field_count || 0 })}
                  </Text>
                </Box>
              </HStack>
              <HStack gap="1" flexShrink={0}>
                <IconButton
                  variant="ghost"
                  size="sm"
                  aria-label={t("forms.replacePdf")}
                  title={t("forms.replacePdfKeepFields")}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReplace(tmpl);
                  }}
                ><RepeatIcon /></IconButton>
                <IconButton
                  variant="ghost"
                  size="sm"
                  colorPalette="red"
                  aria-label={t("forms.deleteTemplate")}
                  onClick={(e) => handleDelete(e, tmpl.id, tmpl.name)}><DeleteIcon /></IconButton>
              </HStack>
            </HStack>
          </Box>
        );
      })}
    </VStack>
  );
};

export default FormTemplateList;
