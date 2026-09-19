import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, fireEvent, cleanup } from "@testing-library/react";
import AgentPanel from "./AgentPanel";
import { renderWithProviders } from "../../../test/utils";

// Vitest runs without globals, so testing-library cannot register its own
// afterEach cleanup — without this, renders leak between tests.
afterEach(cleanup);

const letterArtifact = {
    type: "letter",
    title: "Patient summary letter",
    content: "Dear Elena,",
};

const statuses = [
    { id: "s1", content: "Note updated: history", kind: "edit" },
    { id: "s2", content: "Staged: Patient summary letter", kind: "artifact" },
];

describe("AgentPanel", () => {
    it("renders nothing when the session is idle", () => {
        const { container } = renderWithProviders(
            <AgentPanel status="idle" transcripts={[]} statuses={[]} artifacts={[]} />,
        );
        // The provider injects a theme script, so assert on our surfaces.
        expect(container.querySelector(".live-bar, .floating-panel")).toBeNull();
    });

    it("shows the compact bar with status and review badge", () => {
        const onExpand = vi.fn();
        renderWithProviders(
            <AgentPanel
                status="live"
                agentState="listening"
                transcripts={[]}
                statuses={[]}
                artifacts={[letterArtifact]}
                onExpand={onExpand}
            />,
        );
        expect(screen.getByText("Live agent")).toBeInTheDocument();
        expect(screen.getByText("Microphone active")).toBeInTheDocument();
        expect(screen.getByText("1 to review")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /expand live panel/i }));
        expect(onExpand).toHaveBeenCalled();
    });

    it("omits the review badge when nothing is prepared", () => {
        renderWithProviders(
            <AgentPanel status="live" transcripts={[]} statuses={[]} artifacts={[]} />,
        );
        expect(screen.queryByText(/to review/)).not.toBeInTheDocument();
    });

    it("leads the window with activity, then prepared drafts", () => {
        renderWithProviders(
            <AgentPanel
                status="live"
                transcripts={[]}
                statuses={statuses}
                artifacts={[letterArtifact]}
                view="window"
            />,
        );
        const activity = screen.getByText("Latest activity");
        const prepared = screen.getByText("Prepared for review · 1");
        expect(activity).toBeInTheDocument();
        expect(
            activity.compareDocumentPosition(prepared) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(screen.getByText("Note updated: history")).toBeInTheDocument();
    });

    it("opens a letter artifact in the letter editor", () => {
        const onOpenLetter = vi.fn();
        renderWithProviders(
            <AgentPanel
                status="live"
                transcripts={[]}
                statuses={[]}
                artifacts={[letterArtifact]}
                view="window"
                onOpenLetter={onOpenLetter}
            />,
        );
        fireEvent.click(
            screen.getByRole("button", { name: /patient summary letter/i }),
        );
        expect(onOpenLetter).toHaveBeenCalledWith(letterArtifact);
    });

    it("keeps captions behind the transcript toggle", () => {
        renderWithProviders(
            <AgentPanel
                status="live"
                transcripts={["Energy improving."]}
                statuses={[]}
                artifacts={[]}
                view="window"
            />,
        );
        const toggle = screen.getByRole("button", { name: /transcript/i });
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByText("Energy improving.")).not.toBeInTheDocument();
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByText("Energy improving.")).toBeInTheDocument();
    });

    it("parks ended sessions in a review state with a dismiss action", () => {
        const onDismissReview = vi.fn();
        renderWithProviders(
            <AgentPanel
                status="review"
                transcripts={["One remark."]}
                statuses={statuses}
                artifacts={[letterArtifact]}
                view="window"
                onDismissReview={onDismissReview}
            />,
        );
        expect(screen.getByText("Session ended")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /patient summary letter/i }),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText("Close session review"));
        expect(onDismissReview).toHaveBeenCalled();
    });

    it("surfaces connection failures with an inline retry", () => {
        const onRetry = vi.fn();
        const onDismissReview = vi.fn();
        renderWithProviders(
            <AgentPanel
                status="error"
                transcripts={[]}
                statuses={[]}
                artifacts={[letterArtifact]}
                lastError="The event stream ended unexpectedly."
                onRetry={onRetry}
                onDismissReview={onDismissReview}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: /reconnect/i }));
        expect(onRetry).toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
        expect(onDismissReview).toHaveBeenCalled();
    });
});
