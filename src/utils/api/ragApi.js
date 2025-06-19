// API functions for RAG related operations.
import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

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
};
