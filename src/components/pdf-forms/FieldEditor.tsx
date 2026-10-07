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
import { layoutTextField, getHelveticaMeasure, type Measure } from "../../utils/pdf/fieldLayout";
import { useTranslation } from "react-i18next";
import type { FieldType, FormField } from "./types";

const FIELD_COLORS: Record<FieldType, string> = {
  text: "blue.400",
  checkbox: "green.400",
  date: "orange.400",
  number: "purple.400",
};

interface FieldEditorProps {
  field: FormField | null;
  onChange: (field: FormField) => void;
  onDelete: (id: string) => void;
  previewValue: string;
  onPreviewValueChange: (value: string) => void;
}

const FieldEditor = ({
  field,
  onChange,
  onDelete,
  previewValue,
  onPreviewValueChange,
}: FieldEditorProps) => {
  const { t } = useTranslation();
  // Helvetica metrics for the overflow warning (matches fillPdf exactly)
  const [measure, setMeasure] = useState<{ m: Measure } | null>(null);
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
          {t("forms.selectFieldHint")}
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
        overflowWarning = t("forms.overflowWarning", { fontSize: layout.fontSize });
      } else if (layout.fontSize < configured) {
        autoFitNote = t("forms.autoFitNote", { fontSize: layout.fontSize });
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
        <Text as="h4">{t("forms.fieldProperties")}</Text>
        <IconButton
          variant="ghost"
          size="sm"
          colorPalette="red"
          aria-label={t("forms.deleteField")}
          onClick={() => onDelete(field.id)}><DeleteIcon /></IconButton>
      </HStack>
      <Field.Root>
        <Field.Label fontSize="xs" mb="1">
          {t("forms.name")}
        </Field.Label>
        <Input
          size="sm"
          value={field.name}
          onChange={(e) => onChange({ ...field, name: e.target.value })}
          placeholder={t("forms.fieldNamePlaceholder")}
          className="input-style"
        />
      </Field.Root>
      <Field.Root>
        <Field.Label fontSize="xs" mb="1">
          {t("forms.type")}
        </Field.Label>
        <NativeSelect.Root>
          <NativeSelect.Field
            value={field.field_type}
            onChange={(e) =>
              onChange({ ...field, field_type: e.target.value as FieldType })
            }
            className="input-style">
            <option value="text">{t("forms.fieldTypes.text")}</option>
            <option value="checkbox">{t("forms.fieldTypes.checkbox")}</option>
            <option value="date">{t("forms.fieldTypes.date")}</option>
            <option value="number">{t("forms.fieldTypes.number")}</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Field.Root>
      <Field.Root>
        <Field.Label fontSize="xs" mb="1">
          {t("forms.description")}
        </Field.Label>
        <Textarea
          size="sm"
          value={field.description || ""}
          onChange={(e) => onChange({ ...field, description: e.target.value })}
          placeholder={t("forms.descriptionPlaceholder")}
          rows={2}
          className="input-style"
        />
      </Field.Root>
      {field.field_type !== "checkbox" && (
        <Field.Root>
          <Field.Label fontSize="xs" mb="1">
            {t("forms.previewText")}
          </Field.Label>
          <Input
            size="sm"
            value={previewValue || ""}
            onChange={(e) => onPreviewValueChange(e.target.value)}
            placeholder={field.name ? t("forms.sampleTextNamed", { name: field.name }) : t("forms.sampleText")}
            className="input-style"
          />
        </Field.Root>
      )}
      <HStack gap="3">
        <Field.Root>
          <Field.Label fontSize="xs" mb="1">
            {t("forms.fontSize")}
          </Field.Label>
          <NumberInput.Root
            size="sm"
            value={String(field.font_size || 12)}
            min={6}
            max={72}
            onValueChange={(details) =>
              onChange({ ...field, font_size: details.valueAsNumber || 12 })
            }
          >
            <NumberInput.Input className="input-style" />
          </NumberInput.Root>
        </Field.Root>

        <Field.Root>
          <Field.Label fontSize="xs" mb="1">
            {t("forms.page")}
          </Field.Label>
          <NumberInput.Root
            size="sm"
            value={String(field.page_number)}
            min={1}
            onValueChange={(details) =>
              onChange({ ...field, page_number: details.valueAsNumber || 1 })
            }
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
        onCheckedChange={({ checked }) =>
          onChange({ ...field, required: checked === true })
        }
        checked={field.required}
      >
        <Checkbox.HiddenInput />
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        <Checkbox.Label>{t("forms.requiredField")}</Checkbox.Label>
      </Checkbox.Root>
      <Box pt="2" borderTop="1px solid" borderColor="border">
        <Text fontSize="xs" color="overlay0">
          {t("forms.positionSize", {
            x: field.x.toFixed(1),
            y: field.y.toFixed(1),
            width: field.width.toFixed(1),
            height: field.height.toFixed(1),
          })}
        </Text>
      </Box>
    </VStack>
  );
};

export default FieldEditor;
export { FIELD_COLORS };
