import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";
import { t } from "@/i18n";

export const companionApi = {
    fetchStatus: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/companion/status");
                return universalFetch(url, { signal });
            },
            errorMessage: t("api.companion.fetchStatusFailed"),
        }),

    fetchSessions: async () =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl("/api/companion/sessions");
                return universalFetch(url, { signal });
            },
            errorMessage: t("api.companion.fetchSessionsFailed"),
        }),

    fetchDocument: async (sessionId) =>
        handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl(
                    `/api/companion/sessions/${sessionId}/document`,
                );
                return universalFetch(url, { signal });
            },
            errorMessage: t("api.companion.fetchDocumentFailed"),
        }),

    retrySession: async (sessionId) =>
        handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl(
                    `/api/companion/sessions/${sessionId}/retry`,
                );
                return universalFetch(url, { method: "POST" });
            },
            successMessage: t("api.companion.retrySuccess"),
            errorMessage: t("api.companion.retryFailed"),
        }),

    importBatch: async (sessionIds, { generate = false, templateKey } = {}) =>
        handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl(
                    "/api/companion/sessions/import-batch",
                );
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        session_ids: sessionIds,
                        generate,
                        template_key: templateKey ?? null,
                    }),
                });
            },
            errorMessage: t("api.companion.importBatchFailed"),
        }),

    triggerSync: async () =>
        handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl("/api/companion/sync/trigger");
                return universalFetch(url, { method: "POST" });
            },
            errorMessage: t("api.companion.triggerSyncFailed"),
        }),

    dismissSession: async (sessionId) =>
        handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl(
                    `/api/companion/sessions/${sessionId}`,
                );
                return universalFetch(url, { method: "DELETE" });
            },
            successMessage: t("api.companion.dismissSuccess"),
            errorMessage: t("api.companion.dismissFailed"),
        }),
};
