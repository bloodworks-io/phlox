import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import PreviousVisitPanel from "./PreviousVisitPanel";
import { emotionStylesFor, renderWithProviders } from "../../../test/utils";

// Vitest runs without globals — register cleanup or renders leak.
afterEach(cleanup);

function renderPanel(props = {}) {
    return renderWithProviders(
        <>
            <div className="floating-action-menu">
                <button id="fab-previous-visit" />
            </div>
            <PreviousVisitPanel
                isOpen
                previousVisitSummary={null}
                previousVisitSummaryPending={false}
                previousVisitTemplateData={null}
                previousVisitTemplateKey={null}
                previousVisitEncounterDate={null}
                templates={[]}
                {...props}
            />
        </>,
    );
}

describe("PreviousVisitPanel Folio conversion", () => {
    it("sets the header on paper with hairline and accent icon", () => {
        renderPanel();
        const header = document.querySelector(".panel-header");
        const headerStyles = emotionStylesFor(header);
        expect(headerStyles).toContain("var(--chakra-colors-folio-paper)");
        expect(headerStyles).toContain("var(--chakra-colors-folio-ink)");
        expect(headerStyles).toContain("var(--chakra-colors-folio-line)");
        // Icon cluster rides the accent role.
        expect(emotionStylesFor(header.firstElementChild)).toContain(
            "var(--chakra-colors-folio-accent)",
        );
    });

    it("reads both tabs on the folio canvas material", () => {
        renderPanel();
        const bodies = document.querySelectorAll(".attached-panel-body");
        expect(bodies).toHaveLength(2);
    });

    it("keeps empty states on faint ink", () => {
        renderPanel();
        const summary = screen.getByText("No previous visit summary available.");
        expect(emotionStylesFor(summary)).toContain(
            "var(--chakra-colors-folio-faint)",
        );
        const fullNote = screen.getByText(
            "No previous visit note content available.",
        );
        expect(emotionStylesFor(fullNote)).toContain(
            "var(--chakra-colors-folio-faint)",
        );
    });

    it("renders the encounter date label and read-only fields", () => {
        renderPanel({
            previousVisitTemplateKey: "soap",
            previousVisitEncounterDate: "2026-10-01",
            previousVisitTemplateData: { hx: "Chronic cough for two weeks." },
            templates: [
                {
                    template_key: "soap",
                    fields: [{ field_key: "hx", field_name: "History" }],
                },
            ],
        });
        expect(screen.getByText("2026-10-01")).toBeInTheDocument();
        expect(screen.getByText("History:")).toBeInTheDocument();
        expect(screen.getByText("Chronic cough for two weeks.")).toBeInTheDocument();
    });
});
