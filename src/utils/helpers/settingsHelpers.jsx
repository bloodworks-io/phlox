// Helper functions for settings component
export const settingsHelpers = {
    processOptionsData: (data) => ({
        general: {
            num_ctx: data?.general?.num_ctx || 0,
        },
        secondary: {
            num_ctx: data?.secondary?.num_ctx || 0,
        },
        letter: {
            temperature: data?.letter?.temperature || 0,
        },
        reasoning: {
            temperature: data?.reasoning?.temperature || 0,
            num_ctx: data?.reasoning?.num_ctx || 0,
        },
    }),

    showSuccessToast: (toast, message) => {
        if (toast) {
            toast({
                title: "Success",
                description: message,
                status: "success",
                duration: 3000,
                isClosable: true,
            });
        }
    },

    showErrorToast: (toast, message) => {
        if (toast) {
            toast({
                title: "Error",
                description: message,
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        }
    },

    ensureTemplatesArray: (templates) => {
        if (Array.isArray(templates)) return templates;
        if (typeof templates === "object") return Object.values(templates);
        return [];
    },
};
