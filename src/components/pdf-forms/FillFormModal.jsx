// Modal for filling a PDF form template and downloading the result.
import React, { useState } from "react";
import { Input, Checkbox, VStack, Text, Field, Dialog, Portal } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { pdfFormsApi } from "../../utils/api/pdfFormsApi";
import { fillPdf } from "../../utils/pdf/fillForm";
import { GreenButton, GreyButton } from "../common/Buttons";

const FillFormModal = ({ isOpen, onClose, template }) => {
  const [values, setValues] = useState({});
  const [filling, setFilling] = useState(false);

  const fields = template?.fields || [];

  const handleChange = (fieldName, value) => {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleFill = async () => {
    if (!template) return;

    setFilling(true);
    try {
      const pdfData = await pdfFormsApi.fetchTemplatePdf(template.id);
      const filledBytes = await fillPdf(
        new Uint8Array(pdfData),
        template,
        values
      );

      const blob = new Blob([filledBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${template.name || "form"}_filled.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toaster.create({
        title: "Form filled",
        description: "PDF downloaded successfully",
        type: "success",
        duration: 2000,
      });
      handleClose();
    } catch (error) {
      toaster.create({
        title: "Error",
        description: `Failed to fill form: ${error.message}`,
        type: "error",
        duration: 3000,
      });
    } finally {
      setFilling(false);
    }
  };

  const handleClose = () => {
    setValues({});
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} size='md' onOpenChange={e => {
      if (!e.open) {
        handleClose();
      }
    }}>
      <Portal>

        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Text as="h3">Fill: {template?.name}</Text>
            </Dialog.Header>
            <Dialog.Body>
              {fields.length === 0 ? (
                <Text color="overlay0" fontSize="sm">
                  This template has no fields defined yet.
                </Text>
              ) : (
                <VStack gap="3" align="stretch">
                  {fields.map((field) => (
                    <Field.Root key={field.id}>
                      <Field.Label fontSize="sm" mb="1">
                        {field.name || `Field (${field.field_type})`}
                        {field.required && (
                          <Text as="span" color="dangerButton" ml="1">
                            *
                          </Text>
                        )}
                      </Field.Label>
                      {field.field_type === "checkbox" ? (
                        <Checkbox.Root
                          onCheckedChange={(e) =>
                            handleChange(field.name, e.checked ? "true" : "")
                          }
                          checked={values[field.name] === "true"}
                        >
                          <Checkbox.HiddenInput />
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                          <Checkbox.Label>
                            {field.description || "Check to enable"}
                          </Checkbox.Label>
                        </Checkbox.Root>
                      ) : (
                        <Input
                          size="sm"
                          type={
                            field.field_type === "date"
                              ? "date"
                              : field.field_type === "number"
                                ? "number"
                                : "text"
                          }
                          value={values[field.name] || ""}
                          onChange={(e) => handleChange(field.name, e.target.value)}
                          placeholder={field.description || field.field_type}
                          className="input-style"
                        />
                      )}
                    </Field.Root>
                  ))}
                </VStack>
              )}
            </Dialog.Body>
            <Dialog.Footer>
              <GreyButton mr="3" onClick={handleClose}>
                Cancel
              </GreyButton>
              <GreenButton
                onClick={handleFill}
                loading={filling}
                disabled={fields.length === 0}
              >
                Fill & Download
              </GreenButton>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>

      </Portal>
    </Dialog.Root>
  );
};

export default FillFormModal;
