export const getStatusInfo = (status, agentState) => {
    switch (status) {
        case "connecting":
            return { label: "Connecting…", color: "overlay0", pulse: true };
        case "stopping":
            return { label: "Wrapping up…", color: "overlay0", pulse: false };
        case "tidy":
            return {
                label: agentState === "working" ? "Applying…" : "Tidy mode",
                color: "successButton",
                pulse: agentState === "working",
            };
        case "live":
            return agentState === "working"
                ? { label: "Updating note…", color: "secondaryButton", pulse: false }
                : { label: "Microphone active", color: "accent", pulse: true };
        case "review":
            return { label: "Session ended", color: "overlay0", pulse: false };
        case "error":
            return {
                label: "Connection interrupted",
                color: "dangerButton",
                pulse: false,
            };
        default:
            return { label: "Idle", color: "overlay0", pulse: false };
    }
};

export const getContextLine = (status) => {
    switch (status) {
        case "tidy":
            return "Speak commands to edit the note";
        case "stopping":
            return "Applying the final updates…";
        case "review":
            return "Drafts stay available until you start a new session";
        default:
            return "Changes apply to the note as you speak";
    }
};
