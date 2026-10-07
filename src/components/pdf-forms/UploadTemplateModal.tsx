// Modal for uploading a new PDF form template.
import React, { useState, useRef } from "react";
import { Input, Text, VStack, Box, Dialog, Portal } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { pdfFormsApi } from "../../utils/api/pdfFormsApi";
import { loadPdfDocument } from "../../utils/helpers/pdfVisionHelpers";
import { GreenButton, GreyButton } from "../common/Buttons";
import { useTranslation } from "react-i18next";
import type { FormTemplate } from "./types";

interface UploadTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (template: FormTemplate) => void;
}

const UploadTemplateModal = ({ isOpen, onClose, onCreated }: UploadTemplateModalProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && !selected.name.toLowerCase().endsWith(".pdf")) {
      toaster.create({
        title: t("forms.invalidFile"),
        description: t("forms.selectPdfFile"),
        type: "error",
        duration: 2000,
      });
      return;
    }
    setFile(selected || null);
    if (!name && selected) {
      setName(selected.name.replace(/\.pdf$/i, ""));
    }
  };

  const handleSubmit = async () => {
    if (!file || !name.trim()) return;

    setUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await loadPdfDocument({ data: arrayBuffer });

      const pageCount = pdf.numPages;
      const pageHeights = [];

      for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1 });
        pageHeights.push(viewport.height);
      }

      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("pdf", file);
      formData.append("page_count", String(pageCount));
      formData.append("page_heights", JSON.stringify(pageHeights));

      const template = await pdfFormsApi.uploadTemplate(formData);
      toaster.create({
        title: t("forms.templateCreated"),
        description: t("forms.templateUploaded", {
          name: name,
          count: pageCount,
        }),
        type: "success",
        duration: 2000,
      });
      onCreated(template);
      handleClose();
    } catch (error) {
      toaster.create({
        title: t("forms.uploadFailed"),
        description: error.message,
        type: "error",
        duration: 3000,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setName("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
              <Text as="h3">{t("forms.newFormTemplate")}</Text>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap="4">
                <Box w="100%">
                  <Text fontSize="sm" fontWeight="bold" mb="2">
                    {t("forms.templateName")}
                  </Text>
                  <Input
                    placeholder={t("forms.templateNamePlaceholder")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-style"
                  />
                </Box>
                <Box w="100%">
                  <Text fontSize="sm" fontWeight="bold" mb="2">
                    {t("forms.pdfFile")}
                  </Text>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    style={{ display: "block", width: "100%", fontSize: "0.875rem" }}
                  />
                </Box>
                <Text fontSize="xs" color="overlay0">
                  {t("forms.pageMetadataNote")}
                </Text>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <GreyButton mr="3" onClick={handleClose}>
                {t("action.cancel")}
              </GreyButton>
              <GreenButton
                onClick={handleSubmit}
                loading={uploading}
                disabled={!file || !name.trim()}
              >
                {t("forms.upload")}
              </GreenButton>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>

      </Portal>
    </Dialog.Root>
  );
};

export default UploadTemplateModal;
