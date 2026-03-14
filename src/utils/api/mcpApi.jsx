import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

export const mcpApi = {
  fetchMcpServers: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/mcp");
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch MCP servers",
    }),

  fetchEnabledMcpServers: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/mcp/enabled");
        return universalFetch(url);
      },
      errorMessage: "Failed to fetch enabled MCP servers",
    }),

  addMcpServer: async (server) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/mcp");
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(server),
        });
      },
      errorMessage: "Failed to add MCP server",
    }),

  updateMcpServer: async (serverId, server) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/config/mcp/${serverId}`);
        return universalFetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(server),
        });
      },
      errorMessage: "Failed to update MCP server",
    }),

  deleteMcpServer: async (serverId) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/config/mcp/${serverId}`);
        return universalFetch(url, {
          method: "DELETE",
        });
      },
      errorMessage: "Failed to delete MCP server",
    }),

  toggleMcpServer: async (serverId, enabled) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/config/mcp/${serverId}/toggle`);
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        });
      },
      errorMessage: `Failed to ${enabled ? "enable" : "disable"} MCP server`,
    }),

  testMcpServer: async (serverId) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/config/mcp/${serverId}/test`);
        return universalFetch(url, {
          method: "POST",
        });
      },
      errorMessage: "Failed to test MCP server",
    }),

  refreshMcpTools: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/mcp/refresh-tools");
        return universalFetch(url, {
          method: "POST",
        });
      },
      errorMessage: "Failed to refresh MCP tools",
    }),
};
