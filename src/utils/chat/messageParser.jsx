const THINK_OPEN = "<think>";
const THINK_CLOSE = "</think>";
const TOOL_OPEN_MATCHER = /<tool\b([^>]*)>/i;
const TOOL_CLOSE = "</tool>";

const normalizeNewlines = (value = "") => String(value).replace(/\r\n/g, "\n");

const decodeHtmlEntities = (value = "") =>
    String(value)
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");

const parseToolAttributes = (raw = "") => {
    const attrs = {};
    const attrRegex =
        /([a-zA-Z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

    let match = attrRegex.exec(raw);
    while (match) {
        const [, key, dQuoted, sQuoted, bare] = match;
        attrs[key] = decodeHtmlEntities(dQuoted ?? sQuoted ?? bare ?? "");
        match = attrRegex.exec(raw);
    }

    return attrs;
};

const findLastToolOpenTag = (content) => {
    const matches = [...content.matchAll(/<tool\b[^>]*>/gi)];
    if (matches.length === 0) return null;

    const last = matches[matches.length - 1];
    return {
        index: last.index ?? -1,
        openTag: last[0],
    };
};

/**
 * Parse chat content into structured blocks only.
 *
 * Output shape:
 * {
 *   blocks: Array<{
 *     type: "text" | "think" | "tool",
 *     content: string,
 *     attrs?: Record<string, string>,
 *     isPartial?: boolean,
 *   }>,
 *   hasThinkBlocks: boolean,
 *   hasToolBlocks: boolean,
 *   hasPartialBlock: boolean,
 *   partialBlockType: "think" | "tool" | null,
 *   visibleText: string
 * }
 */
export const parseMessageContent = (rawContent) => {
    const content = normalizeNewlines(rawContent ?? "");
    const blocks = [];

    const closedBlockRegex =
        /<think>([\s\S]*?)<\/think>|<tool\b([^>]*)>([\s\S]*?)<\/tool>/gi;

    let lastIndex = 0;
    let match = closedBlockRegex.exec(content);

    while (match) {
        const full = match[0];
        const start = match.index;
        const end = start + full.length;

        if (start > lastIndex) {
            blocks.push({
                type: "text",
                content: content.slice(lastIndex, start),
            });
        }

        if (typeof match[1] === "string") {
            blocks.push({
                type: "think",
                content: match[1],
                isPartial: false,
            });
        } else {
            const attrsRaw = match[2] ?? "";
            const toolInner = match[3] ?? "";
            blocks.push({
                type: "tool",
                content: toolInner,
                attrs: parseToolAttributes(attrsRaw),
                isPartial: false,
            });
        }

        lastIndex = end;
        match = closedBlockRegex.exec(content);
    }

    if (lastIndex < content.length) {
        const remainder = content.slice(lastIndex);

        const thinkOpenIndex = remainder.lastIndexOf(THINK_OPEN);
        const thinkCloseAfterOpen =
            thinkOpenIndex >= 0
                ? remainder.indexOf(
                      THINK_CLOSE,
                      thinkOpenIndex + THINK_OPEN.length,
                  )
                : -1;

        const toolOpen = findLastToolOpenTag(remainder);
        const toolCloseAfterOpen =
            toolOpen && toolOpen.index >= 0
                ? remainder.indexOf(
                      TOOL_CLOSE,
                      toolOpen.index + toolOpen.openTag.length,
                  )
                : -1;

        const hasPartialThink =
            thinkOpenIndex >= 0 && thinkCloseAfterOpen === -1;
        const hasPartialTool = !!toolOpen && toolCloseAfterOpen === -1;

        let activePartial = null;

        if (hasPartialThink && hasPartialTool) {
            activePartial =
                thinkOpenIndex > toolOpen.index
                    ? { type: "think", index: thinkOpenIndex }
                    : {
                          type: "tool",
                          index: toolOpen.index,
                          openTag: toolOpen.openTag,
                      };
        } else if (hasPartialThink) {
            activePartial = { type: "think", index: thinkOpenIndex };
        } else if (hasPartialTool) {
            activePartial = {
                type: "tool",
                index: toolOpen.index,
                openTag: toolOpen.openTag,
            };
        }

        if (!activePartial) {
            blocks.push({
                type: "text",
                content: remainder,
            });
        } else if (activePartial.type === "think") {
            if (activePartial.index > 0) {
                blocks.push({
                    type: "text",
                    content: remainder.slice(0, activePartial.index),
                });
            }

            blocks.push({
                type: "think",
                content: remainder.slice(
                    activePartial.index + THINK_OPEN.length,
                ),
                isPartial: true,
            });
        } else {
            const openTag = activePartial.openTag;
            const openTagStart = activePartial.index;
            const openTagEnd = openTagStart + openTag.length;

            if (openTagStart > 0) {
                blocks.push({
                    type: "text",
                    content: remainder.slice(0, openTagStart),
                });
            }

            const attrPartMatch = openTag.match(TOOL_OPEN_MATCHER);
            const rawAttrs = attrPartMatch?.[1] ?? "";

            blocks.push({
                type: "tool",
                content: remainder.slice(openTagEnd),
                attrs: parseToolAttributes(rawAttrs),
                isPartial: true,
            });
        }
    }

    const hasThinkBlocks = blocks.some((b) => b.type === "think");
    const hasToolBlocks = blocks.some((b) => b.type === "tool");
    const partialBlock = blocks.find((b) => b.isPartial);

    return {
        blocks,
        hasThinkBlocks,
        hasToolBlocks,
        hasPartialBlock: Boolean(partialBlock),
        partialBlockType: partialBlock?.type ?? null,
        visibleText: blocks
            .filter((b) => b.type === "text")
            .map((b) => b.content)
            .join(""),
    };
};

export default parseMessageContent;
