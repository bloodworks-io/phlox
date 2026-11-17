import { describe, it, expect, afterEach } from "vitest";
import { screen, fireEvent, cleanup } from "@testing-library/react";
import { ReasoningContent } from "./ReasoningContent";
import { emotionStylesFor, renderWithProviders } from "../../../../test/utils";

// Vitest runs without globals — register cleanup or renders leak.
afterEach(cleanup);

const THINKING = [
    "Iteration 1: consider cardiac causes",
    "Tool call: search guidelines",
    "Tool result: " + "guideline text ".repeat(40),
    "Final non-tool reasoning: angina is most likely",
].join("\n");

const cardFor = (label) => screen.getByText(label).closest("div");

const openThinkingTab = () => {
    const { container } = renderWithProviders(
        <ReasoningContent
            reasoning={{ thinking: THINKING, citations: [] }}
            tabIndex="4"
            setTabIndex={() => {}}
        />,
    );
    return container;
};

describe("ReasoningContent thinking cards", () => {
    it("renders each trace step on a paperAlt card with its Folio role accent", () => {
        openThinkingTab();

        const callCard = cardFor("Tool");
        const callStyles = emotionStylesFor(callCard);
        expect(callStyles).toContain("var(--chakra-colors-folio-paper-alt)");
        expect(callStyles).toContain("var(--chakra-colors-folio-warning)");

        const resultCard = cardFor("Result");
        expect(emotionStylesFor(resultCard)).toContain(
            "var(--chakra-colors-folio-info)",
        );

        const finalCard = cardFor("Reasoning");
        expect(emotionStylesFor(finalCard)).toContain(
            "var(--chakra-colors-folio-success)",
        );
    });

    it("collapses tool results with an inline expand toggle", () => {
        openThinkingTab();

        const fullText = "guideline text ".repeat(40).trim();
        expect(screen.getByText("Tool")).toBeInTheDocument();
        expect(screen.queryByText(fullText)).toBeNull();

        fireEvent.click(screen.getByText("Expand result"));
        expect(screen.getByText(fullText)).toBeInTheDocument();

        fireEvent.click(screen.getByText("Collapse result"));
        expect(screen.queryByText(fullText)).toBeNull();
    });
});
