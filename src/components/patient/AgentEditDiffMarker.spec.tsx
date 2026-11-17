import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import AgentEditDiffMarker from "./AgentEditDiffMarker";
import { renderWithProviders } from "../../test/utils";
import { t } from "@/i18n";

const markerLabel = () => t("patient.agentEditedPersistentField") as string;

const renderMarker = (props: { before?: string; after: string }) =>
    renderWithProviders(
        <AgentEditDiffMarker fieldLabel="Past Medical History" {...props} />,
    );

// The theme styles diff rows through global CSS layers (not the element's
// css-* classes), so pull the matching rule from the injected stylesheets.
const globalRuleText = (selector: string): string => {
    const visit = (rules: CSSRuleList): string[] =>
        Array.from(rules).flatMap((rule) => {
            const { selectorText, cssRules, cssText } = rule as {
                selectorText?: string;
                cssRules?: CSSRuleList;
                cssText: string;
            };
            return [
                ...(selectorText?.includes(selector) ? [cssText] : []),
                ...(cssRules ? visit(cssRules) : []),
            ];
        });
    return Array.from(document.styleSheets)
        .flatMap((sheet) => {
            try {
                return visit(sheet.cssRules);
            } catch {
                return [];
            }
        })
        .join("\n");
};

afterEach(cleanup);

describe("AgentEditDiffMarker", () => {
    it("shows a colored line diff of the agent's change on click", async () => {
        renderMarker({ before: "• Hypertension", after: "• Hypertension\n• AF" });
        fireEvent.click(screen.getByLabelText(markerLabel()));

        // Chakra v3 Popover opens on click; content is lazily rendered.
        await screen.findByText("• Hypertension");
        const added = document.querySelector(".agent-diff-line--add");
        expect(added?.textContent).toContain("+ • AF");
        expect(document.querySelectorAll(".agent-diff-line--remove")).toHaveLength(0);
    });

    it("marks changed lines with remove/add prefixes and a struck-through removal", async () => {
        renderMarker({
            before: "• Hypertension\n• Old line",
            after: "• Hypertension\n• New line",
        });
        fireEvent.click(screen.getByLabelText(markerLabel()));

        await screen.findByText("• Hypertension");
        // Unchanged context is kept; removals are emitted before additions.
        const rowTypes = Array.from(
            document.querySelectorAll(".agent-diff-line"),
        ).map((el) => el.className.match(/agent-diff-line--(\w+)/)?.[1]);
        expect(rowTypes).toEqual(["same", "remove", "add"]);

        const removed = document.querySelector(".agent-diff-line--remove");
        expect(removed?.textContent).toBe("- • Old line");
        const added = document.querySelector(".agent-diff-line--add");
        expect(added?.textContent).toBe("+ • New line");

        // The remove class carries the strike-through in the theme globals.
        expect(globalRuleText(".agent-diff-line--remove")).toContain(
            "text-decoration: line-through",
        );
    });

    it("falls back to an unavailable note when no baseline exists", async () => {
        renderMarker({ after: "• Hypertension" });
        fireEvent.click(screen.getByLabelText(markerLabel()));
        expect(
            await screen.findByText(t("patient.agentDiffUnavailable") as string),
        ).toBeInTheDocument();
        // No diff rows are fabricated without a baseline.
        expect(document.querySelectorAll(".agent-diff-line")).toHaveLength(0);
        expect(
            screen.getByText(
                t("patient.agentDiffTitle", { field: "Past Medical History" }) as string,
            ),
        ).toBeInTheDocument();
    });
});
