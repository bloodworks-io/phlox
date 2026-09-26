// Custom hook for managing toast notifications.
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toaster } from "@/components/ui/toaster";
import { DEFAULT_TOAST_CONFIG } from "../constants";

export const useToastMessage = () => {
    const { t } = useTranslation();

    const showSuccessToast = useCallback(
        (message) => {
            toaster.create({
                title: t("toast.success"),
                description: message,
                type: "success",
                ...DEFAULT_TOAST_CONFIG,
            });
        },
        [t],
    );

    const showErrorToast = useCallback(
        (message) => {
            toaster.create({
                title: t("toast.error"),
                description: message,
                type: "error",
                ...DEFAULT_TOAST_CONFIG,
            });
        },
        [t],
    );

    const showWarningToast = useCallback(
        (message) => {
            toaster.create({
                title: t("toast.warning"),
                description: message,
                type: "warning",
                ...DEFAULT_TOAST_CONFIG,
            });
        },
        [t],
    );

    return useMemo(
        () => ({ showSuccessToast, showErrorToast, showWarningToast }),
        [showSuccessToast, showErrorToast, showWarningToast],
    );
};
