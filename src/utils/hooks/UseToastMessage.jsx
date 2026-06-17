// Custom hook for managing toast notifications.
import { useCallback, useMemo } from "react";
import { useToast } from "@chakra-ui/react";
import { DEFAULT_TOAST_CONFIG } from "../constants";

export const useToastMessage = () => {
    const toast = useToast();

    const showSuccessToast = useCallback(
        (message) => {
            toast({
                title: "Success",
                description: message,
                status: "success",
                ...DEFAULT_TOAST_CONFIG,
            });
        },
        [toast],
    );

    const showErrorToast = useCallback(
        (message) => {
            toast({
                title: "Error",
                description: message,
                status: "error",
                ...DEFAULT_TOAST_CONFIG,
            });
        },
        [toast],
    );

    const showWarningToast = useCallback(
        (message) => {
            toast({
                title: "Warning",
                description: message,
                status: "warning",
                ...DEFAULT_TOAST_CONFIG,
            });
        },
        [toast],
    );

    return useMemo(
        () => ({ showSuccessToast, showErrorToast, showWarningToast }),
        [showSuccessToast, showErrorToast, showWarningToast],
    );
};
