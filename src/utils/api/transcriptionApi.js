import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

export const transcriptionApi = {
  transcribeAudio: async (formData) => {
    return handleApiRequest({
      apiCall: async (signal) => {
        const url = await buildApiUrl(`/api/transcribe/audio`);
        return universalFetch(url, {
          method: "POST",
          body: formData,
          signal: signal,
        });
      },
      errorMessage: "Error transcribing audio",
    });
  },

  reprocessTranscription: async (formData) => {
    return handleApiRequest({
      apiCall: async (signal) => {
        const url = await buildApiUrl(`/api/transcribe/reprocess`);
        return universalFetch(url, {
          method: "POST",
          body: formData,
          signal: signal,
        });
      },
      timeout: 45000, // 45 seconds for reprocessing
      errorMessage: "Error reprocessing transcription",
    });
  },

  transcribeDictation: async (formData) => {
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/transcribe/dictate`);
        return universalFetch(url, {
          method: "POST",
          body: formData,
        });
      },
      errorMessage: "Error transcribing dictation",
    });
  },

  processDocument: async (formData) => {
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/transcribe/process-document`);
        return universalFetch(url, {
          method: "POST",
          body: formData,
        });
      },
      errorMessage: "Error processing document",
    });
  },
};
