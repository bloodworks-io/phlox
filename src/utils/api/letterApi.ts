import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";
import { t } from "@/i18n";

export interface LetterTemplate {
  id?: number;
  name: string;
  instructions: string;
  created_at?: string | null;
}

export interface LetterTemplatesResponse {
  templates: LetterTemplate[];
  default_template_id: number | null;
}

export interface LetterMessage {
  role: "assistant" | "user" | "system";
  content: string;
}

export interface GenerateLetterParams {
  patientName: string;
  gender: string;
  dob: string;
  template_data: Record<string, unknown>;
  additional_instruction?: string | null;
  context?: LetterMessage[] | null;
}

export interface GenerateLetterResponse {
  letter: string;
  context: LetterMessage[] | null;
}

export interface FetchLetterResponse {
  letter: string | null;
}

export const letterApi = {
  fetchLetterTemplates: async (): Promise<LetterTemplatesResponse> =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/letter/templates");
        return universalFetch(url);
      },
      errorMessage: t("settings.letterTemplates.fetchFailed"),
    }),

  getLetterTemplate: async (templateId: number): Promise<LetterTemplate> =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/letter/templates/${templateId}`);
        return universalFetch(url);
      },
      errorMessage: t("api.letters.fetchTemplateFailed"),
    }),

  createLetterTemplate: async (template: LetterTemplate) =>
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

  updateLetterTemplate: async (templateId: number, template: LetterTemplate) =>
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

  deleteLetterTemplate: async (templateId: number) =>
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
  }: GenerateLetterParams): Promise<GenerateLetterResponse> => {
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

  fetchLetter: async (noteId: number): Promise<FetchLetterResponse> => {
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(
          `/api/letter/fetch-letter?noteId=${noteId}`,
        );
        return universalFetch(url);
      },
      errorMessage: t("letter.toast.loadFailed"),
    });
  },

  saveLetter: async (noteId: number, content: string) =>
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
