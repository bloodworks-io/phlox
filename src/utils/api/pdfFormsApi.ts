// API functions for PDF form template operations.
import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";
import { t } from "@/i18n";

export const pdfFormsApi = {
  fetchTemplates: async () => {
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/pdf-forms/templates");
        return universalFetch(url);
      },
      errorMessage: t("api.pdfForms.fetchTemplatesFailed"),
    });
  },

  fetchTemplate: async (id) => {
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/pdf-forms/templates/${id}`);
        return universalFetch(url);
      },
      errorMessage: t("api.pdfForms.fetchTemplateFailed"),
    });
  },

  uploadTemplate: async (formData) => {
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/pdf-forms/templates");
        return universalFetch(url, {
          method: "POST",
          body: formData,
        });
      },
      errorMessage: t("api.pdfForms.uploadFailed"),
    });
  },

  replaceTemplatePdf: async (id, formData) => {
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/pdf-forms/templates/${id}/pdf`);
        return universalFetch(url, {
          method: "PUT",
          body: formData,
        });
      },
      successMessage: t("forms.pdfReplaced"),
      errorMessage: t("api.pdfForms.replacePdfFailed"),
    });
  },

  deleteTemplate: async (id) => {
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/pdf-forms/templates/${id}`);
        return universalFetch(url, {
          method: "DELETE",
        });
      },
      successMessage: t("api.pdfForms.deletedToast"),
      errorMessage: t("settings.templates.deleteFailed"),
    });
  },

  fetchTemplatePdf: async (id) => {
    const url = await buildApiUrl(`/api/pdf-forms/templates/${id}/pdf`);
    const response = await universalFetch(url);
    if (!response.ok) {
      throw new Error(t("api.pdfForms.fetchPdfFailed", { status: response.statusText }) as string);
    }
    return response.arrayBuffer();
  },

  saveFields: async (id, fields) => {
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/pdf-forms/templates/${id}/fields`);
        return universalFetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields }),
        });
      },
      successMessage: t("api.pdfForms.fieldsSavedToast"),
      errorMessage: t("api.pdfForms.saveFieldsFailed"),
    });
  },

  detectFields: async (id, pages) => {
    return handleApiRequest({
      apiCall: async (signal) => {
        const url = await buildApiUrl(`/api/pdf-forms/templates/${id}/detect-fields`);
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pages }),
          signal,
        });
      },
      timeout: 240000,
      errorMessage: t("api.pdfForms.detectFieldsFailed"),
    });
  },
};
