import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { toolsApi } from "../api/toolsApi";
import { settingsApi } from "../api/settingsApi";
import { toastApiError, toastApiSuccess } from "../helpers/errorHandlers";
import { KEYS } from "../cache/keys";

const DEFAULT_DISABLED_TOOLS = ["pubmed_search", "wiki_search"];

export const useToolServers = () => {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);
    const [testingServerId, setTestingServerId] = useState(null);

    const {
        data: toolServers = [],
        mutate: mutateServers,
    } = useSWR(KEYS.TOOL_SERVERS, async () => {
        const data = await toolsApi.fetchToolServers();
        return data.servers || [];
    });

    const {
        data: globalConfig = {},
        mutate: mutateGlobalConfig,
    } = useSWR(KEYS.GLOBAL_CONFIG, () => settingsApi.fetchConfig());

    const disabledTools = useMemo(
        () => globalConfig.DISABLED_TOOLS || DEFAULT_DISABLED_TOOLS,
        [globalConfig],
    );

    const refreshServers = useCallback(async () => {
        await mutateServers();
    }, [mutateServers]);

    const addServer = useCallback(
        async (serverData) => {
            setIsLoading(true);
            try {
                await toolsApi.addToolServer(serverData);
                await toolsApi.refreshTools();
                toastApiSuccess(t("toolServers.toast.added"));
                await mutateServers();
                return true;
            } catch (error) {
                console.error("Error adding tool server:", error);
                toastApiError(t("toolServers.toast.addFailed"));
                return false;
            } finally {
                setIsLoading(false);
            }
        },
        [mutateServers, t],
    );

    const deleteServer = useCallback(
        async (serverId) => {
            setIsLoading(true);
            try {
                await toolsApi.deleteToolServer(serverId);
                await toolsApi.refreshTools();
                toastApiSuccess(t("toolServers.toast.deleted"));
                await mutateServers();
                return true;
            } catch (error) {
                console.error("Error deleting tool server:", error);
                toastApiError(t("toolServers.toast.deleteFailed"));
                return false;
            } finally {
                setIsLoading(false);
            }
        },
        [mutateServers, t],
    );

    const toggleServer = useCallback(
        async (serverId, enabled) => {
            setIsLoading(true);
            try {
                await toolsApi.toggleToolServer(serverId, enabled);
                await toolsApi.refreshTools();
                toastApiSuccess(
                    t("toolServers.toast.serverToggled", {
                        state: t(
                            enabled
                                ? "toolServers.status.enabled"
                                : "toolServers.status.disabled",
                        ),
                    }),
                );
                await mutateServers();
                return true;
            } catch (error) {
                console.error("Error toggling tool server:", error);
                toastApiError(t("toolServers.toast.toggleFailed"));
                return false;
            } finally {
                setIsLoading(false);
            }
        },
        [mutateServers, t],
    );

    const toggleSensitiveData = useCallback(
        async (serverId, allowSensitive) => {
            setIsLoading(true);
            try {
                await toolsApi.updateToolServer(serverId, {
                    allow_sensitive_data: allowSensitive,
                });
                await toolsApi.refreshTools();
                toastApiSuccess(
                    t("toolServers.toast.sensitiveData", {
                        state: t(
                            allowSensitive
                                ? "toolServers.status.allowed"
                                : "toolServers.status.sanitized",
                        ),
                    }),
                );
                await mutateServers();
                return true;
            } catch (error) {
                console.error("Error toggling sensitive data:", error);
                toastApiError(t("toolServers.toast.sensitiveDataFailed"));
                return false;
            } finally {
                setIsLoading(false);
            }
        },
        [mutateServers, t],
    );

    const testServer = useCallback(
        async (serverId) => {
            setTestingServerId(serverId);
            try {
                const result = await toolsApi.testToolServer(serverId);
                if (result.success) {
                    const toolCount = result.tools?.length || 0;
                    const serverName = result.server_info?.name || "";
                    const serverVersion = result.server_info?.version || "";
                    const description = serverName
                        ? serverVersion
                            ? t("toolServers.toast.connectionSummaryVersioned", {
                                  name: serverName,
                                  version: serverVersion,
                                  count: toolCount,
                              })
                            : t("toolServers.toast.connectionSummary", {
                                  name: serverName,
                                  count: toolCount,
                              })
                        : t("toolServers.toast.toolsFound", {
                              count: toolCount,
                          });
                    toastApiSuccess(
                        description,
                        t("toolServers.toast.connectionSuccessful"),
                    );
                    return true;
                }
                toastApiError(
                    result.message || t("toolServers.toast.connectFailed"),
                    t("toolServers.toast.connectionFailed"),
                );
                return false;
            } catch (error) {
                console.error("Error testing tool server:", error);
                toastApiError(t("toolServers.toast.testFailed"));
                return false;
            } finally {
                setTestingServerId(null);
            }
        },
        [t],
    );

    const toggleBuiltInTool = useCallback(
        async (toolName, enabled) => {
            const newDisabledTools = enabled
                ? disabledTools.filter((t) => t !== toolName)
                : [...disabledTools, toolName];

            try {
                await settingsApi.saveConfig({ DISABLED_TOOLS: newDisabledTools });
                // Optimistic local update; full revalidate via mutate
                mutateGlobalConfig(
                    (prev) => ({ ...prev, DISABLED_TOOLS: newDisabledTools }),
                    { revalidate: false },
                );
                toastApiSuccess(
                    t("toolServers.toast.toolToggled", {
                        name: toolName,
                        state: t(
                            enabled
                                ? "toolServers.status.enabled"
                                : "toolServers.status.disabled",
                        ),
                    }),
                );
                return true;
            } catch (error) {
                console.error("Error saving tool settings:", error);
                toastApiError(t("toolServers.toast.saveSettingsFailed"));
                return false;
            }
        },
        [disabledTools, mutateGlobalConfig, t],
    );

    const isToolEnabled = useCallback(
        (toolName) => !disabledTools.includes(toolName),
        [disabledTools],
    );

    return {
        toolServers,
        isLoading,
        testingServerId,
        disabledTools,
        addServer,
        deleteServer,
        toggleServer,
        toggleSensitiveData,
        testServer,
        toggleBuiltInTool,
        isToolEnabled,
        refreshServers,
    };
};
