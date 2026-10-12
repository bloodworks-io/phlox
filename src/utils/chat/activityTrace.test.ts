import { describe, expect, it } from "vitest";
import { groupActivityTrace } from "./activityTrace";

describe("groupActivityTrace", () => {
    it("passes through empty or null block lists", () => {
        expect(groupActivityTrace([])).toEqual([]);
        expect(groupActivityTrace(null)).toBeNull();
    });

    it("leaves text-only messages untouched (no wrapper)", () => {
        const blocks = [
            { type: "text", content: "hello " },
            { type: "text", content: "world" },
        ];
        expect(groupActivityTrace(blocks)).toEqual(blocks);
    });

    it("wraps consecutive think/tool blocks into a single trace", () => {
        const blocks = [
            { type: "think", content: "reasoning" },
            { type: "tool", content: "{}", attrs: { name: "pubmed" } },
        ];
        const [trace] = groupActivityTrace(blocks);
        expect(trace.type).toBe("activity-trace");
        expect(trace.traceBlocks).toHaveLength(2);
        expect(trace.currentActivity).toEqual({
            label: "PubMed",
            isOngoing: false,
        });
    });

    it("labels think-only traces as Thinking", () => {
        const [trace] = groupActivityTrace([{ type: "think", content: "hmm" }]);
        expect(trace.currentActivity.label).toBe("Thinking");
        expect(trace.currentActivity.isOngoing).toBe(false);
    });

    it("splits into separate traces around meaningful text", () => {
        const result = groupActivityTrace([
            { type: "think", content: "a" },
            { type: "text", content: "Answer to the user" },
            { type: "tool", content: "{}", attrs: { name: "wiki" } },
        ]);
        expect(result).toHaveLength(3);
        expect(result[0].type).toBe("activity-trace");
        expect(result[1]).toEqual({
            type: "text",
            content: "Answer to the user",
        });
        expect(result[2].type).toBe("activity-trace");
        expect(result[2].currentActivity.label).toBe("Wikipedia");
    });

    it("absorbs whitespace-only text between think/tool blocks into the trace", () => {
        const result = groupActivityTrace([
            { type: "think", content: "a" },
            { type: "text", content: "\n  " },
            { type: "tool", content: "{}", attrs: { name: "wiki" } },
        ]);
        expect(result).toHaveLength(1);
        expect(result[0].traceBlocks).toHaveLength(2);
    });

    it("drops leading whitespace that precedes any think/tool block", () => {
        const result = groupActivityTrace([
            { type: "text", content: "  \n" },
            { type: "think", content: "a" },
        ]);
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe("activity-trace");
    });

    it("marks a trace ongoing when its last block is partial (streaming)", () => {
        const result = groupActivityTrace([
            { type: "text", content: "ok" },
            {
                type: "tool",
                content: '{"q',
                attrs: { name: "search_pubmed" },
                isPartial: true,
            },
        ]);
        const trace = result.at(-1);
        expect(trace.type).toBe("activity-trace");
        expect(trace.currentActivity).toEqual({
            label: "PubMed",
            isOngoing: true,
        });
    });

    it("uses the partial block's activity even when it is not last", () => {
        const [trace] = groupActivityTrace([
            { type: "think", content: "partial reasoning", isPartial: true },
            { type: "tool", content: "{}", attrs: { name: "wiki" } },
        ]);
        expect(trace.currentActivity).toEqual({
            label: "Thinking",
            isOngoing: true,
        });
    });

    it("discards whitespace-only traces (no meaningful blocks)", () => {
        const result = groupActivityTrace([
            { type: "text", content: "answer" },
            { type: "text", content: "  " },
        ]);
        expect(result).toEqual([{ type: "text", content: "answer" }]);
    });
});
