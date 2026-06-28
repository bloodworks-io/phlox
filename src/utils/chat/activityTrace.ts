import { getToolName, getToolPresentation } from "./toolPresentation";

const THINK_OR_TOOL = new Set(["think", "tool"]);

/**
 * Determine the current activity label for a single block.
 * Think blocks → "Thinking"
 * Tool blocks → label from getToolPresentation (e.g., "PubMed", "Wikipedia")
 */
const getBlockActivity = (block) => {
    if (block.type === "think") {
        return { label: "Thinking" };
    }
    if (block.type === "tool") {
        const toolName = getToolName(block);
        const presentation = getToolPresentation(toolName);
        return { label: presentation.label };
    }
    return { label: "" };
};

/**
 * Group consecutive think+tool blocks into activity-trace wrapper blocks.
 * Whitespace-only text blocks between think/tool blocks are absorbed into
 * the trace group rather than splitting it.
 * Meaningful text blocks pass through untouched.
 *
 * @param {Array} blocks - output of parseMessageContent()
 * @returns {Array} blocks with activity-trace wrappers
 */
export const groupActivityTrace = (blocks) => {
    if (!blocks || blocks.length === 0) return blocks;

    const result = [];
    let traceGroup = null;

    const flushTrace = () => {
        if (!traceGroup || traceGroup.length === 0) return;

        // Filter out whitespace-only text blocks from the trace
        const meaningful = traceGroup.filter(
            (b) => !b.isWhitespacePadding,
        );

        if (meaningful.length === 0) {
            traceGroup = null;
            return;
        }

        const anyPartial = meaningful.some((b) => b.isPartial);
        const lastBlock = meaningful[meaningful.length - 1];
        const activity = getBlockActivity(
            anyPartial
                ? meaningful.find((b) => b.isPartial) ?? lastBlock
                : lastBlock,
        );

        result.push({
            type: "activity-trace",
            traceBlocks: meaningful,
            currentActivity: {
                label: activity.label,
                isOngoing: anyPartial,
            },
        });
        traceGroup = null;
    };

    for (const block of blocks) {
        if (THINK_OR_TOOL.has(block.type)) {
            if (!traceGroup) traceGroup = [];
            traceGroup.push(block);
        } else if (
            block.type === "text" &&
            !block.content?.trim()
        ) {
            // Whitespace-only text — absorb into current trace group
            if (traceGroup) {
                traceGroup.push({ ...block, isWhitespacePadding: true });
            }
            // If no trace group yet, just skip leading whitespace
        } else {
            flushTrace();
            result.push(block);
        }
    }

    flushTrace();
    return result;
};
