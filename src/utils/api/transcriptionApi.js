import { handleApiRequest } from "../helpers/apiHelpers";

export const transcriptionApi = {
    transcribeAudio: async (formData) => {
        return handleApiRequest({
            apiCall: () =>
                fetch(`/api/transcribe/audio`, {
                    method: "POST",
                    body: formData,
                }),
            errorMessage: "Error transcribing audio",
        });
    },

    reprocessTranscription: async (formData) => {
        return handleApiRequest({
            apiCall: () =>
                fetch(`/api/transcribe/reprocess`, {
                    method: "POST",
                    body: formData,
                }),
            errorMessage: "Error reprocessing transcription",
        });
    },

    transcribeDictation: async (formData) => {
        return handleApiRequest({
            apiCall: () =>
                fetch(`/api/transcribe/dictate`, {
                    method: "POST",
                    body: formData,
                }),
            errorMessage: "Error transcribing dictation",
        });
    },

    processDocument: async (formData) => {
        return handleApiRequest({
            apiCall: () =>
                fetch(`/api/transcribe/process-document`, {
                    method: "POST",
                    body: formData,
                }),
            errorMessage: "Error processing document",
        });
    },
};
