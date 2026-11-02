import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, fireEvent, cleanup } from "@testing-library/react";
import DocumentPanel from "./DocumentPanel";
import { emotionStylesFor, renderWithProviders } from "../../../test/utils";

// Vitest runs without globals — register cleanup or renders leak.
afterEach(cleanup);

vi.mock("../../../utils/hooks/useTranscription", () => ({
    useTranscription: () => ({
        processDocument: vi.fn(),
        reprocessTranscription: vi.fn(),
        isTranscribing: false,
    }),
}));

const TEMPLATE = {
    template_key: "soap",
    fields: [
        { field_key: "hx", field_name: "History" },
        { field_key: "exam", field_name: "Examination" },
    ],
};

function renderPanel(props = {}) {
    return renderWithProviders(
        <>
            <div className="floating-action-menu">
                <button id="fab-document" />
            </div>
            <DocumentPanel
                isOpen
                handleDocumentComplete={vi.fn()}
                toggleDocumentField={vi.fn()}
                replacedFields={{}}
                extractedDocData={null}
                resetDocumentState={vi.fn()}
                name="John Smith"
                dob="1980-01-01"
                gender="male"
                setLoading={vi.fn()}
                template={TEMPLATE}
                docFileName=""
                setDocFileName={vi.fn()}
                {...props}
            />
        </>,
    );
}

describe("DocumentPanel Folio conversion", () => {
    it("sets the header on paper with an accent icon cluster and title", () => {
        renderPanel();
        const header = document.querySelector(".panel-header");
        const cluster = header.firstElementChild;
        expect(emotionStylesFor(cluster)).toContain(
            "var(--chakra-colors-folio-accent)",
        );
        // The title carries no ink of its own — it inherits the cluster accent.
        const title = screen.getByText("Document Upload");
        expect(emotionStylesFor(title)).not.toContain(
            "var(--chakra-colors-folio-ink)",
        );
    });

    it("tints the drag overlay with accentSoft over an accent hint", () => {
        renderPanel();
        // Drag handlers live on the scrolling content box; the hint text is
        // inside it, so the drag events bubble through them.
        const hint = screen.getByText(/referral letter or other document/);
        fireEvent.dragOver(hint);
        const overlayText = screen.getByText("Drop document here");
        const overlay = overlayText.parentElement;
        const overlayStyles = emotionStylesFor(overlay);
        expect(overlayStyles).toContain("var(--chakra-colors-folio-accent-soft)");
        expect(emotionStylesFor(overlayText)).toContain(
            "var(--chakra-colors-folio-accent)",
        );
        fireEvent.dragLeave(hint);
        expect(screen.queryByText("Drop document here")).toBeNull();
    });

    it("marks empty extracted fields with a warning badge on hairline cards", () => {
        renderPanel({
            extractedDocData: { fields: { hx: "chronic cough", exam: "" } },
            docFileName: "referral.pdf",
        });
        const badge = screen.getByText("Empty");
        const badgeStyles = emotionStylesFor(badge);
        expect(badgeStyles).toContain("var(--chakra-colors-folio-warning-soft)");
        expect(badgeStyles).toContain("var(--chakra-colors-folio-warning)");

        const card = badge.closest("div").parentElement;
        expect(emotionStylesFor(card)).toContain("var(--chakra-colors-folio-line)");
    });

    it("keeps applied fields on the success role and unapplied on secondary", () => {
        renderPanel({
            extractedDocData: { fields: { hx: "chronic cough", exam: "clear lungs" } },
            replacedFields: { hx: true },
            docFileName: "referral.pdf",
        });
        const using = screen.getByText("Using").closest("button");
        expect(emotionStylesFor(using)).toContain(
            "var(--chakra-colors-folio-success)",
        );
        expect(screen.getByText("Use").closest("button")).toBeInTheDocument();
    });
});
