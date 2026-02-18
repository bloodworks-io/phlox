// API functions for handling landing page data and requests.
import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

export const landingApi = {
  fetchFeeds: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/dashboard/rss/list");
        return universalFetch(url);
      },
      errorMessage: "Error fetching feeds",
    }),

  fetchRssDigests: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/dashboard/rss/digest");
        return universalFetch(url);
      },
      errorMessage: "Error fetching RSS digests",
    }),

  refreshAllFeeds: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/dashboard/rss/refresh");
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feed_id: null }), // Explicitly send null for feed_id
        });
      },
      successMessage: "All feeds refreshed successfully",
      errorMessage: "Error refreshing all feeds",
    }),

  refreshSingleFeed: async (feedId) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/dashboard/rss/refresh");
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feed_id: feedId }),
        });
      },
      successMessage: "Feed refreshed successfully",
      errorMessage: "Error refreshing feed",
    }),

  fetchIncompleteJobs: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/patient/incomplete-jobs-count");
        return universalFetch(url);
      },
      errorMessage: "Error fetching incomplete tasks count",
    }),

  addTodo: async (task) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/dashboard/todos");
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task }),
        });
      },
      successMessage: "Todo added successfully",
      errorMessage: "Error adding todo",
    }),

  toggleTodo: async (id, completed, task) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/dashboard/todos/${id}`);
        return universalFetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task, completed: !completed }), // Include both task and completed fields
        });
      },
      successMessage: "Todo updated successfully",
      errorMessage: "Error updating todo",
    }),

  deleteTodo: async (id) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/dashboard/todos/${id}`);
        return universalFetch(url, { method: "DELETE" });
      },
      successMessage: "Todo deleted successfully",
      errorMessage: "Error deleting todo",
    }),

  addFeed: async (url) =>
    handleApiRequest({
      apiCall: async () => {
        const apiUrl = await buildApiUrl("/api/dashboard/rss/add");
        return universalFetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
      },
      successMessage: "Feed added successfully",
      errorMessage: "Error adding feed",
    }),

  removeFeed: async (feedId) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/dashboard/rss/remove/${feedId}`);
        return universalFetch(url, {
          method: "DELETE",
        });
      },
      successMessage: "Feed removed successfully",
      errorMessage: "Error removing feed",
    }),

  fetchRssItems: async (feeds) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/dashboard/rss/fetch");
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feeds }),
        });
      },
      errorMessage: "Error fetching RSS items",
    }),

  fetchAnalysis: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/dashboard/analysis/latest");
        return universalFetch(url);
      },
      errorMessage: "Error fetching analysis",
    }),

  refreshAnalysis: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/dashboard/analysis/generate");
        return universalFetch(url, { method: "POST" });
      },
      successMessage: "Analysis refreshed successfully",
      errorMessage: "Error refreshing analysis",
    }),

  fetchServerInfo: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/dashboard/server/info");
        return universalFetch(url);
      },
      errorMessage: "Error fetching server information",
    }),

  refreshRssDigests: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/dashboard/rss/digest/refresh");
        return universalFetch(url, { method: "POST" });
      },
      successMessage: "News digest refreshed successfully",
      errorMessage: "Error refreshing digest",
    }),
};
