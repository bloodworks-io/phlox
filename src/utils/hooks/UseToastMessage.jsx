// Custom hook for managing toast notifications.
import { useToast } from "@chakra-ui/react";
import { DEFAULT_TOAST_CONFIG } from "../constants";

export const useToastMessage = () => {
    const toast = useToast();

    const showSuccessToast = (message) => {
        toast({
            title: "Success",
            description: message,
            status: "success",
            ...DEFAULT_TOAST_CONFIG,
        });
    };

    const showErrorToast = (message) => {
        toast({
            title: "Error",
            description: message,
            status: "error",
            ...DEFAULT_TOAST_CONFIG,
        });
    };

    const showWarningToast = (message) => {
        toast({
            title: "Warning",
            description: message,
            status: "warning",
            ...DEFAULT_TOAST_CONFIG,
        });
    };

    return { showSuccessToast, showErrorToast, showWarningToast };
};
