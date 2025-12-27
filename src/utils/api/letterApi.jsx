import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

export const letterApi = {
  fetchLetterTemplates: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/letter/templates");
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch letter templates",
    }),

  getLetterTemplate: async (templateId) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/letter/templates/${templateId}`);
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch letter template",
    }),

  createLetterTemplate: async (template) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/letter/templates");
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(template),
        });
      },
      successMessage: "Letter template created successfully",
      errorMessage: "Failed to create letter template",
    }),

  updateLetterTemplate: async (templateId, template) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/letter/templates/${templateId}`);
        return universalFetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(template),
        });
      },
      successMessage: "Letter template updated successfully",
      errorMessage: "Failed to update letter template",
    }),

  deleteLetterTemplate: async (templateId) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/letter/templates/${templateId}`);
        return universalFetch(url, {
          method: "DELETE",
        });
      },
      successMessage: "Letter template deleted successfully",
      errorMessage: "Failed to delete letter template",
    }),

  resetLetterTemplates: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/letter/letter/templates/reset");
        return universalFetch(url, {
          method: "POST",
        });
      },
      successMessage: "Letter templates reset to defaults",
      errorMessage: "Failed to reset letter templates",
    }),

  generateLetter: async ({
    patientName,
    gender,
    dob,
    template_data,
    context,
    additional_instruction,
  }) => {
    console.log("Letter Generation Request:", {
      patientName,
      gender,
      dob,
      template_data,
      context,
      additional_instruction,
    });

    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/letter/generate");
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientName,
            gender,
            dob,
            template_data,
            additional_instruction,
            context,
          }),
        });
      },
      errorMessage: "Failed to generate letter",
    });
  },

  fetchLetter: async (patientId) => {
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(
          `/api/letter/fetch-letter?patientId=${patientId}`,
        );
        return universalFetch(url);
      },
    });
  },

  saveLetter: async (patientId, content) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/letter/save");
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientId, letter: content }),
        });
      },
    }),
};
