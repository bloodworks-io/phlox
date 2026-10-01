import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";
import { t } from "@/i18n";

export const templateApi = {
  fetchTemplates: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/templates");
        return universalFetch(url);
      },
      errorMessage: t("api.templates.fetchFailed"),
    }),

  getDefaultTemplate: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/templates/default");
        return universalFetch(url);
      },
      errorMessage: t("api.templates.fetchDefaultFailed"),
    }),

  getTemplateByKey: async (templateKey, { includeDeleted = false } = {}) =>
    handleApiRequest({
      apiCall: async () => {
        const query = includeDeleted ? "?include_deleted=true" : "";
        const url = await buildApiUrl(`/api/templates/${templateKey}${query}`);
        return universalFetch(url);
      },
      errorMessage: t("api.templates.fetchKeyFailed", { key: templateKey }),
    }),

  deleteTemplate: async (templateKey) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/templates/${templateKey}`);
        return universalFetch(url, {
          method: "DELETE",
        });
      },
      errorMessage: t("api.templates.deleteKeyFailed", { key: templateKey }),
    }),

  setDefaultTemplate: async (templateKey) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/templates/default/${templateKey}`);
        return universalFetch(url, {
          method: "POST",
        });
      },
      successMessage: t("api.templates.defaultUpdatedToast"),
      errorMessage: t("page.settings.toasts.defaultTemplateError"),
    }),

  saveTemplates: async (templates) =>
    handleApiRequest({
      apiCall: async () => {
        const templatesArray = Array.isArray(templates)
          ? templates
          : Object.values(templates);

        const url = await buildApiUrl("/api/templates");
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(templatesArray),
        });
      },
      successMessage: t("api.templates.savedToast"),
      errorMessage: t("api.templates.saveFailed"),
      transformResponse: (data) => ({
        message: data.message,
        details: data.details,
        updated_keys: data.updated_keys,
      }),
    }),

  generateTemplate: async (exampleNote) =>
    handleApiRequest({
      apiCall: async (signal) => {
        const url = await buildApiUrl("/api/templates/generate");
        return universalFetch(url, {
          signal,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ exampleNote }),
        });
      },
      errorMessage: t("api.templates.generateFailed"),
    }),
};
