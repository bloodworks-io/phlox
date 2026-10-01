// API functions for RAG related operations.
import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";
import { t } from "@/i18n";

async function* streamPostSSE(url) {
    const response = await universalFetch(url, { method: "POST" });
    if (!response.ok) {
        throw new Error(t("api.error.httpStatus", { status: response.status }) as string);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");

        for (const line of lines) {
            if (line.trim() && line.startsWith("data: ")) {
                try {
                    const data = JSON.parse(line.slice(6));
                    yield data;
                } catch (error) {
                    console.error("Error parsing SSE chunk:", error, line);
                }
            }
        }
    }
}

export const ragApi = {
    fetchCollections: async () => {
        return handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl("/api/rag/files");
                return universalFetch(url);
            },
            errorMessage: t("api.rag.fetchCollectionsFailed"),
        });
    },

    fetchCollectionFiles: async (collectionName) => {
        return handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl(
                    `/api/rag/collection_files/${collectionName}`,
                );
                return universalFetch(url);
            },
            errorMessage: t("api.rag.loadFilesFailed", { name: collectionName }),
        });
    },

    renameCollection: async (oldName, newName) => {
        return handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl("/api/rag/modify");
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        old_name: oldName,
                        new_name: newName,
                    }),
                });
            },
            successMessage: t("api.rag.renameToast", { name: newName }),
            errorMessage: t("rag.toast.failedToRename"),
        });
    },

    deleteCollection: async (collectionName) => {
        return handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl(
                    `/api/rag/delete-collection/${collectionName}`,
                );
                return universalFetch(url, {
                    method: "DELETE",
                });
            },
            successMessage: t("api.rag.deleteToast", { name: collectionName }),
            errorMessage: t("api.rag.deleteCollectionFailed"),
        });
    },

    deleteFile: async (collectionName, fileName) => {
        return handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl("/api/rag/delete-file");
                return universalFetch(url, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        collection_name: collectionName,
                        file_name: fileName,
                    }),
                });
            },
            successMessage: t("api.rag.deleteToast", { name: fileName }),
            errorMessage: t("api.rag.deleteFileFailed"),
        });
    },

    updateDocumentMetadata: async (data) => {
        return handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl(
                    "/api/rag/update-document-metadata",
                );
                return universalFetch(url, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                });
            },
            successMessage: t("api.rag.documentUpdatedToast"),
            errorMessage: t("rag.toast.failedToUpdateDocument"),
        });
    },

    extractPdfInfo: async (formData) => {
        return handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl("/api/rag/extract-pdf-info");
                return universalFetch(url, {
                    method: "POST",
                    body: formData,
                });
            },
            errorMessage: t("rag.toast.failedToExtract"),
        });
    },

    extractPdfInfoFromText: async (payload) => {
        return handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl(
                    "/api/rag/extract-pdf-info-from-text",
                );
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            },
            errorMessage: t("api.rag.extractPdfInfoFromTextFailed"),
        });
    },

    commitToDatabase: async (data) => {
        return handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl("/api/rag/commit-to-vectordb");
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                });
            },
            successMessage: t("api.rag.commitSuccess"),
            errorMessage: t("api.rag.commitFailed"),
        });
    },

    commitDirect: async (data) => {
        return handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl("/api/rag/commit-direct");
                return universalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                });
            },
            errorMessage: t("api.rag.commitFailed"),
        });
    },

    downloadPdf: async (collectionName, filename) => {
        const url = await buildApiUrl(
            `/api/rag/download-pdf/${collectionName}/${encodeURIComponent(filename)}`,
        );
        const response = await universalFetch(url);
        if (!response.ok) {
            throw new Error(t("api.rag.downloadPdfFailed", { status: response.statusText }) as string);
        }
        return response.blob();
    },

    reEmbed: async () => {
        return handleApiRequest({
            apiCall: async () => {
                const url = await buildApiUrl("/api/rag/re-embed");
                return universalFetch(url, {
                    method: "POST",
                });
            },
            errorMessage: t("api.rag.reEmbedFailed"),
        });
    },

    streamReEmbed: async function* () {
        const baseUrl = await buildApiUrl("");
        const url = `${baseUrl}/api/rag/re-embed/stream`;
        yield* streamPostSSE(url);
    },
};
