// Functions to handle and format API errors.
import { DEFAULT_TOAST_CONFIG } from "../constants";

export class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = "ApiError";
    }
}

export const handleError = (error, toast) => {
    console.error("Error:", error);

    if (error instanceof ApiError) {
        toast({
            title: `Error ${error.status}`,
            description: error.message,
            status: "error",
            ...DEFAULT_TOAST_CONFIG,
        });
    } else {
        toast({
            title: "Error",
            description: "An unexpected error occurred",
            status: "error",
            ...DEFAULT_TOAST_CONFIG,
        });
    }
};
