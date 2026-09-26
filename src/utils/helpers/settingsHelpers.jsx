// Helper functions for settings component
import { toaster } from "@/components/ui/toaster";
import { t } from "@/i18n";
export const settingsHelpers = {
  processOptionsData: (data) => ({
    letter: {
      temperature: data?.letter?.temperature || 0,
    },
  }),

  showSuccessToast: (toast, message) => {
    if (toast) {
      toaster.create({
        title: t("toast.success"),
        description: message,
        type: "success",
        duration: 3000,
      });
    }
  },

  showErrorToast: (toast, message) => {
    if (toast) {
      toaster.create({
        title: t("toast.error"),
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
