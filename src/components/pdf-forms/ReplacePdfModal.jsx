// Modal for replacing a template's PDF while keeping its field definitions.
import React, { useState, useRef } from "react";
import { Text, VStack, Box, Dialog, Portal } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { pdfFormsApi } from "../../utils/api/pdfFormsApi";
import { loadPdfDocument } from "../../utils/helpers/pdfVisionHelpers";
import { GreenButton, GreyButton } from "../common/Buttons";

const ReplacePdfModal = ({ isOpen, onClose, template, onReplaced }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const expectedPages = template?.page_count;
  const expectedHeights = template?.page_heights || [];

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected && !selected.name.toLowerCase().endsWith(".pdf")) {
      toaster.create({
        title: "Invalid file",
        description: "Please select a PDF file",
        type: "error",
        duration: 2000,
      });
      return;
    }
    setFile(selected || null);
  };

  const handleSubmit = async () => {
    if (!file || !template) return;

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

      if (pageCount !== expectedPages) {
        throw new Error(
          `Replacement must have ${expectedPages} page(s); got ${pageCount}.`,
        );
      }
      for (let i = 0; i < pageHeights.length; i++) {
        if (Math.abs(pageHeights[i] - expectedHeights[i]) > 0.5) {
          throw new Error(
            `Page ${i + 1} height differs from the original; fields would misalign.`,
          );
        }
      }

      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("page_count", String(pageCount));
      formData.append("page_heights", JSON.stringify(pageHeights));

      const updated = await pdfFormsApi.replaceTemplatePdf(
        template.id,
        formData,
      );
      toaster.create({
        title: "PDF replaced",
        description: "Field definitions kept",
        type: "success",
        duration: 2000,
      });
      onReplaced(updated);
      handleClose();
    } catch (error) {
      toaster.create({
        title: "Replace failed",
        description: error.message,
        type: "error",
        duration: 3000,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} size="md" onOpenChange={(e) => {
      if (!e.open) handleClose();
    }}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Text as="h3">Replace PDF</Text>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap="4">
                <Box w="100%">
                  <Text fontSize="sm" fontWeight="bold" mb="2">
                    New PDF for &ldquo;{template?.name}&rdquo;
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
                  Field definitions are kept. The new PDF must have{" "}
                  {expectedPages} page(s) with matching dimensions.
                </Text>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <GreyButton mr="3" onClick={handleClose}>
                Cancel
              </GreyButton>
              <GreenButton onClick={handleSubmit} loading={uploading} disabled={!file}>
                Replace
              </GreenButton>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

export default ReplacePdfModal;
