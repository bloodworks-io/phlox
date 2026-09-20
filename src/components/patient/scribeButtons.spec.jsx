import { describe, it, expect, vi, afterEach } from "vitest";
import { useState } from "react";
import { screen, fireEvent, cleanup } from "@testing-library/react";
import {
    LiveAgentControls,
    AgentReviewPill,
    AgentErrorPill,
} from "./scribeButtons";
import ScribePillBox from "./ScribePillBox";
import AgentPanel from "../panels/agent/AgentPanel";
import { renderWithProviders } from "../../test/utils";

// Vitest runs without globals — register cleanup or renders leak.
afterEach(cleanup);

describe("LiveAgentControls", () => {
    it("shows status, timer, review count, and expand", () => {
        const onExpand = vi.fn();
        renderWithProviders(
            <LiveAgentControls
                status="live"
                agentState="listening"
                elapsed={252}
                artifactsCount={2}
                onExpand={onExpand}
            />,
        );
        expect(screen.getByText("Microphone active")).toBeInTheDocument();
        expect(screen.getByText("4:12")).toBeInTheDocument();
        expect(screen.getByText("2 to review")).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", { name: /expand live agent/i }),
        );
        expect(onExpand).toHaveBeenCalled();
    });

    it("omits the review badge when nothing is prepared", () => {
        renderWithProviders(<LiveAgentControls status="live" elapsed={10} />);
        expect(screen.queryByText(/to review/)).not.toBeInTheDocument();
    });

    it("disables ending while connecting or wrapping up", () => {
        renderWithProviders(<LiveAgentControls status="stopping" elapsed={0} />);
        expect(screen.getByRole("button", { name: /end live session/i })).toBeDisabled();
    });

    it("shows catching-up while speech is queued and listening", () => {
        renderWithProviders(
            <LiveAgentControls
                status="live"
                agentState="listening"
                backlogCount={3}
            />,
        );
        expect(screen.getByText("Catching up…")).toBeInTheDocument();
    });

    it("keeps the working status over catching-up", () => {
        renderWithProviders(
            <LiveAgentControls
                status="live"
                agentState="working"
                backlogCount={3}
            />,
        );
        expect(screen.getByText("Updating note…")).toBeInTheDocument();
        expect(screen.queryByText("Catching up…")).not.toBeInTheDocument();
    });
});

describe("AgentReviewPill", () => {
    it("offers open and dismiss with the review count", () => {
        const onExpand = vi.fn();
        const onDismiss = vi.fn();
        renderWithProviders(
            <AgentReviewPill artifactsCount={2} onExpand={onExpand} onDismiss={onDismiss} />,
        );
        expect(screen.getByText("Session ended")).toBeInTheDocument();
        expect(screen.getByText(/2 to review/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /open session review/i }));
        expect(onExpand).toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: /dismiss session review/i }));
        expect(onDismiss).toHaveBeenCalled();
    });
});

describe("AgentErrorPill", () => {
    it("offers one-click reconnect and dismiss", () => {
        const onRetry = vi.fn();
        const onDismiss = vi.fn();
        renderWithProviders(
            <AgentErrorPill onRetry={onRetry} onDismiss={onDismiss} />,
        );
        expect(screen.getByText("Connection interrupted")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /reconnect live agent/i }));
        expect(onRetry).toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: /dismiss connection error/i }));
        expect(onDismiss).toHaveBeenCalled();
    });
});

// Mirrors the PatientDetails wiring: pill chevron toggles the AgentPanel.
function PillAndPanelHarness() {
    const [isLiveExpanded, setIsLiveExpanded] = useState(false);
    return (
        <>
            <ScribePillBox
                isLive
                liveStatus="live"
                liveAgentState="listening"
                liveElapsed={252}
                isLivePanelExpanded={isLiveExpanded}
                onLiveExpand={() => setIsLiveExpanded((open) => !open)}
                onLiveStop={() => {}}
            />
            <AgentPanel
                status="live"
                agentState="listening"
                transcripts={[]}
                statuses={[]}
                artifacts={[]}
                isExpanded={isLiveExpanded}
                onToggleExpand={() => setIsLiveExpanded((open) => !open)}
            />
        </>
    );
}

describe("pill to panel integration", () => {
    it("toggles the agent panel from the pill chevron", () => {
        renderWithProviders(<PillAndPanelHarness />);
        expect(document.querySelector(".live-agent-card")).toBeNull();

        fireEvent.click(
            screen.getByRole("button", { name: /expand live agent/i }),
        );
        expect(document.querySelector(".live-agent-card")).not.toBeNull();

        // The pill's chevron flips and collapses the expanded panel (exact
        // match — the panel header has its own "Collapse live agent").
        fireEvent.click(
            screen.getByRole("button", { name: "Collapse live agent panel" }),
        );
        expect(document.querySelector(".live-agent-card")).toBeNull();
    });
});
