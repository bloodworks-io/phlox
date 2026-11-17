import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import { ReasoningItem } from "./ReasoningItem";
import { emotionStylesFor, renderWithProviders } from "../../../../test/utils";

// Vitest runs without globals — register cleanup or renders leak.
afterEach(cleanup);

const item = (overrides = {}) => ({
    suggestion: "Consider angina",
    rationale: ["typical chest pain"],
    ...overrides,
});

describe("ReasoningItem Folio status mapping", () => {
    it.each([
        ["differentials", "folio-info"],
        ["investigations", "folio-success"],
        ["considerations", "folio-warning"],
    ])("maps %s items to their Folio role on a paper surface", (section, token) => {
        const { container } = renderWithProviders(
            <ReasoningItem item={item()} section={section} />,
        );
        // Provider injects a color-mode <script> first; the card is the
        // first div in the tree.
        const styles = emotionStylesFor(container.querySelector("div"));
        expect(styles).toContain(`var(--chakra-colors-${token})`);
        expect(styles).toContain("var(--chakra-colors-folio-paper)");
    });

    it("escalates critical items to danger with a solid danger badge", () => {
        const { container } = renderWithProviders(
            <ReasoningItem item={item({ critical: true })} section="differentials" />,
        );
        const styles = emotionStylesFor(container.querySelector("div"));
        expect(styles).toContain("var(--chakra-colors-folio-danger)");
        expect(styles).not.toContain("var(--chakra-colors-folio-info)");
        const badge = screen.getByText("Priority");
        const badgeStyles = emotionStylesFor(badge);
        expect(badgeStyles).toContain("var(--chakra-colors-folio-danger)");
        expect(badgeStyles).toContain("var(--chakra-colors-folio-danger-ink)");
    });

    it("renders legacy string items without a status accent override", () => {
        const { container } = renderWithProviders(
            <ReasoningItem item="Plain thought" section="considerations" />,
        );
        const styles = emotionStylesFor(container.querySelector("div"));
        expect(styles).toContain("var(--chakra-colors-folio-warning)");
        expect(screen.getByText("Plain thought")).toBeInTheDocument();
    });
});
