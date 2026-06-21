// Field property editor panel.
import React from "react";
import {
  Box,
  Text,
  VStack,
  Input,
  Select,
  NumberInput,
  NumberInputField,
  Checkbox,
  FormControl,
  FormLabel,
  Textarea,
  HStack,
  IconButton,
  useColorModeValue,
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
    <VStack spacing="3" align="stretch">
      <HStack justify="space-between">
        <Text as="h4">Field Properties</Text>
        <IconButton
          icon={<DeleteIcon />}
          variant="ghost"
          size="sm"
          colorScheme="red"
          aria-label="Delete field"
          onClick={() => onDelete(field.id)}
        />
      </HStack>

      <FormControl>
        <FormLabel fontSize="xs" mb="1">
          Name
        </FormLabel>
        <Input
          size="sm"
          value={field.name}
          onChange={(e) => onChange({ ...field, name: e.target.value })}
          placeholder="field_name"
          className="input-style"
        />
      </FormControl>

      <FormControl>
        <FormLabel fontSize="xs" mb="1">
          Type
        </FormLabel>
        <Select
          size="sm"
          value={field.field_type}
          onChange={(e) => onChange({ ...field, field_type: e.target.value })}
          className="input-style"
        >
          <option value="text">Text</option>
          <option value="checkbox">Checkbox</option>
          <option value="date">Date</option>
          <option value="number">Number</option>
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel fontSize="xs" mb="1">
          Description
        </FormLabel>
        <Textarea
          size="sm"
          value={field.description || ""}
          onChange={(e) => onChange({ ...field, description: e.target.value })}
          placeholder="Optional description"
          rows={2}
          className="input-style"
        />
      </FormControl>

      <HStack spacing="3">
        <FormControl>
          <FormLabel fontSize="xs" mb="1">
            Font Size
          </FormLabel>
          <NumberInput
            size="sm"
            value={field.font_size || 12}
            min={6}
            max={72}
            onChange={(_, val) => onChange({ ...field, font_size: val || 12 })}
          >
            <NumberInputField className="input-style" />
          </NumberInput>
        </FormControl>

        <FormControl>
          <FormLabel fontSize="xs" mb="1">
            Page
          </FormLabel>
          <NumberInput
            size="sm"
            value={field.page_number}
            min={1}
            onChange={(_, val) => onChange({ ...field, page_number: val || 1 })}
          >
            <NumberInputField className="input-style" />
          </NumberInput>
        </FormControl>
      </HStack>

      <Checkbox
        size="sm"
        isChecked={field.required}
        onChange={(e) => onChange({ ...field, required: e.target.checked })}
      >
        Required field
      </Checkbox>

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
