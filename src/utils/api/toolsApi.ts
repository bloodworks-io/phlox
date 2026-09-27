import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";
import { t } from "@/i18n";

export const toolsApi = {
  fetchToolServers: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/mcp");
        return universalFetch(url);
      },
      errorMessage: t("api.tools.fetchFailed"),
    }),

  fetchEnabledToolServers: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/mcp/enabled");
        return universalFetch(url);
      },
      errorMessage: t("api.tools.fetchEnabledFailed"),
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
      errorMessage: t("toolServers.toast.addFailed"),
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
      errorMessage: t("api.tools.updateFailed"),
    }),

  deleteToolServer: async (serverId) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/config/mcp/${serverId}`);
        return universalFetch(url, {
          method: "DELETE",
        });
      },
      errorMessage: t("toolServers.toast.deleteFailed"),
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
      errorMessage: enabled ? t("api.tools.enableFailed") : t("api.tools.disableFailed"),
    }),

  testToolServer: async (serverId) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/config/mcp/${serverId}/test`);
        return universalFetch(url, {
          method: "POST",
        });
      },
      errorMessage: t("toolServers.toast.testFailed"),
    }),

  refreshTools: async () =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/config/mcp/refresh-tools");
        return universalFetch(url, {
          method: "POST",
        });
      },
      errorMessage: t("api.tools.refreshFailed"),
    }),
};
