import React from "react";

import { LiveAgentCard } from "./components/LiveAgentCard";

const ACTIVE_STATUSES = [
    "connecting",
    "live",
    "stopping",
    "review",
    "error",
];

const AgentPanel = ({
    status,
    agentState,
    transcripts,
    statuses,
    artifacts,
    lastError,
    isExpanded = false,
    onToggleExpand,
    onOpenLetter,
    onRetry,
    onDismissReview,
}) => {
    const isActive = ACTIVE_STATUSES.includes(status);
    if (!isActive || !isExpanded) return null;

    return (
        <LiveAgentCard
            status={status}
            agentState={agentState}
            transcripts={transcripts}
            statuses={statuses}
            artifacts={artifacts}
            lastError={lastError}
            isExpanded={isExpanded}
            onToggleExpand={onToggleExpand}
            onOpenLetter={onOpenLetter}
            onRetry={onRetry}
            onDismissReview={onDismissReview}
        />
    );
};

export default AgentPanel;
