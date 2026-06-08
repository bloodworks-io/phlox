// Panel component for the Form Templates tab — sidebar, builder canvas, and field editor.
import React from "react";
import {
  Box,
  Text,
  VStack,
  HStack,
  Select,
  Flex,
  useColorModeValue,
} from "@chakra-ui/react";
import { AddIcon } from "@chakra-ui/icons";
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
  onSelectTemplate,
  onDeleteTemplate,
  onFieldsChange,
  onSelectField,
  onUpdateField,
  onDeleteField,
  onSaveFields,
}) => {
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const mutedColor = useColorModeValue("gray.400", "gray.500");

  return (
    <HStack spacing="4" align="start">
      {/* Forms sidebar */}
      <Box
        w="240px"
        flexShrink={0}
        borderRadius="sm"
        className="panels-bg"
        p="2"
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
            borderColor={borderColor}
            borderRadius="sm"
          >
            <Text color={mutedColor} fontSize="sm">
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
            borderColor={borderColor}
          >
            {isDrawingMode ? (
              <VStack spacing="2" align="stretch">
                <HStack spacing="1">
                  <Box as={FaPencilAlt} color="blue.400" fontSize="0.7em" />
                  <Text fontSize="xs" fontWeight="bold">
                    Drawing mode
                  </Text>
                </HStack>
                <Select
                  size="xs"
                  value={activeFieldType}
                  onChange={(e) => onSetFieldType(e.target.value)}
                  className="input-style"
                >
                  <option value="text">Text</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="date">Date</option>
                  <option value="number">Number</option>
                </Select>
                <GreyButton
                  size="xs"
                  width="100%"
                  onClick={() => onSetDrawingMode(false)}
                >
                  Done
                </GreyButton>
              </VStack>
            ) : (
              <VStack spacing="2" align="stretch">
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
                    isLoading={detecting}
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
          <Box mt="3" pt="2" borderTop="1px solid" borderColor={borderColor}>
            <GreenButton
              size="xs"
              width="100%"
              onClick={onSaveFields}
              isLoading={saving}
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
