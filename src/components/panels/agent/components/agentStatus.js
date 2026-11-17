import { t } from "@/i18n";

export const getStatusInfo = (status, agentState) => {
    switch (status) {
        case "connecting":
            return {
                label: t("agent.status.connecting"),
                color: "folio.muted",
                pulse: true,
            };
        case "stopping":
            return {
                label: t("agent.status.wrappingUp"),
                color: "folio.muted",
                pulse: false,
            };
        case "live":
            return agentState === "working"
                ? {
                      label: t("agent.status.updatingNote"),
                      color: "folio.warning",
                      pulse: false,
                  }
                : {
                      label: t("agent.status.microphoneActive"),
                      color: "folio.info",
                      pulse: true,
                  };
        case "review":
            return {
                label: t("agent.status.sessionEnded"),
                color: "folio.muted",
                pulse: false,
            };
        case "error":
            return {
                label: t("agent.status.connectionInterrupted"),
                color: "folio.danger",
                pulse: false,
            };
        default:
            return {
                label: t("agent.status.idle"),
                color: "folio.muted",
                pulse: false,
            };
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
