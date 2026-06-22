import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

export const templateApi = {
  fetchTemplates: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/templates");
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch templates",
    }),

  getDefaultTemplate: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/templates/default");
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch default template",
    }),

  getTemplateByKey: async (templateKey) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/templates/${templateKey}`);
        return universalFetch(url);
      },
      errorMessage: `Failed to fetch template: ${templateKey}`,
    }),

  setDefaultTemplate: async (templateKey) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/templates/default/${templateKey}`);
        return universalFetch(url, {
          method: "POST",
        });
      },
      successMessage: "Default template updated successfully",
      errorMessage: "Failed to set default template",
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
      successMessage: "Templates saved successfully",
      errorMessage: "Failed to save templates",
      transformResponse: (data) => ({
        message: data.message,
        details: data.details,
        updated_keys: data.updated_keys,
      }),
    }),
};
