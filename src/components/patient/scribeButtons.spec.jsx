import { describe, it, expect, vi, afterEach } from "vitest";
import { useState } from "react";
import { screen, fireEvent, cleanup } from "@testing-library/react";
import {
    LiveAgentControls,
    LiveExpandButton,
    AgentReviewPill,
    AgentErrorPill,
} from "./scribeButtons";
import ScribePillBox from "./ScribePillBox";
import AgentPanel from "../panels/agent/AgentPanel";
import { renderWithProviders } from "../../test/utils";

// Vitest runs without globals — register cleanup or renders leak.
afterEach(cleanup);

describe("LiveAgentControls", () => {
    it("ends the session on click", () => {
        const onStop = vi.fn();
        renderWithProviders(<LiveAgentControls status="live" onStop={onStop} />);
        fireEvent.click(
            screen.getByRole("button", { name: /end live session/i }),
        );
        expect(onStop).toHaveBeenCalled();
    });

    it("shows a waiting state while the agent prewarms", () => {
        renderWithProviders(
            <LiveAgentControls status="connecting" onStop={() => {}} />,
        );
        expect(
            screen.getByRole("button", { name: /warming up the agent/i }),
        ).toBeDisabled();
    });

    it("disables ending while wrapping up", () => {
        renderWithProviders(<LiveAgentControls status="stopping" onStop={() => {}} />);
        expect(screen.getByRole("button", { name: /wrapping up/i })).toBeDisabled();
    });
});

describe("LiveExpandButton", () => {
    it("expands the panel on click and flips its label when expanded", () => {
        const onExpand = vi.fn();
        renderWithProviders(
            <LiveExpandButton isExpanded={false} onExpand={onExpand} />,
        );
        fireEvent.click(
            screen.getByRole("button", { name: "Expand live agent" }),
        );
        expect(onExpand).toHaveBeenCalled();

        cleanup();
        renderWithProviders(
            <LiveExpandButton isExpanded onExpand={onExpand} />,
        );
        expect(
            screen.getByRole("button", { name: "Collapse live agent panel" }),
        ).toBeInTheDocument();
    });
});

describe("AgentReviewPill", () => {
    it("offers resume, close, and the panel link", () => {
        const onLiveResume = vi.fn();
        const onExpand = vi.fn();
        const onDismiss = vi.fn();
        renderWithProviders(
            <AgentReviewPill
                artifactsCount={2}
                onLiveResume={onLiveResume}
                onExpand={onExpand}
                onDismiss={onDismiss}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: /resume live session/i }));
        expect(onLiveResume).toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: /close session review/i }));
        expect(onDismiss).toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: /open session review/i }));
        expect(onExpand).toHaveBeenCalled();
    });

    it("warns that unreviewed drafts are lost on resume", () => {
        renderWithProviders(
            <AgentReviewPill
                artifactsCount={2}
                onLiveResume={() => {}}
                onExpand={() => {}}
                onDismiss={() => {}}
            />,
        );
        expect(
            screen.getByRole("button", { name: /2 drafts to review first/i }),
        ).toBeInTheDocument();
    });

    it("routes blocked resumes through the consent gate", () => {
        const onLiveResume = vi.fn();
        const onBlockedClick = vi.fn();
        renderWithProviders(
            <AgentReviewPill
                canStart={false}
                onLiveResume={onLiveResume}
                onBlockedClick={onBlockedClick}
                onExpand={() => {}}
                onDismiss={() => {}}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: /resume live session/i }));
        expect(onLiveResume).not.toHaveBeenCalled();
        expect(onBlockedClick).toHaveBeenCalled();
    });

    it("flips the panel link once the review panel is open", () => {
        renderWithProviders(
            <AgentReviewPill
                isExpanded
                onLiveResume={() => {}}
                onExpand={() => {}}
                onDismiss={() => {}}
            />,
        );
        expect(
            screen.getByRole("button", { name: /collapse session review/i }),
        ).toBeInTheDocument();
    });
});

describe("AgentErrorPill", () => {
    it("offers one-click reconnect and dismiss", () => {
        const onRetry = vi.fn();
        const onDismiss = vi.fn();
        renderWithProviders(
            <AgentErrorPill onRetry={onRetry} onDismiss={onDismiss} />,
        );
        const hero = screen.getByRole("button", { name: /connection interrupted/i });
        expect(hero).toBeInTheDocument();
        fireEvent.click(hero);
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

    it("first open anchors the panel above the scribe pill", () => {
        renderWithProviders(<PillAndPanelHarness />);
        const pill = document.querySelector(".pill-box-scribe");
        pill.getBoundingClientRect = () => ({
            top: 700,
            bottom: 750,
            left: 362,
            right: 662,
            width: 300,
            height: 50,
        });

        fireEvent.click(
            screen.getByRole("button", { name: /expand live agent/i }),
        );

        const card = document.querySelector(".live-agent-card");
        expect(getComputedStyle(card).left).toBe("342px");
        expect(getComputedStyle(card).bottom).toBe("80px");
    });
});
