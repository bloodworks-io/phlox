// API functions for PDF form template operations.
import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

export const pdfFormsApi = {
  fetchTemplates: async () => {
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/pdf-forms/templates");
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch form templates",
    });
  },

  fetchTemplate: async (id) => {
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/pdf-forms/templates/${id}`);
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch template",
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
      errorMessage: "Failed to upload template",
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
      successMessage: "Template deleted",
      errorMessage: "Failed to delete template",
    });
  },

  fetchTemplatePdf: async (id) => {
    const url = await buildApiUrl(`/api/pdf-forms/templates/${id}/pdf`);
    const response = await universalFetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
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
      successMessage: "Fields saved",
      errorMessage: "Failed to save fields",
    });
  },

  detectFields: async (id, pages) => {
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/pdf-forms/templates/${id}/detect-fields`);
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pages }),
        });
      },
      errorMessage: "Failed to detect fields",
    });
  },
};
