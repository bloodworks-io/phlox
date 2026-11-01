// Panel component for the Form Templates tab — sidebar, builder canvas, and field editor.
import React, { useState, useEffect } from "react";
import { Box, Text, VStack, HStack, NativeSelect, Flex } from "@chakra-ui/react";
import { AddIcon } from "../common/icons";
import { LuEye, LuEyeOff, LuPencil, LuSave, LuWandSparkles } from "react-icons/lu";
import { PrimaryButton, SecondaryButton, SuccessButton } from "../common/Buttons";
import FormTemplateList from "./FormTemplateList";
import FormBuilder from "./FormBuilder";
import FieldEditor from "./FieldEditor";
import FieldList from "./FieldList";
import { useTranslation } from "react-i18next";
import type { FieldType, FormField, FormTemplate } from "./types";

interface FormTemplatesPanelProps {
  templates: FormTemplate[];
  templatesLoading: boolean;
  selectedTemplate: FormTemplate | null;
  fields: FormField[];
  selectedField: FormField | null;
  selectedFieldId: string | null;
  saving: boolean;
  isDrawingMode: boolean;
  activeFieldType: FieldType;
  visionCapable: boolean;
  detecting: boolean;
  onSetDrawingMode: (drawing: boolean) => void;
  onSetFieldType: (type: FieldType) => void;
  onAutoDetect: () => void;
  onOpenUpload: () => void;
  onReplaceTemplate: (template: FormTemplate) => void;
  onSelectTemplate: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
  onFieldsChange: (fields: FormField[]) => void;
  onSelectField: (id: string | null) => void;
  onUpdateField: (field: FormField) => void;
  onDeleteField: (id: string) => void;
  onSaveFields: () => void;
}

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
}: FormTemplatesPanelProps) => {
  const { t } = useTranslation();
  const [previewOn, setPreviewOn] = useState(false);
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1); // reset view when switching templates
  }, [selectedTemplate?.id]);

  return (
    <HStack gap="4" align="start">
      {/* Forms sidebar */}
      <Box
        w="240px"
        flexShrink={0}
        borderRadius="sm"
        className="rag-panel"
        p="2"
        maxH="calc(100vh - 200px)"
        overflowY="auto"
      >
        <Flex justify="space-between" align="center" mb="2">
          <Text as="h4" fontSize="sm">
            {t("forms.forms")}
          </Text>
          <SecondaryButton size="xs" leftIcon={<AddIcon />} onClick={onOpenUpload}>
            {t("forms.new")}
          </SecondaryButton>
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
          <Box
            key={selectedTemplate.id}
            className="anim-fade-scale"
            css={{ animationDuration: "0.2s" }}
          >
            <FormBuilder
              template={selectedTemplate}
              fields={fields}
              onFieldsChange={onFieldsChange}
              selectedFieldId={selectedFieldId}
              onSelectField={onSelectField}
              onUpdateField={onUpdateField}
              isDrawing={isDrawingMode}
              activeFieldType={activeFieldType}
              previewOn={previewOn}
              previewValues={previewValues}
              currentPage={currentPage}
              onCurrentPageChange={setCurrentPage}
            />
          </Box>
        ) : (
          <Box
            py="16"
            textAlign="center"
            border="1px dashed"
            borderColor="folio.line"
            borderRadius="sm"
          >
            <Text color="folio.muted" fontSize="sm">
              {t("forms.selectTemplateHint")}
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
        className="rag-panel"
      >
        {/* New field controls */}
        {selectedTemplate && (
          <Box
            mb="3"
            pb="2"
            borderBottom="1px solid"
            borderColor="folio.line"
          >
            {isDrawingMode ? (
              <VStack gap="2" align="stretch">
                <HStack gap="1">
                  <Box color="folio.info" fontSize="0.7em" asChild><LuPencil strokeWidth={1.6} /></Box>
                  <Text fontSize="xs" fontWeight="bold">
                    {t("forms.drawingMode")}
                  </Text>
                </HStack>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    value={activeFieldType}
                    onChange={(e) => onSetFieldType(e.target.value as FieldType)}
                    className="input-style">
                    <option value="text">{t("forms.fieldTypes.text")}</option>
                    <option value="checkbox">{t("forms.fieldTypes.checkbox")}</option>
                    <option value="date">{t("forms.fieldTypes.date")}</option>
                    <option value="number">{t("forms.fieldTypes.number")}</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <SecondaryButton
                  size="xs"
                  width="100%"
                  onClick={() => onSetDrawingMode(false)}
                >
                  {t("forms.done")}
                </SecondaryButton>
              </VStack>
            ) : (
              <VStack gap="2" align="stretch">
                <SecondaryButton
                  size="xs"
                  width="100%"
                  leftIcon={<AddIcon />}
                  onClick={() => onSetDrawingMode(true)}
                >
                  {t("forms.newField")}
                </SecondaryButton>
                {visionCapable && (
                  <SecondaryButton
                    size="xs"
                    width="100%"
                    leftIcon={<LuWandSparkles strokeWidth={1.6} />}
                    onClick={onAutoDetect}
                    loading={detecting}
                    loadingText={t("forms.detecting")}
                  >
                    {t("forms.autoDetect")}
                  </SecondaryButton>
                )}
                {(() => {
                  const PreviewButton = previewOn ? SuccessButton : SecondaryButton;
                  return (
                    <PreviewButton
                      size="xs"
                      width="100%"
                      leftIcon={previewOn ? <LuEyeOff strokeWidth={1.6} /> : <LuEye strokeWidth={1.6} />}
                      onClick={() => setPreviewOn(!previewOn)}
                    >
                      {previewOn ? t("forms.hidePreview") : t("forms.previewFill")}
                    </PreviewButton>
                  );
                })()}
              </VStack>
            )}
          </Box>
        )}

        <FieldEditor
          field={selectedField}
          onChange={onUpdateField}
          onDelete={onDeleteField}
          previewValue={
            selectedField ? previewValues[selectedField.id] ?? "" : ""
          }
          onPreviewValueChange={(value) => {
            if (selectedField) {
              setPreviewValues((prev) => ({
                ...prev,
                [selectedField.id]: value,
              }));
            }
          }}
        />

        {selectedTemplate && (
          <Box mt="3" pt="2" borderTop="1px solid" borderColor="folio.line">
            <Text fontSize="xs" fontWeight="bold" mb="1">
              {t("forms.fieldsCount", { number: fields.length })}
            </Text>
            <FieldList
              fields={fields}
              selectedFieldId={selectedFieldId}
              onSelectField={onSelectField}
              onDeleteField={onDeleteField}
              onJumpToPage={setCurrentPage}
            />
          </Box>
        )}

        {selectedTemplate && (
          <Box mt="3" pt="2" borderTop="1px solid" borderColor="folio.line">
            <PrimaryButton
              size="xs"
              width="100%"
              onClick={onSaveFields}
              loading={saving}
              loadingText={t("forms.saving")}
              leftIcon={saving ? null : <LuSave strokeWidth={1.6} />}
            >
              {saving ? t("forms.savingDots") : t("forms.saveFields")}
            </PrimaryButton>
          </Box>
        )}
      </Box>
    </HStack>
  );
};

export default FormTemplatesPanel;
