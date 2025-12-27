import { encodingForModel } from "js-tiktoken";
import { letterApi } from "../api/letterApi";

const enc = encodingForModel("gpt-4o");

export const truncateLetterContext = (messages, maxTokens) => {
    // Helper to count tokens for a single message
    const countTokens = (msg) => {
        return enc.encode(`${msg.role}: ${msg.content}`).length;
    };

    // Calculate total tokens
    let totalTokens = messages.reduce((sum, msg) => sum + countTokens(msg), 0);

    // Create a working copy of messages
    let workingMessages = [...messages];

    // Keep removing pairs until we're under the token limit
    while (totalTokens > maxTokens && workingMessages.length > 2) {
        // Find the first assistant message
        const firstAssistantIndex = workingMessages.findIndex(
            (msg) => msg.role === "assistant",
        );

        // Find the second assistant message (if it exists)
        const secondAssistantIndex = workingMessages.findIndex(
            (msg, index) =>
                msg.role === "assistant" && index > firstAssistantIndex,
        );

        if (secondAssistantIndex !== -1) {
            // If we have at least two assistant messages, remove everything between them
            // (which would be the assistant message and its corresponding user message)
            const removed = workingMessages.splice(
                firstAssistantIndex,
                secondAssistantIndex - firstAssistantIndex,
            );
            totalTokens -= removed.reduce(
                (sum, msg) => sum + countTokens(msg),
                0,
            );
        } else {
            // If we only have one assistant message left, we're done truncating
            break;
        }
    }

    // Ensure we start with an assistant message
    const firstAssistantIndex = workingMessages.findIndex(
        (msg) => msg.role === "assistant",
    );
    if (firstAssistantIndex > 0) {
        // Remove any messages before the first assistant message
        workingMessages.splice(0, firstAssistantIndex);
    }

    return workingMessages;
};

// New utility functions
export const autoResizeTextarea = (textarea) => {
    if (textarea) {
        textarea.style.height = "auto";
        textarea.style.height = textarea.scrollHeight + "px";
    }
};

export const formatLetterContent = (content) => {
    if (!content) return "No letter attached to encounter";
    return content;
};

export const getDefaultInstructions = async () => {
    try {
        const responseTemplates = await letterApi.fetchLetterTemplates();
        if (responseTemplates && responseTemplates.default_template_id) {
            const defaultTemplate = responseTemplates.templates.find(
                (tpl) => tpl.id === responseTemplates.default_template_id,
            );
            if (defaultTemplate) {
                return defaultTemplate.instructions || "";
            }
        }
        return "";
    } catch (error) {
        console.error("Error getting default instructions:", error);
        return "";
    }
};
