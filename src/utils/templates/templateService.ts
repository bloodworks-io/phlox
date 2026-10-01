import { buildApiUrl } from "../helpers/apiConfig";
import { universalFetch } from "../helpers/apiHelpers";
import {
    DEFAULT_TEMPLATE_KEYS,
    getTemplateFamilyBase,
    getForkBase,
    isCustomizedDefault,
    isDefaultTemplate,
} from "./templateFamily";

// Re-exports kept for existing consumers; the implementations live in
// templateFamily.js, the canonical family/version logic.
export {
    DEFAULT_TEMPLATE_KEYS,
    getTemplateFamilyBase,
    getForkBase,
    isCustomizedDefault,
    isDefaultTemplate,
};

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

    getDefaultTemplate: async () => {
        try {
            const response = await universalFetch(
                await buildApiUrl("/api/templates/default"),
            );
            if (!response.ok) {
                throw new Error("Failed to fetch default template");
            }
            return await response.json();
        } catch (error) {
            console.error("Failed to get default template:", error);
            throw error;
        }
    },

    async getTemplateByKey(templateKey, { includeDeleted = false } = {}) {
        try {
            const query = includeDeleted ? "?include_deleted=true" : "";
            const response = await universalFetch(
                await buildApiUrl(`/api/templates/${templateKey}${query}`),
            );
            if (!response.ok) {
                throw new Error("Failed to fetch template");
            }
            return await response.json();
        } catch (error) {
            console.error(`Failed to fetch template ${templateKey}:`, error);
            throw error;
        }
    },

    isDefaultTemplate,

    // Delete a template
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
                    errorData.message ||
                        `Failed to delete template: ${response.status}`,
                );
            }

            return true;
        } catch (error) {
            console.error(`Failed to delete template ${templateKey}:`, error);
            throw error;
        }
    },
};
