import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";
import { t } from "@/i18n";

export const letterApi = {
  fetchLetterTemplates: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/letter/templates");
        return universalFetch(url);
      },
      errorMessage: t("settings.letterTemplates.fetchFailed"),
    }),

  getLetterTemplate: async (templateId) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/letter/templates/${templateId}`);
        return universalFetch(url);
      },
      errorMessage: t("api.letters.fetchTemplateFailed"),
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
      successMessage: t("settings.letterTemplates.createdSuccessfully"),
      errorMessage: t("api.letters.createFailed"),
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
      successMessage: t("settings.letterTemplates.updatedSuccessfully"),
      errorMessage: t("api.letters.updateFailed"),
    }),

  deleteLetterTemplate: async (templateId) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/letter/templates/${templateId}`);
        return universalFetch(url, {
          method: "DELETE",
        });
      },
      successMessage: t("settings.letterTemplates.deletedSuccessfully"),
      errorMessage: t("settings.letterTemplates.deleteFailed"),
    }),

  resetLetterTemplates: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/letter/templates/reset");
        return universalFetch(url, {
          method: "POST",
        });
      },
      successMessage: t("api.letters.resetToast"),
      errorMessage: t("api.letters.resetFailed"),
    }),

  generateLetter: async ({
    patientName,
    gender,
    dob,
    template_data,
    context,
    additional_instruction,
  }) => {
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
      errorMessage: t("letter.toast.generateFailed"),
    });
  },

  fetchLetter: async (noteId) => {
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(
          `/api/letter/fetch-letter?noteId=${noteId}`,
        );
        return universalFetch(url);
      },
    });
  },

  saveLetter: async (noteId, content) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/letter/save");
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noteId, letter: content }),
        });
      },
    }),
};
