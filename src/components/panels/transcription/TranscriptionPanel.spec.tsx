import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import TranscriptionPanel from "./TranscriptionPanel";
import { emotionStylesFor, renderWithProviders } from "../../../test/utils";

// Vitest runs without globals — register cleanup or renders leak.
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.matchMedia = ORIGINAL_MATCH_MEDIA;
    delete HTMLElement.prototype.scrollIntoView;
    vi.restoreAllMocks();
});

const reprocessTranscription = vi.fn(async () => ({}));
vi.mock("../../../utils/hooks/useTranscription", () => ({
    useTranscription: () => ({
        reprocessTranscription,
        isTranscribing: false,
    }),
}));

const ORIGINAL_MATCH_MEDIA = window.matchMedia.bind(window);

function stubReducedMotion(matches: boolean) {
    window.matchMedia = ((query: string) => ({
        ...ORIGINAL_MATCH_MEDIA(query),
        matches:
            query === "(prefers-reduced-motion: reduce)" ? matches : false,
    })) as typeof window.matchMedia;
}

const baseProps = {
    rawTranscription: "S1: good morning\nplain line",
    transcriptionDuration: 4,
    processDuration: 2,
    onReprocess: () => {},
    isAmbient: false,
    name: "John Smith",
    gender: "male",
    dob: "1980-01-01",
    templateKey: null,
    noteId: null,
};

const successOverlay = () =>
    Array.from(document.querySelectorAll("div")).find((el) =>
        emotionStylesFor(el).includes(
            "var(--chakra-colors-folio-success-soft)",
        ),
    );

describe("TranscriptionPanel Folio conversion", () => {
    it("renders the transcript on an explicit folio paper material", () => {
        const { container } = renderWithProviders(
            <TranscriptionPanel {...baseProps} />,
        );
        // Provider injects a color-mode <script> first; the first div is
        // the panel surface.
        const styles = emotionStylesFor(container.querySelector("div"));
        expect(styles).toContain("var(--chakra-colors-folio-paper)");
        expect(styles).toContain("var(--chakra-colors-folio-ink)");
    });

    it("scrolls the highlighted line into view smoothly, then consumes it", () => {
        vi.useFakeTimers();
        const scrollIntoView = vi.fn();
        HTMLElement.prototype.scrollIntoView = scrollIntoView;
        const onHighlightLineConsumed = vi.fn();

        renderWithProviders(
            <TranscriptionPanel
                {...baseProps}
                highlightLine={1}
                onHighlightLineConsumed={onHighlightLineConsumed}
            />,
        );

        const highlighted = document.querySelector(
            ".transcript-line--highlighted",
        );
        expect(highlighted?.getAttribute("data-line")).toBe("1");
        expect(scrollIntoView).toHaveBeenCalledWith({
            block: "nearest",
            behavior: "smooth",
        });
        expect(onHighlightLineConsumed).not.toHaveBeenCalled();
        vi.advanceTimersByTime(2500);
        expect(onHighlightLineConsumed).toHaveBeenCalledTimes(1);
    });

    it("jumps instead of smooth-scrolling under reduced motion", () => {
        stubReducedMotion(true);
        const scrollIntoView = vi.fn();
        HTMLElement.prototype.scrollIntoView = scrollIntoView;

        renderWithProviders(
            <TranscriptionPanel {...baseProps} highlightLine={0} />,
        );

        expect(scrollIntoView).toHaveBeenCalledWith({
            block: "nearest",
            behavior: "auto",
        });
    });

    it("flashes a successSoft confirmation overlay after reprocessing", async () => {
        renderWithProviders(<TranscriptionPanel {...baseProps} />);

        fireEvent.click(screen.getByRole("button", { name: "Reprocess" }));

        await waitFor(() => expect(successOverlay()).toBeTruthy());
        expect(emotionStylesFor(successOverlay())).toContain(
            "animation: fadeOut",
        );
    });

    it("keeps the confirmation overlay static under reduced motion", async () => {
        stubReducedMotion(true);
        renderWithProviders(<TranscriptionPanel {...baseProps} />);

        fireEvent.click(screen.getByRole("button", { name: "Reprocess" }));

        await waitFor(() => expect(successOverlay()).toBeTruthy());
        expect(emotionStylesFor(successOverlay())).not.toContain("animation:");
    });

    it("shows the empty state on faint ink", () => {
        renderWithProviders(
            <TranscriptionPanel {...baseProps} rawTranscription={null} />,
        );
        const empty = screen.getByText("No transcription");
        expect(emotionStylesFor(empty)).toContain(
            "var(--chakra-colors-folio-faint)",
        );
    });
});
