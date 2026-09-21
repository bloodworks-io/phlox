// Helper functions for settings component
import { toaster } from "@/components/ui/toaster";
export const settingsHelpers = {
  processOptionsData: (data) => ({
    letter: {
      temperature: data?.letter?.temperature || 0,
    },
  }),

  showSuccessToast: (toast, message) => {
    if (toast) {
      toaster.create({
        title: "Success",
        description: message,
        type: "success",
        duration: 3000,
      });
    }
  },

  showErrorToast: (toast, message) => {
    if (toast) {
      toaster.create({
        title: "Error",
        description: message,
        type: "error",
        duration: 3000,
      });
    }
  },

  ensureTemplatesArray: (templates) => {
    if (Array.isArray(templates)) return templates;
    if (typeof templates === "object") return Object.values(templates);
    return [];
  },
};
