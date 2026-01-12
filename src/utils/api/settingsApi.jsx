import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

export const settingsApi = {
  fetchUserSettings: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/user");
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch user settings",
    }),

  fetchPrompts: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/prompts");
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch prompts",
    }),

  fetchDefaultPrompts: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/prompts/defaults");
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch default prompts",
    }),

  fetchConfig: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/global");
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch config",
    }),

  fetchOptions: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/ollama");
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch options",
    }),

  // New method to fetch models for any LLM provider
  fetchLLMModels: async (providerType, baseUrl, apiKey = null) => {
    const params = new URLSearchParams({
      provider: providerType,
      baseUrl: baseUrl,
    });

    if (apiKey) {
      params.append("apiKey", apiKey);
    }

    const endpoint = `/api/config/llm/models?${params.toString()}`;

    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(endpoint);
        return universalFetch(url);
      },
      errorMessage: `Failed to fetch ${providerType} models`,
    });
  },

  // Keep for backward compatibility
  fetchOllamaModels: async (ollamaBaseUrl) => {
    const endpoint = `/api/config/ollama/models?ollamaEndpoint=${encodeURIComponent(ollamaBaseUrl)}`;
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(endpoint);
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch models",
    });
  },

  fetchWhisperModels: async (whisperBaseUrl) => {
    if (!whisperBaseUrl) {
      return Promise.resolve({ models: [], listAvailable: false });
    }
    const endpoint = `/api/config/whisper/models?whisperEndpoint=${encodeURIComponent(whisperBaseUrl)}`;
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(endpoint);
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch models",
    });
  },

  savePrompts: async (prompts) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/prompts");
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prompts),
        });
      },
      errorMessage: "Failed to save prompts",
    }),

  saveConfig: async (config) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/global");
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });
      },
      errorMessage: "Failed to save config",
    }),

  saveOptions: async (category, options) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/config/ollama/${category}`);
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options),
        });
      },
      errorMessage: `Failed to save options for ${category}`,
    }),

  saveUserSettings: async (userSettings) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/user");
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...userSettings,
            default_letter_template_id:
              userSettings.default_letter_template_id || null,
          }),
        });
      },
      errorMessage: "Failed to save user settings",
    }),

  fetchTemplates: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/templates");
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch templates",
    }),

  saveTemplates: async (templates) =>
    handleApiRequest({
      apiCall: async () => {
        // Convert templates object to array
        const templatesArray = Object.values(templates).map((template) => ({
          template_key: template.template_key,
          template_name: template.template_name,
          fields: template.fields.map((field) => ({
            field_key: field.field_key,
            field_name: field.field_name,
            field_type: field.field_type,
            required: field.required,
            persistent: field.persistent,
            system_prompt: field.system_prompt,
            initial_prompt: field.initial_prompt,
            format_schema: field.format_schema,
            refinement_rules: field.refinement_rules,
          })),
        }));

        const url = await buildApiUrl("/api/templates");
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(templatesArray), // Send array directly
        });
      },
      errorMessage: "Failed to save templates",
    }),

  setDefaultTemplate: async (templateKey) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/templates/default/${templateKey}`);
        return universalFetch(url, {
          method: "POST",
        });
      },
      errorMessage: "Failed to set default template",
    }),

  getDefaultTemplate: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/templates/default");
        return universalFetch(url);
      },
      errorMessage: "Failed to get default template",
    }),

  saveLetterTemplateSetting: async (templateId) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(
          `/api/letter-templates/default/${templateId}`,
        );
        return universalFetch(url, {
          method: "POST",
        });
      },
      errorMessage: "Failed to set default letter template",
    }),

  resetToDefaults: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/reset-to-defaults");
        return universalFetch(url, {
          method: "POST",
        });
      },
      errorMessage: "Failed to restore defaults",
    }),

  clearDatabase: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/rag/clear-database");
        return universalFetch(url, {
          method: "POST",
        });
      },
      errorMessage: "Failed to clear RAG database",
    }),

  updateConfig: async (config) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/global");
        return universalFetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        });
      },
      errorMessage: "Failed to update config",
    }),
};
