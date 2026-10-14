import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import GroundedTextarea from "./GroundedTextarea";
import { renderWithProviders } from "../../test/utils";
import { t } from "@/i18n";
import type { LineCitation } from "../../utils/patient/types";

const RAW = "S1: tired all month\nS2: lets check bloods\nS1: no chest pain";

const supported: LineCitation = {
    line_index: 0,
    text: "• Fatigue",
    sources: [0],
    contradicts: [],
    verdict: "supported",
};
const conflict: LineCitation = {
    line_index: 1,
    text: "• No chest pain",
    sources: [],
    contradicts: [2],
    verdict: "conflict",
};
const unverified: LineCitation = {
    line_index: 2,
    text: "• Weight loss",
    sources: [],
    contradicts: [],
    verdict: "unverified",
};

function renderGrounded(props = {}) {
    return renderWithProviders(
        <GroundedTextarea
            value={"• Fatigue\n• No chest pain\n• Weight loss"}
            onChange={vi.fn()}
            placeholder="x"
            className="cohesive-textarea"
            fieldKey="clinical_history"
            rawTranscription={RAW}
            {...props}
        />,
    );
}

afterEach(cleanup);

describe("GroundedTextarea", () => {
    it("renders a plain textarea with no overlay when citations are absent", () => {
        renderGrounded();
        expect(document.querySelector("textarea")).toBeInTheDocument();
        expect(document.querySelector("[data-line]")).toBeNull();
        expect(document.querySelector(".citation-badge")).toBeNull();
    });

    it("renders one verdict dot per matched citation line", () => {
        renderGrounded({ citations: [supported, conflict, unverified] });
        const badges = screen.getAllByRole("button");
        expect(badges).toHaveLength(3);
        expect(badges.map((b) => b.getAttribute("data-verdict"))).toEqual([
            "supported",
            "conflict",
            "unverified",
        ]);
        expect(document.querySelectorAll("[data-verdict-dot]")).toHaveLength(3);
        // The count moved out of the badge into the label, tooltip, and popover.
        expect(badges[0].getAttribute("aria-label")).toBe(
            t("patient.citationSupportedLabel", { count: 1 }),
        );
    });

    it("suppresses badges whose snapshot no longer matches the text", () => {
        renderGrounded({
            value: "• Fatigue (edited)\n• No chest pain\n• Weight loss",
            citations: [supported, conflict, unverified],
        });
        expect(screen.getAllByRole("button")).toHaveLength(2);
    });
    it("suppresses dismissed flags via the resolved set", () => {
        renderGrounded({
            citations: [supported, conflict, unverified],
            resolved: ["clinical_history::1", "clinical_history::2"],
        });
        expect(screen.getAllByRole("button")).toHaveLength(1);
    });

    it("popover lists utterances from the transcript and Keep dismisses", async () => {
        const onDismiss = vi.fn();
        const onCiteLine = vi.fn();
        renderGrounded({ citations: [conflict], onDismiss, onCiteLine });

        const badge = screen.getByRole("button");
        expect(badge.getAttribute("aria-label")).toBe(t("patient.citationConflict"));

        // Chakra v3 Popover opens on click; content is lazily rendered.
        fireEvent.click(badge);
        const quote = await screen.findByText(t("patient.citationContradictsLine"));
        expect(quote).toBeInTheDocument();
        expect(screen.getByText("no chest pain")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: t("patient.citationKeep") }));
        expect(onDismiss).toHaveBeenCalledWith("clinical_history", 1);
    });
});
