// Functions to handle and format API errors.
import { toaster } from "@/components/ui/toaster";
import { t } from "@/i18n";
import { DEFAULT_TOAST_CONFIG } from "../constants";

export class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = "ApiError";
    }
}

export const handleError = (error) => {
    console.error("Error:", error);

    if (error instanceof ApiError) {
        toaster.create({
            title: t("error.withStatus", { status: error.status }),
            description: error.message,
            type: "error",
            ...DEFAULT_TOAST_CONFIG,
        });
    } else {
        toaster.create({
            title: t("toast.error"),
            description: t("error.unexpected"),
            type: "error",
            ...DEFAULT_TOAST_CONFIG,
        });
    }
};

export const toastApiError = (description, title) => {
    toaster.create({
        title: title ?? t("toast.error"),
        description,
        type: "error",
        ...DEFAULT_TOAST_CONFIG,
    });
};

export const toastApiSuccess = (description, title) => {
    toaster.create({
        title: title ?? t("toast.success"),
        description,
        type: "success",
        ...DEFAULT_TOAST_CONFIG,
    });
};

