import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

export const authApi = {
    fetchStatus: async () =>
        handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl("/api/auth/status");
                return universalFetch(url);
            },
            errorMessage: "Failed to check auth status",
        }),

    setup: async (username, password) =>
        handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl("/api/auth/setup");
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password }),
                });
            },
            errorMessage: "Setup failed",
        }),

    login: async (username, password) => {
        const url = await buildApiUrl("/api/auth/login");
        return universalFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });
    },

    logout: async () => {
        const url = await buildApiUrl("/api/auth/logout");
        return universalFetch(url, { method: "POST" }).catch(() => null);
    },

    fetchMe: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/auth/me");
                return universalFetch(url, { signal });
            },
            errorMessage: "Failed to fetch current user",
        }),

    fetchUsers: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/auth/users");
                return universalFetch(url, { signal });
            },
            errorMessage: "Failed to fetch users",
        }),

    createUser: async (username, password, role) =>
        handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl("/api/auth/users");
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password, role }),
                });
            },
            successMessage: "User created",
            toast: true,
        }),

    resetPassword: async (userId, password) =>
        handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl(`/api/auth/users/${userId}/password`);
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ password }),
                });
            },
            successMessage: "Password reset",
            toast: true,
        }),

    setDisabled: async (userId, disabled) =>
        handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl(`/api/auth/users/${userId}/disable`);
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ disabled }),
                });
            },
            successMessage: disabled ? "User disabled" : "User enabled",
            toast: true,
        }),
};
