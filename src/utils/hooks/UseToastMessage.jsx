// Custom hook for managing toast notifications.
import { useCallback, useMemo } from "react";
import { toaster } from "@/components/ui/toaster";
import { DEFAULT_TOAST_CONFIG } from "../constants";

export const useToastMessage = () => {

    const showSuccessToast = useCallback(
        (message) => {
            toaster.create({
                title: "Success",
                description: message,
                type: "success",
                ...DEFAULT_TOAST_CONFIG,
            });
        },
        [],
    );

    const showErrorToast = useCallback(
        (message) => {
            toaster.create({
                title: "Error",
                description: message,
                type: "error",
                ...DEFAULT_TOAST_CONFIG,
            });
        },
        [],
    );

    const showWarningToast = useCallback(
        (message) => {
            toaster.create({
                title: "Warning",
                description: message,
                type: "warning",
                ...DEFAULT_TOAST_CONFIG,
            });
        },
        [],
    );

    return useMemo(
        () => ({ showSuccessToast, showErrorToast, showWarningToast }),
        [showSuccessToast, showErrorToast, showWarningToast],
    );
};
