// Field property editor panel.
import React from "react";
import { useColorModeValue } from "../ui/color-mode";
import {
  Steps,
  Box,
  Text,
  VStack,
  Input,
  NativeSelect,
  NumberInput,
  NumberInputField,
  Checkbox,
  Textarea,
  HStack,
  IconButton,
  Field,
} from "@chakra-ui/react";
import { DeleteIcon } from "../common/icons";

const FIELD_COLORS = {
  text: "blue.400",
  checkbox: "green.400",
  date: "orange.400",
  number: "purple.400",
};

const FieldEditor = ({ field, onChange, onDelete }) => {
  const mutedColor = useColorModeValue("gray.500", "gray.400");
  const borderColor = useColorModeValue("gray.200", "gray.600");

  if (!field) {
    return (
      <Box py="4" textAlign="center">
        <Text color={mutedColor} fontSize="sm">
          Select a field to edit its properties, or draw a new field on the PDF.
        </Text>
      </Box>
    );
  }

  return (
    <VStack gap="3" align="stretch">
      <HStack justify="space-between">
        <Text as="h4">Field Properties</Text>
        <IconButton
          variant="ghost"
          size="sm"
          colorPalette="red"
          aria-label="Delete field"
          onClick={() => onDelete(field.id)}><DeleteIcon /></IconButton>
      </HStack>
      <Field.Root>
        <Field.Label fontSize="xs" mb="1">
          Name
        </Field.Label>
        <Input
          size="sm"
          value={field.name}
          onValueChange={(e) => onChange({ ...field, name: e.target.value })}
          placeholder="field_name"
          className="input-style"
        />
      </Field.Root>
      <Field.Root>
        <Field.Label fontSize="xs" mb="1">
          Type
        </Field.Label>
        <NativeSelect.Root>
          <NativeSelect.Field
            size="sm"
            value={field.field_type}
            onValueChange={(e) => onChange({ ...field, field_type: e.target.value })}
            className="input-style">
            <option value="text">Text</option>
            <option value="checkbox">Checkbox</option>
            <option value="date">Date</option>
            <option value="number">Number</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Field.Root>
      <Field.Root>
        <Field.Label fontSize="xs" mb="1">
          Description
        </Field.Label>
        <Textarea
          size="sm"
          value={field.description || ""}
          onValueChange={(e) => onChange({ ...field, description: e.target.value })}
          placeholder="Optional description"
          rows={2}
          className="input-style"
        />
      </Field.Root>
      <HStack gap="3">
        <Field.Root>
          <Field.Label fontSize="xs" mb="1">
            Font Size
          </Field.Label>
          <NumberInput.Root
            size="sm"
            value={String(field.font_size || 12)}
            min={6}
            max={72}
            onValueChange={(_, val) => onChange({ ...field, font_size: val || 12 })}
          >
            <NumberInput.Input className="input-style" />
          </NumberInput.Root>
        </Field.Root>

        <Field.Root>
          <Field.Label fontSize="xs" mb="1">
            Page
          </Field.Label>
          <NumberInput.Root
            size="sm"
            value={String(field.page_number)}
            min={1}
            onValueChange={(_, val) => onChange({ ...field, page_number: val || 1 })}
          >
            <NumberInput.Input className="input-style" />
          </NumberInput.Root>
        </Field.Root>
      </HStack>
      <Checkbox.Root
        size="sm"
        onCheckedChange={(e) => onChange({ ...field, required: e.target.checked })}
        checked={field.required}
      ><Checkbox.HiddenInput /><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control><Checkbox.Label>Required field
                </Checkbox.Label></Checkbox.Root>
      <Box pt="2" borderTop="1px solid" borderColor={borderColor}>
        <Text fontSize="xs" color={mutedColor}>
          Position: ({field.x.toFixed(1)}, {field.y.toFixed(1)}) · Size:{" "}
          {field.width.toFixed(1)} × {field.height.toFixed(1)}
        </Text>
      </Box>
    </VStack>
  );
};

export default FieldEditor;
export { FIELD_COLORS };
