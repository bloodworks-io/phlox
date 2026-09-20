import { settingsApi } from "../api/settingsApi";
import { settingsHelpers } from "../helpers/settingsHelpers";
import { buildApiUrl } from "../helpers/apiConfig";
import { universalFetch } from "../helpers/apiHelpers";
const templateCache = new Map();

export const DEFAULT_TEMPLATE_KEYS = ["phlox_", "soap_", "progress_", "consult_", "procedure_"];

export const isDefaultTemplate = (templateKey) =>
    DEFAULT_TEMPLATE_KEYS.some((prefix) => templateKey.startsWith(prefix));

export const getTemplateFamilyBase = (templateKey) => {
    if (!templateKey) return "";
    const parts = templateKey.split("_");
    if (parts[0] === "custom" && parts.length >= 3) {
        const second = parts[1];
        const rest = parts.slice(2).join("_");
        if (rest && /^\d+$/.test(rest) && isDefaultTemplate(`${second}_x`)) {
            return second;
        }
    }
    return parts[0];
};

export const isCustomizedDefault = (templateKey) =>
    templateKey?.startsWith("custom_") && isDefaultTemplate(`${getTemplateFamilyBase(templateKey)}_x`);

export const templateService = {
  fetchTemplates: async () => {
    try {
      const response = await universalFetch(
        await buildApiUrl("/api/templates"),
      );
      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }
      return await response.json();
    } catch (error) {
      console.error("Failed to fetch templates:", error);
      throw error;
    }
  },

  async getDefaultTemplate() {
    try {
      const response = await universalFetch(
        await buildApiUrl("/api/templates/default"),
      );
      if (!response.ok) {
        throw new Error("Failed to fetch default template");
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to get default template:", error);
      throw error;
    }
  },

  setDefaultTemplate: async (templateKey, toast) => {
    try {
      await settingsApi.setDefaultTemplate(templateKey);
      if (toast) {
        settingsHelpers.showSuccessToast(
          toast,
          "Default template updated successfully",
        );
      }
    } catch (error) {
      if (toast) {
        settingsHelpers.showErrorToast(toast, "Failed to set default template");
      }
      throw error;
    }
  },

  getCachedTemplate: (templateKey) => templateCache.get(templateKey) ?? null,

  async getTemplateByKey(templateKey) {
    // Check cache first
    if (templateCache.has(templateKey)) {
      return templateCache.get(templateKey);
    }

    try {
      const response = await universalFetch(
        await buildApiUrl(`/api/templates/${templateKey}`),
      );
      if (!response.ok) {
        throw new Error("Failed to fetch template");
      }
      const template = await response.json();

      // Cache the template
      templateCache.set(templateKey, template);

      return template;
    } catch (error) {
      console.error(`Failed to fetch template ${templateKey}:`, error);
      throw error;
    }
  },

  isDefaultTemplate,

  // Add a function to delete a template
  deleteTemplate: async (templateKey) => {
    try {
      const response = await universalFetch(
        await buildApiUrl(`/api/templates/${templateKey}`),
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Unknown error" }));
        throw new Error(
          errorData.message || `Failed to delete template: ${response.status}`,
        );
      }

      // Remove from cache if it exists
      if (templateCache.has(templateKey)) {
        templateCache.delete(templateKey);
      }

      return true;
    } catch (error) {
      console.error(`Failed to delete template ${templateKey}:`, error);
      throw error;
    }
  },
};
