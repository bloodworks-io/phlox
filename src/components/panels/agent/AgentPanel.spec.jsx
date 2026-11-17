import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, fireEvent, cleanup } from "@testing-library/react";
import AgentPanel from "./AgentPanel";
import {
    renderWithProviders,
    emotionStylesFor,
} from "../../../test/utils";

// Vitest runs without globals — register cleanup or renders leak.
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

const renderPanel = (props) =>
    renderWithProviders(
        <AgentPanel
            transcripts={[]}
            statuses={[]}
            artifacts={[]}
            isExpanded
            {...props}
        />,
    );

const stubLocalStorage = () => {
    const store = new Map();
    Object.defineProperty(window, "localStorage", {
        value: {
            getItem: (key) => store.get(key) ?? null,
            setItem: (key, value) => store.set(key, String(value)),
            removeItem: (key) => store.delete(key),
        },
        configurable: true,
    });
};

describe("AgentPanel", () => {
    it("renders nothing when the session is idle", () => {
        const { container } = renderWithProviders(
            <AgentPanel status="idle" transcripts={[]} statuses={[]} artifacts={[]} />,
        );
        expect(container.querySelector(".live-agent-card")).toBeNull();
    });

    it("renders nothing when collapsed — the pill is the minimized view", () => {
        const { container } = renderWithProviders(
            <AgentPanel
                status="live"
                agentState="listening"
                transcripts={[]}
                statuses={[]}
                artifacts={[letterArtifact]}
            />,
        );
        expect(container.querySelector(".live-agent-card")).toBeNull();
    });

    it("leads the expanded panel with activity, then prepared drafts", () => {
        renderWithProviders(
            <AgentPanel
                status="live"
                transcripts={[]}
                statuses={statuses}
                artifacts={[letterArtifact]}
                isExpanded
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
                isExpanded
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
                isExpanded
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
                isExpanded
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

    it("surfaces connection failures with an inline retry when expanded", () => {
        const onRetry = vi.fn();
        const onDismissReview = vi.fn();
        const { rerender } = renderWithProviders(
            <AgentPanel
                status="error"
                transcripts={[]}
                statuses={[]}
                artifacts={[letterArtifact]}
                lastError="The event stream ended unexpectedly."
                isExpanded
                onRetry={onRetry}
                onDismissReview={onDismissReview}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: /reconnect/i }));
        expect(onRetry).toHaveBeenCalled();

        rerender(
            <AgentPanel
                status="error"
                transcripts={[]}
                statuses={[]}
                artifacts={[letterArtifact]}
                lastError="The event stream ended unexpectedly."
                isExpanded
                onRetry={onRetry}
                onDismissReview={onDismissReview}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
        expect(onDismissReview).toHaveBeenCalled();
    });

    it("keeps the compact card clear of the scribe pill", () => {
        // A centered pill on a 1000x800 viewport (bottom 20px, ~300x60).
        const pill = document.createElement("div");
        pill.className = "pill-box-scribe";
        pill.getBoundingClientRect = () => ({
            top: 720,
            bottom: 780,
            left: 350,
            right: 650,
            width: 300,
            height: 60,
            x: 350,
            y: 720,
        });
        document.body.appendChild(pill);
        window.innerWidth = 1100;
        window.innerHeight = 800;
        stubLocalStorage();
        window.localStorage.setItem(
            "phlox:live-agent-pos",
            JSON.stringify({ x: 400, bottom: 16 }),
        );

        try {
            const { container } = renderWithProviders(
                <AgentPanel
                    status="live"
                    transcripts={[]}
                    statuses={[]}
                    artifacts={[]}
                    isExpanded
                />,
            );
            const card = container.querySelector(".live-agent-card");
            expect(getComputedStyle(card).left).toBe("662px"); // pill.right + 12
        } finally {
            pill.remove();
            window.localStorage.removeItem("phlox:live-agent-pos");
            window.innerWidth = 1024;
            window.innerHeight = 768;
        }
    });

    it("parks the card above the pill when the window is too narrow", () => {
        const pill = document.createElement("div");
        pill.className = "pill-box-scribe";
        pill.getBoundingClientRect = () => ({
            top: 720,
            bottom: 780,
            left: 150,
            right: 550,
            width: 400,
            height: 60,
            x: 150,
            y: 720,
        });
        document.body.appendChild(pill);
        window.innerWidth = 700;
        window.innerHeight = 800;
        stubLocalStorage();
        window.localStorage.setItem(
            "phlox:live-agent-pos",
            JSON.stringify({ x: 200, bottom: 16 }),
        );

        try {
            const { container } = renderWithProviders(
                <AgentPanel
                    status="live"
                    transcripts={[]}
                    statuses={[]}
                    artifacts={[]}
                    isExpanded
                />,
            );
            const card = container.querySelector(".live-agent-card");
            // pill.right + 12 + panel width exceeds the right bound, so the
            // panel lifts one row above the pill instead.
            expect(getComputedStyle(card).bottom).toBe("92px"); // 800 - pill.top + 12
        } finally {
            pill.remove();
            window.localStorage.removeItem("phlox:live-agent-pos");
            window.innerWidth = 1024;
            window.innerHeight = 768;
        }
    });
});

describe("AgentPanel status visuals", () => {
    it.each([
        ["connecting", "folio-muted", true],
        ["stopping", "folio-muted", false],
        ["review", "folio-muted", false],
    ])("maps %s to a muted, %s dot", (status, token, pulse) => {
        renderPanel({ status });
        const dot = screen.getByTestId("agent-status-dot");
        expect(emotionStylesFor(dot)).toContain(
            `var(--chakra-colors-${token})`,
        );
        expect(dot.classList.contains("live-bolt-pulse")).toBe(pulse);
    });

    it("maps a listening live session to the info role with a pulse", () => {
        renderPanel({ status: "live", agentState: "listening" });
        const dot = screen.getByTestId("agent-status-dot");
        expect(emotionStylesFor(dot)).toContain(
            "var(--chakra-colors-folio-info)",
        );
        expect(dot.classList.contains("live-bolt-pulse")).toBe(true);
    });

    it("maps a working live session to the warning role without a pulse", () => {
        renderPanel({ status: "live", agentState: "working" });
        const dot = screen.getByTestId("agent-status-dot");
        expect(emotionStylesFor(dot)).toContain(
            "var(--chakra-colors-folio-warning)",
        );
        expect(dot.classList.contains("live-bolt-pulse")).toBe(false);
    });

    it("maps failures to the danger role", () => {
        renderPanel({ status: "error" });
        expect(
            emotionStylesFor(screen.getByTestId("agent-status-dot")),
        ).toContain("var(--chakra-colors-folio-danger)");
    });

    it("renders the agent symbol on the info soft surface", () => {
        renderPanel({ status: "live" });
        expect(emotionStylesFor(screen.getByTestId("agent-symbol"))).toContain(
            "var(--chakra-colors-folio-info-soft)",
        );
    });

    it("keeps the status pulse static under reduced motion", () => {
        renderPanel({ status: "connecting" });
        const styles = emotionStylesFor(
            screen.getByTestId("agent-status-dot"),
        );
        expect(styles).toContain("phloxBoltPulse");
        expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
        expect(styles).toContain("animation: none");
    });
});

describe("AgentPanel activity visuals", () => {
    it.each([
        ["info", "folio-muted"],
        ["edit", "folio-info"],
        ["command", "folio-success"],
        ["artifact", "folio-warning"],
    ])("marks %s activity with %s", (kind, token) => {
        renderPanel({
            status: "live",
            statuses: [{ id: "a1", content: `Did ${kind}`, kind }],
        });
        const icon = screen.getByText(`Did ${kind}`).previousElementSibling;
        expect(emotionStylesFor(icon)).toContain(
            `var(--chakra-colors-${token})`,
        );
    });
});

describe("AgentPanel artifact visuals", () => {
    it("presents prepared drafts on Folio paper with a hairline border", () => {
        renderPanel({ status: "review", artifacts: [letterArtifact] });
        const row = screen.getByRole("button", {
            name: /patient summary letter/i,
        });
        const styles = emotionStylesFor(row);
        expect(styles).toContain("var(--chakra-colors-folio-paper)");
        expect(styles).toContain("var(--chakra-colors-folio-line)");
        expect(styles).toContain("var(--chakra-colors-folio-accent)");
    });

    it("presents connection failures on the Folio danger surface", () => {
        renderPanel({
            status: "error",
            lastError: "The event stream ended unexpectedly.",
        });
        const retry = screen.getByRole("button", { name: /reconnect/i });
        expect(emotionStylesFor(retry)).toContain(
            "var(--chakra-colors-folio-danger)",
        );
        const block = screen.getByText(/event stream ended/i)
            .parentElement;
        expect(emotionStylesFor(block)).toContain(
            "var(--chakra-colors-folio-danger-soft)",
        );
    });
});
