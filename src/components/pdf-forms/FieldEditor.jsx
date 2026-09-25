// Field property editor panel.
import React, { useState, useEffect } from "react";
import {
  Box,
  Text,
  VStack,
  Input,
  NativeSelect,
  NumberInput,
  Checkbox,
  Textarea,
  HStack,
  IconButton,
  Field,
} from "@chakra-ui/react";
import { DeleteIcon } from "../common/icons";
import { layoutTextField, getHelveticaMeasure } from "../../utils/pdf/fieldLayout";

const FIELD_COLORS = {
  text: "blue.400",
  checkbox: "green.400",
  date: "orange.400",
  number: "purple.400",
};

const FieldEditor = ({
  field,
  onChange,
  onDelete,
  previewValue,
  onPreviewValueChange,
}) => {
  // Helvetica metrics for the overflow warning (matches fillPdf exactly)
  const [measure, setMeasure] = useState(null);
  useEffect(() => {
    let cancelled = false;
    getHelveticaMeasure().then((m) => {
      if (!cancelled) setMeasure({ m });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!field) {
    return (
      <Box py="4" textAlign="center">
        <Text color="overlay0" fontSize="sm">
          Select a field to edit its properties, or draw a new field on the PDF.
        </Text>
      </Box>
    );
  }

  let overflowWarning = null;
  let autoFitNote = null;
  if (measure && field.field_type !== "checkbox") {
    const sample = previewValue || field.name || "";
    if (sample.trim()) {
      const layout = layoutTextField(field, sample, measure.m);
      const configured = field.font_size || 12;
      if (layout.hiddenLineCount > 0 || layout.overflowsWidth) {
        overflowWarning = `Text still overflows at ${layout.fontSize}pt — enlarge the box.`;
      } else if (layout.fontSize < configured) {
        autoFitNote = `Auto-fit: renders at ${layout.fontSize}pt to fit.`;
      }
    }
  }

  return (
    <VStack
      key={field.id}
      gap="3"
      align="stretch"
      className="anim-fade-slide-up"
      css={{ animationDuration: "0.15s" }}
    >
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
          onChange={(e) => onChange({ ...field, name: e.target.value })}
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
            onChange={(e) => onChange({ ...field, field_type: e.target.value })}
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
          onChange={(e) => onChange({ ...field, description: e.target.value })}
          placeholder="Optional description"
          rows={2}
          className="input-style"
        />
      </Field.Root>
      {field.field_type !== "checkbox" && (
        <Field.Root>
          <Field.Label fontSize="xs" mb="1">
            Preview Text
          </Field.Label>
          <Input
            size="sm"
            value={previewValue || ""}
            onChange={(e) => onPreviewValueChange(e.target.value)}
            placeholder={`Sample text for preview${field.name ? ` (defaults to "${field.name}")` : ""}`}
            className="input-style"
          />
        </Field.Root>
      )}
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
      {overflowWarning && (
        <Text fontSize="xs" color="dangerButton">
          ⚠ {overflowWarning}
        </Text>
      )}
      {autoFitNote && (
        <Text fontSize="xs" color="overlay0">
          {autoFitNote}
        </Text>
      )}
      <Checkbox.Root
        size="sm"
        onCheckedChange={({ checked }) => onChange({ ...field, required: checked })}
        checked={field.required}
      >
        <Checkbox.HiddenInput />
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        <Checkbox.Label>Required field</Checkbox.Label>
      </Checkbox.Root>
      <Box pt="2" borderTop="1px solid" borderColor="border">
        <Text fontSize="xs" color="overlay0">
          Position: ({field.x.toFixed(1)}, {field.y.toFixed(1)}) · Size:{" "}
          {field.width.toFixed(1)} × {field.height.toFixed(1)}
        </Text>
      </Box>
    </VStack>
  );
};

export default FieldEditor;
export { FIELD_COLORS };
