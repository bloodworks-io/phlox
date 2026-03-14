import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

export const toolsApi = {
  fetchToolServers: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/mcp");
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch tool servers",
    }),

  fetchEnabledToolServers: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/mcp/enabled");
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch enabled tool servers",
    }),

  addToolServer: async (server) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/mcp");
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(server),
        });
      },
      errorMessage: "Failed to add tool server",
    }),

  updateToolServer: async (serverId, server) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/config/mcp/${serverId}`);
        return universalFetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(server),
        });
      },
      errorMessage: "Failed to update tool server",
    }),

  deleteToolServer: async (serverId) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/config/mcp/${serverId}`);
        return universalFetch(url, {
          method: "DELETE",
        });
      },
      errorMessage: "Failed to delete tool server",
    }),

  toggleToolServer: async (serverId, enabled) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/config/mcp/${serverId}/toggle`);
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        });
      },
      errorMessage: `Failed to ${enabled ? "enable" : "disable"} tool server`,
    }),

  testToolServer: async (serverId) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/config/mcp/${serverId}/test`);
        return universalFetch(url, {
          method: "POST",
        });
      },
      errorMessage: "Failed to test tool server",
    }),

  refreshTools: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/mcp/refresh-tools");
        return universalFetch(url, {
          method: "POST",
        });
      },
      errorMessage: "Failed to refresh tools",
    }),
};
