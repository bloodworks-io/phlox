import { describe, expect, it } from "vitest";
import {
    getToolName,
    getToolPresentation,
    formatToolContent,
} from "./toolPresentation";

describe("getToolName", () => {
    it("reads the tool name from attrs in priority order", () => {
        expect(getToolName({ attrs: { name: "wiki_search" } })).toBe(
            "wiki_search",
        );
        expect(getToolName({ attrs: { tool: "t" } })).toBe("t");
        expect(getToolName({ attrs: { function: "f" } })).toBe("f");
        expect(getToolName({ attrs: { function_name: "fn" } })).toBe("fn");
        expect(getToolName({ attrs: { id: "abc" } })).toBe("abc");
    });

    it("falls back to unknown_tool", () => {
        expect(getToolName({ attrs: {} })).toBe("unknown_tool");
        expect(getToolName({})).toBe("unknown_tool");
        expect(getToolName(null)).toBe("unknown_tool");
    });
});

describe("getToolPresentation", () => {
    it("maps known tool names to their presentation (case-insensitive)", () => {
        expect(getToolPresentation("search_wiki").label).toBe("Wikipedia");
        expect(getToolPresentation("PubMed_Search").label).toBe("PubMed");
        expect(getToolPresentation("literature_lookup").label).toBe(
            "Literature search",
        );
        expect(getToolPresentation("get_transcript").label).toBe("Transcript");
        expect(getToolPresentation("direct_response").label).toBe(
            "Direct response",
        );
    });

    it("colors and icons follow the matched tool", () => {
        expect(getToolPresentation("wiki").colorScheme).toBe("blue");
        expect(getToolPresentation("pubmed").colorScheme).toBe("teal");
    });

    it("defaults to a generic tool presentation", () => {
        const fallback = getToolPresentation("something_new");
        expect(fallback.label).toBe("Tool");
        expect(fallback.colorScheme).toBe("purple");
        expect(getToolPresentation("").label).toBe("Tool");
    });
});

describe("formatToolContent", () => {
    it("returns empty string for blank content", () => {
        expect(formatToolContent("")).toBe("");
        expect(formatToolContent("   \n  ")).toBe("");
        expect(formatToolContent(null)).toBe("");
        expect(formatToolContent(undefined)).toBe("");
    });

    it("pretty-prints valid JSON", () => {
        expect(formatToolContent('{"a":1}')).toBe('{\n  "a": 1\n}');
        expect(formatToolContent('  {"a": 1}  ')).toBe('{\n  "a": 1\n}');
    });

    it("returns non-JSON content unchanged (original whitespace kept)", () => {
        expect(formatToolContent("plain text")).toBe("plain text");
        expect(formatToolContent("  padded  ")).toBe("  padded  ");
    });
});
