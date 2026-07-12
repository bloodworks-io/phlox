// Functions to handle and format API errors.
import { toaster } from "@/components/ui/toaster";
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
            title: `Error ${error.status}`,
            description: error.message,
            type: "error",
            ...DEFAULT_TOAST_CONFIG,
        });
    } else {
        toaster.create({
            title: "Error",
            description: "An unexpected error occurred",
            type: "error",
            ...DEFAULT_TOAST_CONFIG,
        });
    }
};
