// Modal for filling a PDF form template and downloading the result.
import React, { useState, useRef, useEffect } from "react";
import { Input, Checkbox, VStack, Text, Box, Field, Dialog, Portal } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { pdfFormsApi } from "../../utils/api/pdfFormsApi";
import { fillPdf } from "../../utils/pdf/fillForm";
import { loadPdfDocument } from "../../utils/helpers/pdfVisionHelpers";
import { GreenButton, GreyButton } from "../common/Buttons";
import { FaRegEye } from "react-icons/fa";
import { useTranslation } from "react-i18next";

// Renders every page of a pdfjs document as stacked canvases.
const PdfPageStack = ({ doc }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    (async () => {
      for (let p = 1; p <= doc.numPages; p++) {
        if (cancelled) return;
        const page = await doc.getPage(p);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(1, (container.clientWidth || 480) / base.width);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.display = "block";
        canvas.style.margin = "0 auto 8px";
        container.appendChild(canvas);
        await page.render({
          canvasContext: canvas.getContext("2d"),
          viewport,
        }).promise;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc]);

  return <Box ref={containerRef} maxH="55vh" overflowY="auto" />;
};

const FillFormModal = ({ isOpen, onClose, template }) => {
  const { t } = useTranslation();
  const [values, setValues] = useState({});
  const [filling, setFilling] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  const fields = template?.fields || [];

  const handleChange = (fieldName, value) => {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const buildFilled = async () => {
    const pdfData = await pdfFormsApi.fetchTemplatePdf(template.id);
    return fillPdf(new Uint8Array(pdfData), template, values);
  };

  const handlePreview = async () => {
    if (!template) return;
    setPreviewing(true);
    try {
      const filledBytes = await buildFilled();
      const doc = await loadPdfDocument({ data: filledBytes.slice() });
      setPreviewDoc(doc);
    } catch (error) {
      toaster.create({
        title: t("toast.error"),
        description: t("forms.failedToPreview", { message: error.message }),
        type: "error",
        duration: 3000,
      });
    } finally {
      setPreviewing(false);
    }
  };

  const handleFill = async () => {
    if (!template) return;

    setFilling(true);
    try {
      const filledBytes = await buildFilled();

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
        title: t("forms.formFilled"),
        description: t("forms.pdfDownloaded"),
        type: "success",
        duration: 2000,
      });
      handleClose();
    } catch (error) {
      toaster.create({
        title: t("toast.error"),
        description: t("forms.failedToFill", { message: error.message }),
        type: "error",
        duration: 3000,
      });
    } finally {
      setFilling(false);
    }
  };

  const handleClose = () => {
    setValues({});
    setPreviewDoc(null);
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
              <Text as="h3">{t("forms.fillTitle", { name: template?.name })}</Text>
            </Dialog.Header>
            <Dialog.Body>
              {previewDoc ? (
                <PdfPageStack doc={previewDoc} />
              ) : fields.length === 0 ? (
                <Text color="overlay0" fontSize="sm">
                  {t("forms.noFieldsDefined")}
                </Text>
              ) : (
                <VStack gap="3" align="stretch">
                  {fields.map((field) => (
                    <Field.Root key={field.id}>
                      <Field.Label fontSize="sm" mb="1">
                        {field.name || t("forms.fieldWithType", { type: field.field_type })}
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
                            {field.description || t("forms.checkToEnable")}
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
                {t("action.cancel")}
              </GreyButton>
              {previewDoc ? (
                <GreyButton
                  mr="3"
                  onClick={() => setPreviewDoc(null)}
                >
                  {t("forms.backToEdit")}
                </GreyButton>
              ) : (
                <GreyButton
                  mr="3"
                  leftIcon={<FaRegEye />}
                  onClick={handlePreview}
                  loading={previewing}
                  disabled={fields.length === 0}
                >
                  {t("forms.preview")}
                </GreyButton>
              )}
              <GreenButton
                onClick={handleFill}
                loading={filling}
                disabled={fields.length === 0}
              >
                {t("forms.fillAndDownload")}
              </GreenButton>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>

      </Portal>
    </Dialog.Root>
  );
};

export default FillFormModal;
