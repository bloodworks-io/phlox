import { t } from "@/i18n";

export const getStatusInfo = (status, agentState) => {
    switch (status) {
        case "connecting":
            return {
                label: t("agent.status.connecting"),
                color: "overlay0",
                pulse: true,
            };
        case "stopping":
            return {
                label: t("agent.status.wrappingUp"),
                color: "overlay0",
                pulse: false,
            };
        case "live":
            return agentState === "working"
                ? {
                      label: t("agent.status.updatingNote"),
                      color: "secondaryButton",
                      pulse: false,
                  }
                : {
                      label: t("agent.status.microphoneActive"),
                      color: "accent",
                      pulse: true,
                  };
        case "review":
            return {
                label: t("agent.status.sessionEnded"),
                color: "overlay0",
                pulse: false,
            };
        case "error":
            return {
                label: t("agent.status.connectionInterrupted"),
                color: "dangerButton",
                pulse: false,
            };
        default:
            return { label: t("agent.status.idle"), color: "overlay0", pulse: false };
    }
};

export const getContextLine = (status) => {
    switch (status) {
        case "stopping":
            return t("agent.context.applyingFinal");
        case "review":
            return t("agent.context.draftsAvailable");
        default:
            return t("agent.context.changesApply");
    }
};
