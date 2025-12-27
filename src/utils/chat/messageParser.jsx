import { React } from "react";

/**
 * Parses a message string for <think> tags, extracting sections before, inside, and after the tag.
 * Supports streaming scenarios by handling unclosed tags.
 *
 * @param {string} content - The full message content to parse.
 * @returns {object} An object describing parsed sections:
 *                   - hasThinkTag: boolean
 *                   - beforeContent: string (text before the think block)
 *                   - thinkContent: string (text inside the think block)
 *                   - afterContent: string (text after the think block)
 *                   - isPartialThinking?: boolean (true if think block is not closed)
 */
export const parseMessageContent = (content) => {
    const thinkRegex = /<think>(.*?)<\/think>/s;
    const match = content.match(thinkRegex);

    if (match) {
        const thinkContent = match[1].trim();
        const parts = content.split(match[0]);
        const beforeContent = parts[0].trim();
        const afterContent = parts.slice(1).join(match[0]).trim();

        return {
            hasThinkTag: true,
            beforeContent,
            thinkContent,
            afterContent,
        };
    }

    // Change this regex to be greedy and handle the trimming more carefully
    const openThinkMatch = content.match(/<think>(.*)$/s);
    if (openThinkMatch) {
        const beforeContent = content.split("<think>")[0].trim();
        // Don't trim the partial content - preserve whitespace during streaming
        const partialThinkContent = openThinkMatch[1];

        return {
            hasThinkTag: true,
            beforeContent,
            thinkContent: partialThinkContent,
            afterContent: "",
            isPartialThinking: true,
        };
    }

    return {
        hasThinkTag: false,
        content,
    };
};
