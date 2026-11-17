import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import GroundedTextarea from "./GroundedTextarea";
import { renderWithProviders, emotionStylesFor } from "../../test/utils";
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

    it("lists the supporting utterance in the supported popover without a dismiss action", async () => {
        const onCiteLine = vi.fn();
        renderGrounded({ citations: [supported], onCiteLine });

        fireEvent.click(screen.getByRole("button"));
        expect(
            await screen.findByText(
                t("patient.citationSupportedLabel", { count: 1 }),
            ),
        ).toBeInTheDocument();
        expect(screen.getByText("tired all month")).toBeInTheDocument();

        // Supported findings have nothing to dismiss, but the row can cite.
        fireEvent.click(screen.getByText("tired all month"));
        expect(onCiteLine).toHaveBeenCalledWith(0);
        expect(
            screen.queryByRole("button", { name: t("patient.citationKeep") as string }),
        ).toBeNull();
    });
});

describe("GroundedTextarea overlay geometry", () => {
    it("keeps the root flush, with no gutter or mirror, while inactive", () => {
        const { container } = renderGrounded();
        const root = container.querySelector("textarea")!.parentElement!;
        const styles = emotionStylesFor(root);
        expect(styles).toContain("position: relative");
        expect(styles).not.toContain("padding-right");
        expect(container.querySelector("div[aria-hidden='true']")).toBeNull();
    });

    it("reserves a 28px badge gutter on the root while the overlay is active", () => {
        const { container } = renderGrounded({ citations: [supported] });
        const root = container.querySelector("textarea")!.parentElement!;
        expect(emotionStylesFor(root)).toContain("padding-right: 28px");
    });

    it("renders the measurement mirror hidden, aria-hidden, and offset by the gutter", () => {
        const { container } = renderGrounded({ citations: [supported] });
        const mirror = container.querySelector(
            "div[aria-hidden='true']",
        ) as HTMLElement;
        expect(mirror).toBeInTheDocument();
        expect(mirror).toHaveAttribute("aria-hidden", "true");
        expect(mirror.style.right).toBe("28px");
        expect(mirror.style.visibility).toBe("hidden");
        expect(mirror.style.pointerEvents).toBe("none");
        expect(mirror.style.position).toBe("absolute");
    });

    it("mirrors every value line with data-line and data-line-end markers", () => {
        const { container } = renderGrounded({
            citations: [supported, conflict, unverified],
        });
        expect(container.querySelectorAll("[data-line]")).toHaveLength(3);
        expect(container.querySelectorAll("[data-line-end]")).toHaveLength(3);
        [0, 1, 2].forEach((index) => {
            const line = container.querySelector(`[data-line='${index}']`);
            // The zero-size end marker sits at the tail of its own line span.
            expect(line?.querySelector(`[data-line-end='${index}']`)).not.toBeNull();
            expect(line?.childElementCount).toBe(1);
        });
    });
});

describe("GroundedTextarea verdict dot shapes", () => {
    // Folio verdict palette: success fill, warning hollow ring, danger halo.
    it("draws supported verdicts filled without a border", () => {
        renderGrounded({ citations: [supported] });
        const dot = document.querySelector(
            "[data-verdict-dot='supported']",
        ) as HTMLElement;
        expect(dot.style.backgroundColor).toBe(
            "var(--chakra-colors-folio-success)",
        );
        expect(dot.style.borderStyle).toBe("none");
        expect(dot.style.width).toBe("6px");
        expect(dot.style.height).toBe("6px");
    });

    it("draws unverified verdicts as hollow rings", () => {
        renderGrounded({ citations: [unverified] });
        const dot = document.querySelector(
            "[data-verdict-dot='unverified']",
        ) as HTMLElement;
        expect(dot.style.backgroundColor).toBe("transparent");
        expect(dot.style.border).toBe(
            "1.5px solid var(--chakra-colors-folio-warning)",
        );
    });

    it("fills conflict verdicts and tags their badge with the conflict class", () => {
        renderGrounded({ citations: [conflict] });
        const dot = document.querySelector(
            "[data-verdict-dot='conflict']",
        ) as HTMLElement;
        expect(dot.style.backgroundColor).toBe(
            "var(--chakra-colors-folio-danger)",
        );
        expect(dot.style.borderStyle).toBe("none");
        expect(document.querySelector(".citation-badge")).toHaveClass(
            "citation-badge--conflict",
        );
    });
});
