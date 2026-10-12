import { describe, expect, it } from "vitest";
import {
    parseMessageContent,
    expandCitationNumbers,
    buildCitationRemap,
    extractCitedIndices,
} from "./messageParser";

describe("parseMessageContent", () => {
    it("returns a single text block for plain content", () => {
        const result = parseMessageContent("hello world");
        expect(result.blocks).toEqual([{ type: "text", content: "hello world" }]);
        expect(result.hasThinkBlocks).toBe(false);
        expect(result.hasToolBlocks).toBe(false);
        expect(result.hasPartialBlock).toBe(false);
        expect(result.partialBlockType).toBeNull();
        expect(result.visibleText).toBe("hello world");
    });

    it("handles null/undefined input", () => {
        const result = parseMessageContent(null);
        expect(result.blocks).toEqual([]);
        expect(result.visibleText).toBe("");
    });

    it("extracts closed think blocks", () => {
        const result = parseMessageContent("a<think>reasoning</think>b");
        expect(result.blocks).toEqual([
            { type: "text", content: "a" },
            { type: "think", content: "reasoning", isPartial: false },
            { type: "text", content: "b" },
        ]);
        expect(result.hasThinkBlocks).toBe(true);
        expect(result.visibleText).toBe("ab");
    });

    it("extracts closed tool blocks with parsed attributes", () => {
        const result = parseMessageContent(
            '<tool name="search_pubmed" query=\'heart failure\'>result</tool>',
        );
        expect(result.blocks).toEqual([
            {
                type: "tool",
                content: "result",
                attrs: { name: "search_pubmed", query: "heart failure" },
                isPartial: false,
            },
        ]);
        expect(result.hasToolBlocks).toBe(true);
    });

    it("parses bare (unquoted) attribute values", () => {
        const result = parseMessageContent('<tool id=abc123>data</tool>');
        expect(result.blocks[0].attrs).toEqual({ id: "abc123" });
    });

    it("decodes HTML entities in attribute values", () => {
        const result = parseMessageContent(
            "<tool name=&quot;q&amp;a&quot; note=&#39;s&#39;>x</tool>",
        );
        expect(result.blocks[0].attrs).toEqual({ name: '"q&a"', note: "'s'" });
    });

    it("keeps text between multiple closed blocks in order", () => {
        const result = parseMessageContent(
            "start<think>a</think>mid<tool name=\"t\">b</tool>end",
        );
        expect(result.blocks.map((b) => b.type)).toEqual([
            "text",
            "think",
            "text",
            "tool",
            "text",
        ]);
        expect(result.visibleText).toBe("startmidend");
    });

    it("normalizes CRLF to LF before parsing", () => {
        const result = parseMessageContent("a\r\n<think>x\r\ny</think>\r\nb");
        expect(result.blocks).toEqual([
            { type: "text", content: "a\n" },
            { type: "think", content: "x\ny", isPartial: false },
            { type: "text", content: "\nb" },
        ]);
    });

    it("marks an unterminated think block as partial (streaming)", () => {
        const result = parseMessageContent("hi<think>partial");
        expect(result.blocks).toEqual([
            { type: "text", content: "hi" },
            { type: "think", content: "partial", isPartial: true },
        ]);
        expect(result.hasPartialBlock).toBe(true);
        expect(result.partialBlockType).toBe("think");
        expect(result.visibleText).toBe("hi");
    });

    it("marks an unterminated tool block as partial with its attributes", () => {
        const result = parseMessageContent('hi<tool name="search">{"q');
        expect(result.blocks).toEqual([
            { type: "text", content: "hi" },
            {
                type: "tool",
                content: '{"q',
                attrs: { name: "search" },
                isPartial: true,
            },
        ]);
        expect(result.partialBlockType).toBe("tool");
    });

    it("treats the later unclosed tag as the active partial when both are open", () => {
        const toolLast = parseMessageContent(
            '<think>abc<tool name="x">data',
        );
        expect(toolLast.partialBlockType).toBe("tool");
        expect(toolLast.blocks).toEqual([
            // The unterminated <think> has no close, so it falls into the text run
            { type: "text", content: "<think>abc" },
            {
                type: "tool",
                content: "data",
                attrs: { name: "x" },
                isPartial: true,
            },
        ]);

        const thinkLast = parseMessageContent(
            '<tool name="x">abc<think>reasoning',
        );
        expect(thinkLast.partialBlockType).toBe("think");
        expect(thinkLast.blocks[0]).toEqual({
            type: "text",
            content: '<tool name="x">abc',
        });
        expect(thinkLast.blocks[1]).toEqual({
            type: "think",
            content: "reasoning",
            isPartial: true,
        });
    });
});

describe("expandCitationNumbers", () => {
    it("expands single numbers", () => {
        expect(expandCitationNumbers("1")).toEqual([1]);
    });

    it("expands comma-separated lists", () => {
        expect(expandCitationNumbers("1, 3,5")).toEqual([1, 3, 5]);
    });

    it("expands ranges inclusively", () => {
        expect(expandCitationNumbers("2-4")).toEqual([2, 3, 4]);
    });

    it("normalizes reversed ranges", () => {
        expect(expandCitationNumbers("4-2")).toEqual([2, 3, 4]);
    });

    it("skips non-numeric parts", () => {
        expect(expandCitationNumbers("1, x, 7")).toEqual([1, 7]);
        expect(expandCitationNumbers("")).toEqual([]);
    });
});

describe("buildCitationRemap", () => {
    it("maps cited originals to contiguous numbers in first-seen order", () => {
        const { remap, citedOriginals } = buildCitationRemap(
            "see [2] and [1] then [2] again",
        );
        expect(citedOriginals).toEqual([2, 1]);
        expect(remap.get(2)).toBe(1);
        expect(remap.get(1)).toBe(2);
    });

    it("deduplicates numbers across ranges and lists", () => {
        const { remap, citedOriginals } = buildCitationRemap(
            "refs [1-3] and [2]",
        );
        expect(citedOriginals).toEqual([1, 2, 3]);
        expect(remap.get(1)).toBe(1);
        expect(remap.get(2)).toBe(2);
        expect(remap.get(3)).toBe(3);
    });

    it("returns empty results for text without citations", () => {
        const { remap, citedOriginals } = buildCitationRemap("no refs here");
        expect(remap.size).toBe(0);
        expect(citedOriginals).toEqual([]);
    });
});

describe("extractCitedIndices", () => {
    it("collects a deduplicated set across ranges and lists", () => {
        expect(extractCitedIndices("[1] and [3-4] and [1]")).toEqual(
            new Set([1, 3, 4]),
        );
    });

    it("returns an empty set for text without citations", () => {
        expect(extractCitedIndices("nothing")).toEqual(new Set());
    });
});
