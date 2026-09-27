import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Text, HStack, Button } from "@chakra-ui/react";

const TemplateSelector = ({
  letterTemplates,
  selectedTemplate,
  onTemplateSelect,
}) => {
  const { t } = useTranslation();
  return (
    <Box mb="4" px="4">
      <Text mb="2" fontSize="sm" fontWeight="bold">
        {t("letter.templateLabel")}
      </Text>
      <HStack gap="2" overflowX="auto" pb="2">
        {letterTemplates
          .filter((tpl) => tpl.name !== "Dictation")
          .map((template) => (
            <Button
              key={template.id}
              size="sm"
              variant={
                selectedTemplate && selectedTemplate.id === template.id
                  ? "solid"
                  : "outline"
              }
              onClick={() => onTemplateSelect(template)}
              className="grey-button grey-button-sm"
              minWidth="auto"
              flexShrink={0}
            >
              {template.name}
            </Button>
          ))}
        <Button
          size="sm"
          variant={selectedTemplate === "custom" ? "solid" : "outline"}
          onClick={() => onTemplateSelect("custom")}
          className="grey-button grey-button-sm"
          minWidth="auto"
          flexShrink={0}
        >
          {t("settings.templates.badgeCustom")}
        </Button>
      </HStack>
    </Box>
  );
};

export default TemplateSelector;
