import { describe, it, expect, afterEach } from "vitest";
import { screen, fireEvent, cleanup } from "@testing-library/react";
import MarkdownRenderer from "./MarkdownRenderer";
import {
    renderWithProviders,
    emotionStylesFor,
} from "../../test/utils";

afterEach(cleanup);

const citations = [
    {
        type: "pubmed",
        title: "Iodine and thyroid",
        url: "https://pubmed.example/1",
        snippet: "Iodine modulates thyroid output.",
    },
    {
        type: "wiki",
        label: "wiki:Thyroid",
        url: "https://en.wikipedia.org/wiki/Thyroid",
    },
];

const citationPill = (n) =>
    screen.getByRole("button", { name: String(n) });

describe("MarkdownRenderer citations", () => {
    it("renders citation pills on the Folio information surface", () => {
        renderWithProviders(
            <MarkdownRenderer citations={citations}>
                {"Energy improving [1]."}
            </MarkdownRenderer>,
        );
        const styles = emotionStylesFor(citationPill(1));
        expect(styles).toContain("var(--chakra-colors-folio-info-soft)");
        expect(styles).toContain("var(--chakra-colors-folio-info)");
    });

    it("expands grouped citations into one pill per source", () => {
        renderWithProviders(
            <MarkdownRenderer citations={citations}>
                {"Energy and mood [1, 2]."}
            </MarkdownRenderer>,
        );
        expect(citationPill(1)).toBeInTheDocument();
        expect(citationPill(2)).toBeInTheDocument();
    });

    it("falls back to an info-toned superscript for unknown sources", () => {
        renderWithProviders(<MarkdownRenderer>{"Ref [9]."}</MarkdownRenderer>);
        const sup = screen.getByText("9");
        expect(emotionStylesFor(sup)).toContain(
            "var(--chakra-colors-folio-info)",
        );
    });

    it("shows the source title and excerpt in the popover", async () => {
        renderWithProviders(
            <MarkdownRenderer citations={citations}>
                {"Energy improving [1]."}
            </MarkdownRenderer>,
        );
        fireEvent.click(citationPill(1));
        expect(await screen.findByText("Iodine and thyroid")).toBeInTheDocument();
        expect(
            screen.getByText("Iodine modulates thyroid output."),
        ).toBeInTheDocument();
    });
});

describe("MarkdownRenderer link hygiene", () => {
    it("neutralizes external links into plain domain text", () => {
        renderWithProviders(
            <MarkdownRenderer>
                {"See [guidance](https://example.com/a) now."}
            </MarkdownRenderer>,
        );
        expect(
            screen.getByText(/guidance \(example\.com\)/),
        ).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /guidance/ })).toBeNull();
    });

    it("keeps in-document anchors as ordinary text-colored links", () => {
        renderWithProviders(
            <MarkdownRenderer>
                {"Jump to [section](#section)."}
            </MarkdownRenderer>,
        );
        const anchor = screen.getByRole("link", { name: "section" });
        expect(anchor).toHaveAttribute("href", "#section");
    });
});

describe("MarkdownRenderer tables", () => {
    it("renders GFM tables with Folio paper tones and hairline rules", () => {
        renderWithProviders(
            <MarkdownRenderer>
                {"| Dose | Effect |\n| --- | --- |\n| 25mcg | Lower TSH |"}
            </MarkdownRenderer>,
        );
        const head = screen.getByText("Dose").closest("thead");
        expect(emotionStylesFor(head)).toContain(
            "var(--chakra-colors-folio-paper-alt)",
        );
        const cell = screen.getByText("25mcg").closest("td");
        expect(emotionStylesFor(cell)).toContain(
            "var(--chakra-colors-folio-line)",
        );
    });
});
