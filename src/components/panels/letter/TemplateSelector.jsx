import React from "react";
import { Box, Text, HStack, Button } from "@chakra-ui/react";

const TemplateSelector = ({
  letterTemplates,
  selectedTemplate,
  onTemplateSelect,
}) => {
  return (
    <Box mb="4" px="4">
      <Text mb="2" fontSize="sm" fontWeight="bold">
        Letter Template:
      </Text>
      <HStack spacing="2" overflowX="auto" pb="2">
        {letterTemplates
          .filter((t) => t.name !== "Dictation")
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
              className="grey-button"
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
          className="grey-button"
          minWidth="auto"
          flexShrink={0}
        >
          Custom
        </Button>
      </HStack>
    </Box>
  );
};

export default TemplateSelector;
