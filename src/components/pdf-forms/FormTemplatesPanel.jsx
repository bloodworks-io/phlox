// Panel component for the Form Templates tab — sidebar, builder canvas, and field editor.
import React from "react";
import { Box, Text, VStack, HStack, NativeSelect, Flex } from "@chakra-ui/react";
import { AddIcon } from "../common/icons";
import { FaPencilAlt, FaMagic, FaSave } from "react-icons/fa";
import { GreenButton, GreyButton } from "../common/Buttons";
import FormTemplateList from "./FormTemplateList";
import FormBuilder from "./FormBuilder";
import FieldEditor from "./FieldEditor";

const FormTemplatesPanel = ({
  templates,
  templatesLoading,
  selectedTemplate,
  fields,
  selectedField,
  selectedFieldId,
  saving,
  isDrawingMode,
  activeFieldType,
  visionCapable,
  detecting,
  onSetDrawingMode,
  onSetFieldType,
  onAutoDetect,
  onOpenUpload,
  onReplaceTemplate,
  onSelectTemplate,
  onDeleteTemplate,
  onFieldsChange,
  onSelectField,
  onUpdateField,
  onDeleteField,
  onSaveFields,
}) => {
  return (
    <HStack gap="4" align="start">
      {/* Forms sidebar */}
      <Box
        w="240px"
        flexShrink={0}
        borderRadius="sm"
        className="panels-bg"
        p="2"
        maxH="calc(100vh - 200px)"
        overflowY="auto"
      >
        <Flex justify="space-between" align="center" mb="2">
          <Text as="h4" fontSize="sm">
            Forms
          </Text>
          <GreyButton size="xs" leftIcon={<AddIcon />} onClick={onOpenUpload}>
            New
          </GreyButton>
        </Flex>

        <FormTemplateList
          templates={templates}
          loading={templatesLoading}
          onSelect={onSelectTemplate}
          onDelete={onDeleteTemplate}
          onReplace={onReplaceTemplate}
          selectedTemplateId={selectedTemplate?.id}
        />
      </Box>
      {/* Form builder canvas */}
      <Box flex="1" minW="0">
        {selectedTemplate ? (
          <FormBuilder
            template={selectedTemplate}
            fields={fields}
            onFieldsChange={onFieldsChange}
            selectedFieldId={selectedFieldId}
            onSelectField={onSelectField}
            onUpdateField={onUpdateField}
            isDrawing={isDrawingMode}
            onToggleDrawing={() => onSetDrawingMode(!isDrawingMode)}
            activeFieldType={activeFieldType}
            onFieldTypeChange={onSetFieldType}
          />
        ) : (
          <Box
            py="16"
            textAlign="center"
            border="1px dashed"
            borderColor="border"
            borderRadius="sm"
          >
            <Text color="overlay0" fontSize="sm">
              Select a template or upload a new PDF
            </Text>
          </Box>
        )}
      </Box>
      {/* Field editor sidebar */}
      <Box
        w="240px"
        flexShrink={0}
        p="2"
        borderRadius="sm"
        className="panels-bg"
      >
        {/* New field controls */}
        {selectedTemplate && (
          <Box
            mb="3"
            pb="2"
            borderBottom="1px solid"
            borderColor="border"
          >
            {isDrawingMode ? (
              <VStack gap="2" align="stretch">
                <HStack gap="1">
                  <Box color="primaryButton" fontSize="0.7em" asChild><FaPencilAlt /></Box>
                  <Text fontSize="xs" fontWeight="bold">
                    Drawing mode
                  </Text>
                </HStack>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    size="xs"
                    value={activeFieldType}
                    onChange={(e) => onSetFieldType(e.target.value)}
                    className="input-style">
                    <option value="text">Text</option>
                    <option value="checkbox">Checkbox</option>
                    <option value="date">Date</option>
                    <option value="number">Number</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <GreyButton
                  size="xs"
                  width="100%"
                  onClick={() => onSetDrawingMode(false)}
                >
                  Done
                </GreyButton>
              </VStack>
            ) : (
              <VStack gap="2" align="stretch">
                <GreyButton
                  size="xs"
                  width="100%"
                  leftIcon={<AddIcon />}
                  onClick={() => onSetDrawingMode(true)}
                >
                  New Field
                </GreyButton>
                {visionCapable && (
                  <GreyButton
                    size="xs"
                    width="100%"
                    leftIcon={<FaMagic />}
                    onClick={onAutoDetect}
                    loading={detecting}
                    loadingText="Detecting..."
                  >
                    Auto-detect
                  </GreyButton>
                )}
              </VStack>
            )}
          </Box>
        )}

        <FieldEditor
          field={selectedField}
          onChange={onUpdateField}
          onDelete={onDeleteField}
        />

        {selectedTemplate && (
          <Box mt="3" pt="2" borderTop="1px solid" borderColor="border">
            <GreenButton
              size="xs"
              width="100%"
              onClick={onSaveFields}
              loading={saving}
              loadingText="Saving"
              leftIcon={saving ? null : <FaSave />}
            >
              {saving ? "Saving..." : "Save Fields"}
            </GreenButton>
          </Box>
        )}
      </Box>
    </HStack>
  );
};

export default FormTemplatesPanel;
