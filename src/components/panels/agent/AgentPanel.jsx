import React from "react";
import { Box } from "@chakra-ui/react";

import { LiveBar } from "./components/LiveBar";
import { LiveWindow } from "./components/LiveWindow";
import { ErrorBlock } from "./components/ErrorBlock";


const ACTIVE_STATUSES = [
    "connecting",
    "live",
    "tidy",
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
    view = "bar",
    onExpand,
    onMinimize,
    hideBar = false,
    onOpenLetter,
    onRetry,
    onDismissReview,
}) => {
    const isActive = ACTIVE_STATUSES.includes(status);
    if (!isActive) return null;

    if (view === "window") {
        return (
            <LiveWindow
                status={status}
                agentState={agentState}
                transcripts={transcripts}
                statuses={statuses}
                artifacts={artifacts}
                lastError={lastError}
                onMinimize={onMinimize}
                onOpenLetter={onOpenLetter}
                onRetry={onRetry}
                onDismissReview={onDismissReview}
            />
        );
    }
    if (hideBar) return null;
    return (
        <>
            {status === "error" && (
                <Box
                    position="fixed"
                    bottom="117px"
                    left="50%"
                    transform="translateX(-50%)"
                    zIndex="1060"
                    width="min(320px, calc(100vw - 48px))"
                    bg="secondary"
                    border="1px solid"
                    borderColor="surface"
                    borderRadius="12px"
                    boxShadow="0 8px 32px rgba(20, 20, 38, 0.35)"
                    backdropFilter="blur(12px)"
                    p={1.5}
                    className="anim-fade-slide-up"
                >
                    <ErrorBlock
                        message={lastError}
                        onRetry={onRetry}
                        onDismiss={onDismissReview}
                    />
                </Box>
            )}
            <LiveBar
                status={status}
                agentState={agentState}
                artifacts={artifacts}
                onExpand={onExpand}
            />
        </>
    );
};

export default AgentPanel;
