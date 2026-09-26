// Compact field inventory list with per-row delete — the builder's field list.
import React from "react";
import { Box, Text, VStack, HStack, IconButton } from "@chakra-ui/react";
import { DeleteIcon } from "../common/icons";
import { FIELD_COLORS } from "./FieldEditor";
import { useTranslation } from "react-i18next";

const FieldList = ({
  fields,
  selectedFieldId,
  onSelectField,
  onDeleteField,
  onJumpToPage,
}) => {
  const { t } = useTranslation();
  if (!fields.length) {
    return (
      <Text fontSize="xs" color="overlay0" py="2" textAlign="center">
        {t("forms.noFieldsYet")}
      </Text>
    );
  }

  const sorted = [...fields].sort(
    (a, b) => a.page_number - b.page_number || a.name.localeCompare(b.name),
  );

  return (
    <VStack gap="0.5" align="stretch" maxH="170px" overflowY="auto">
      {sorted.map((field) => {
        const isSelected = field.id === selectedFieldId;
        return (
          <HStack
            key={field.id}
            gap="2"
            p="1"
            pl="2"
            borderRadius="sm"
            cursor="pointer"
            minW="0"
            bg={isSelected ? "surfaceMuted" : undefined}
            _hover={{ bg: "surfaceMuted" }}
            onClick={() => {
              onSelectField(field.id);
              onJumpToPage(field.page_number);
            }}
          >
            <Box
              w="7px"
              h="7px"
              borderRadius="full"
              flexShrink={0}
              bg={FIELD_COLORS[field.field_type] || FIELD_COLORS.text}
            />
            <Text
              fontSize="xs"
              css={{
                minWidth: 0,
                flex: "1 1 0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {field.name || t("forms.unnamedField")}
            </Text>
            <Text fontSize="xs" color="overlay0" flexShrink={0}>
              {t("forms.pageShort", { page: field.page_number })}
            </Text>
            <IconButton
              variant="ghost"
              size="xs"
              colorPalette="red"
              aria-label={t("forms.deleteFieldNamed", {
                name: field.name || t("forms.unnamed"),
              })}
              flexShrink={0}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteField(field.id);
              }}
            ><DeleteIcon /></IconButton>
          </HStack>
        );
      })}
    </VStack>
  );
};

export default FieldList;
