// Modal for uploading a new PDF form template.
import React, { useState, useRef } from "react";
import { Input, Text, VStack, Box, Dialog, Portal } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { pdfFormsApi } from "../../utils/api/pdfFormsApi";
import { getPdfJs } from "../../utils/helpers/pdfVisionHelpers";
import { GreenButton, GreyButton } from "../common/Buttons";

const UploadTemplateModal = ({ isOpen, onClose, onCreated }) => {
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

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
    if (!name && selected) {
      setName(selected.name.replace(/\.pdf$/i, ""));
    }
  };

  const handleSubmit = async () => {
    if (!file || !name.trim()) return;

    setUploading(true);
    try {
      const pdfjsLib = await getPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

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
        title: "Template created",
        description: `"${name}" uploaded (${pageCount} page${pageCount !== 1 ? "s" : ""})`,
        type: "success",
        duration: 2000,
      });
      onCreated(template);
      handleClose();
    } catch (error) {
      toaster.create({
        title: "Upload failed",
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
              <Text as="h3">New Form Template</Text>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap="4">
                <Box w="100%">
                  <Text fontSize="sm" fontWeight="bold" mb="2">
                    Template Name
                  </Text>
                  <Input
                    placeholder="e.g. Referral Form"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-style"
                  />
                </Box>
                <Box w="100%">
                  <Text fontSize="sm" fontWeight="bold" mb="2">
                    PDF File
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
                  Page metadata will be extracted automatically by the browser.
                </Text>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <GreyButton mr="3" onClick={handleClose}>
                Cancel
              </GreyButton>
              <GreenButton
                onClick={handleSubmit}
                loading={uploading}
                disabled={!file || !name.trim()}
              >
                Upload
              </GreenButton>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>

      </Portal>
    </Dialog.Root>
  );
};

export default UploadTemplateModal;
