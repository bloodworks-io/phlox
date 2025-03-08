import { handleApiRequest } from "../helpers/apiHelpers";

export const letterApi = {
    fetchLetterTemplates: () =>
        handleApiRequest({
            apiCall: () => fetch("/api/letter/templates"),
            errorMessage: "Failed to fetch letter templates",
        }),

    getLetterTemplate: (templateId) =>
        handleApiRequest({
            apiCall: () => fetch(`/api/letter/templates/${templateId}`),
            errorMessage: "Failed to fetch letter template",
        }),

    createLetterTemplate: (template) =>
        handleApiRequest({
            apiCall: () =>
                fetch("/api/letter/templates", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(template),
                }),
            successMessage: "Letter template created successfully",
            errorMessage: "Failed to create letter template",
        }),

    updateLetterTemplate: (templateId, template) =>
        handleApiRequest({
            apiCall: () =>
                fetch(`/api/letter/templates/${templateId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(template),
                }),
            successMessage: "Letter template updated successfully",
            errorMessage: "Failed to update letter template",
        }),

    deleteLetterTemplate: (templateId) =>
        handleApiRequest({
            apiCall: () =>
                fetch(`/api/letter/templates/${templateId}`, {
                    method: "DELETE",
                }),
            successMessage: "Letter template deleted successfully",
            errorMessage: "Failed to delete letter template",
        }),

    resetLetterTemplates: () =>
        handleApiRequest({
            apiCall: () =>
                fetch("/api/letter/letter/templates/reset", {
                    method: "POST",
                }),
            successMessage: "Letter templates reset to defaults",
            errorMessage: "Failed to reset letter templates",
        }),

    generateLetter: async ({
        patientName,
        gender,
        template_data,
        context,
        additional_instruction,
    }) => {
        console.log("Letter Generation Request:", {
            patientName,
            gender,
            template_data,
            context,
            additional_instruction,
        });

        return handleApiRequest({
            apiCall: () =>
                fetch("/api/letter/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        patientName,
                        gender,
                        template_data,
                        additional_instruction,
                        context,
                    }),
                }),
            errorMessage: "Failed to generate letter",
        });
    },

    fetchLetter: async (patientId) => {
        return handleApiRequest({
            apiCall: () =>
                fetch(`/api/letter/fetch-letter?patientId=${patientId}`),
        });
    },

    saveLetter: (patientId, content) =>
        handleApiRequest({
            apiCall: () =>
                fetch("/api/letter/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ patientId, letter: content }),
                }),
        }),
};
