// Hook for managing PDF form templates, fields, and auto-detection.
import { useState, useEffect } from "react";
import { useToast } from "@/utils/useToastShim";
import { pdfFormsApi } from "../api/pdfFormsApi";
import { chatApi } from "../api/chatApi";
import { renderRulerOverlay } from "../pdf/renderGridOverlay";

const VALID_FIELD_TYPES = ["text", "checkbox", "date", "number"];

export const usePdfForms = () => {
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [fields, setFields] = useState([]);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFillModal, setShowFillModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [activeFieldType, setActiveFieldType] = useState("text");
  const [visionCapable, setVisionCapable] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const toast = useToast();

  const selectedField = fields.find((f) => f.id === selectedFieldId);

  useEffect(() => {
    const fetchTemplates = async () => {
      setTemplatesLoading(true);
      try {
        const data = await pdfFormsApi.fetchTemplates();
        setTemplates(data);
      } catch (error) {
        toast({
          title: "Error",
          description: error.message,
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setTemplatesLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  // Check vision model capability on mount
  useEffect(() => {
    chatApi
      .getCurrentVisionCapability()
      .then((result) => setVisionCapable(Boolean(result?.vision_capable)))
      .catch(() => setVisionCapable(false));
  }, []);

  const handleTemplateCreated = (template) => {
    setTemplates((prev) => [template, ...prev]);
    setSelectedTemplate(template);
    setFields([]);
  };

  const handleTemplateSelected = async (id) => {
    try {
      const template = await pdfFormsApi.fetchTemplate(id);
      setSelectedTemplate(template);
      setFields(template.fields || []);
      setSelectedFieldId(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleTemplateDeleted = (id) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (selectedTemplate?.id === id) {
      setSelectedTemplate(null);
      setFields([]);
    }
  };

  const handleSaveFields = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    try {
      await pdfFormsApi.saveFields(selectedTemplate.id, fields);
      toast({
        title: "Saved",
        description: "Field definitions saved",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateField = (updatedField) => {
    setFields((prev) =>
      prev.map((f) => (f.id === updatedField.id ? updatedField : f))
    );
  };

  const handleDeleteField = (fieldId) => {
    setFields((prev) => prev.filter((f) => f.id !== fieldId));
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
  };

  const handleAutoDetectFields = async () => {
    if (!selectedTemplate) return;
    setDetecting(true);
    try {
      // 1. Fetch the PDF
      const pdfData = await pdfFormsApi.fetchTemplatePdf(selectedTemplate.id);

      // 2. Render pages to canvases with ruler overlay
      const pdfjsModule = await import("../helpers/pdfVisionHelpers").then(
        (m) => m.getPdfJs()
      );
      const pdfjsLib = await pdfjsModule;
      const loadingTask = pdfjsLib.getDocument({ data: pdfData });
      const doc = await loadingTask.promise;

      const rulerPages = [];
      for (let i = 1; i <= Math.min(doc.numPages, 6); i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 1.75 });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");

        await page.render({ canvasContext: ctx, viewport }).promise;
        const rulerDataUrl = renderRulerOverlay(canvas, { pageNumber: i });
        rulerPages.push({ page_number: i, data_url: rulerDataUrl });

        // Release memory
        canvas.width = 1;
        canvas.height = 1;
      }

      // 3. Send to server for VLM detection
      const result = await pdfFormsApi.detectFields(
        selectedTemplate.id,
        rulerPages
      );

      // 4. Convert percentages to PDF coordinates
      const pageHeights = selectedTemplate.page_heights || [];
      const detectedFields = (result.fields || []).map((f) => {
        const pageNum = Math.max(1, f.page_number || 1);
        const ph = pageHeights[pageNum - 1] || 792;
        const pw = ph * (8.5 / 11);

        // Sanitize field_type
        let fieldType = (f.field_type || "text").toLowerCase().trim();
        if (!VALID_FIELD_TYPES.includes(fieldType)) fieldType = "text";

        // Convert percentages to PDF points
        const x = ((f.x_pct || 0) / 100) * pw;
        const y = ph - (((f.y_pct || 0) + (f.height_pct || 5)) / 100) * ph; // PDF y is bottom-up
        const width = Math.max(1, ((f.width_pct || 10) / 100) * pw);
        const height = Math.max(1, ((f.height_pct || 5) / 100) * ph);

        return {
          id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: f.name || "",
          description: "",
          field_type: fieldType,
          required: false,
          page_number: pageNum,
          x,
          y,
          width,
          height,
          font_size: 12,
        };
      });

      // 5. Set fields
      setFields(detectedFields);
      if (detectedFields.length > 0) {
        setSelectedFieldId(detectedFields[0].id);
      }

      // 6. Auto-save (strip id — storage generates its own)
      const savePayload = detectedFields.map(({ id, ...rest }) => rest);
      await pdfFormsApi.saveFields(selectedTemplate.id, savePayload);
      toast({
        title: "Fields detected",
        description: `Found ${detectedFields.length} fields`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Detection failed",
        description: error.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setDetecting(false);
    }
  };

  return {
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
    showUploadModal,
    showFillModal,
    setShowUploadModal,
    setShowFillModal,
    setSelectedFieldId,
    setIsDrawingMode,
    setActiveFieldType,
    setFields,
    handleTemplateCreated,
    handleTemplateSelected,
    handleTemplateDeleted,
    handleSaveFields,
    handleUpdateField,
    handleDeleteField,
    handleAutoDetectFields,
  };
};
