// API functions for RAG related operations.
import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

async function* streamPostSSE(url) {
    const response = await universalFetch(url, { method: "POST" });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
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
            errorMessage: "Failed to fetch collections",
        });
    },

    fetchSuggestions: async () => {
        return handleApiRequest({
            apiCall: async (signal) => {
                const url = await buildApiUrl(`/api/rag/suggestions`);
                return universalFetch(url, { signal });
            },
            errorMessage: "Failed to fetch suggestions",
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
            errorMessage: `Error loading files for ${collectionName}`,
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
            successMessage: `Successfully renamed to ${newName}`,
            errorMessage: "Failed to rename collection",
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
            successMessage: `Successfully deleted ${collectionName}`,
            errorMessage: "Failed to delete collection",
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
            successMessage: `Successfully deleted ${fileName}`,
            errorMessage: "Failed to delete file",
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
            successMessage: "Document updated",
            errorMessage: "Failed to update document",
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
            errorMessage: "Failed to extract PDF information",
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
            errorMessage:
                "Failed to extract PDF information from extracted text",
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
            successMessage: "Successfully committed to database",
            errorMessage: "Failed to commit data to database",
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
            errorMessage: "Failed to commit data to database",
        });
    },

    downloadPdf: async (collectionName, filename) => {
        const url = await buildApiUrl(
            `/api/rag/download-pdf/${collectionName}/${encodeURIComponent(filename)}`,
        );
        const response = await universalFetch(url);
        if (!response.ok) {
            throw new Error(`Failed to download PDF: ${response.statusText}`);
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
            errorMessage: "Failed to re-embed documents",
        });
    },

    streamReEmbed: async function* () {
        const baseUrl = await buildApiUrl("");
        const url = `${baseUrl}/api/rag/re-embed/stream`;
        yield* streamPostSSE(url);
    },
};
