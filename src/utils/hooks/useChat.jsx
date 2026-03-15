import { useState, useCallback } from "react";
import { chatApi } from "../api/chatApi";
import { formatPatientContext } from "../chat/messageUtils";

// Simple mode for RAG chat (no patient/template required)
const RAG_SYSTEM_MESSAGE = {
    role: "system",
    content:
        "The user is a healthcare professional. They will ask you questions about medical treatment and guidelines.",
};

const getClinicianToolActionLabel = (toolName = "") => {
    const normalized = String(toolName).toLowerCase();

    if (normalized.includes("pubmed")) {
        return "Searching PubMed evidence";
    }

    if (normalized.includes("wiki")) {
        return "Reviewing reference material";
    }

    if (normalized.includes("literature")) {
        return "Searching medical literature";
    }

    if (normalized.includes("transcript")) {
        return "Reviewing encounter transcript";
    }

    if (normalized.includes("direct_response")) {
        return "Drafting response";
    }

    return "Consulting medical sources";
};

export const useChat = ({ mode = "patient" } = {}) => {
    const [chatExpanded, setChatExpanded] = useState(false);
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [loading, setLoading] = useState(false);
    const [streamStarted, setStreamStarted] = useState(false);

    const sendMessage = useCallback(
        async (
            input,
            patient = null,
            currentTemplate = null,
            rawTranscription = null,
            attachments = null,
        ) => {
            if (!input.trim() && !attachments) return;

            // For patient mode, require patient and template
            if (mode === "patient" && (!patient || !currentTemplate)) return;

            setLoading(true);
            setStreamStarted(false);
            setChatExpanded(true);

            // Build content for API (includes extracted text from attachments)
            let contentForApi = input.trim();
            if (attachments && attachments.length > 0) {
                const attachmentTexts = attachments.map(
                    (att) =>
                        `[Content extracted from ${att.filename}]:\n${att.extractedText}`,
                );
                contentForApi = contentForApi
                    ? `${contentForApi}\n\n${attachmentTexts.join("\n\n")}`
                    : attachmentTexts.join("\n\n");
            }

            // Add user message to UI (attachments shown as chips, not inline text)
            const userMessage = {
                role: "user",
                content: input.trim(),
                attachments: attachments,
            };
            setMessages((prev) => [...prev, userMessage]);

            // Message for API includes extracted text
            const userMessageForApi = { role: "user", content: contentForApi };

            // Clear input immediately when sending
            setUserInput("");
            setShowSuggestions(false);

            try {
                let initialMessage;
                let patientContext = null;

                if (mode === "rag") {
                    initialMessage = RAG_SYSTEM_MESSAGE;
                } else {
                    // Format patient context for the backend to build the system message
                    patientContext = formatPatientContext(
                        currentTemplate,
                        patient,
                    );
                    if (!patientContext) {
                        throw new Error("Failed to format patient context");
                    }
                    // No initial message needed - backend will build system message from patient context
                    initialMessage = null;
                }

                // Messages for API are just the conversation history (no initial message with patient data)
                // Use userMessageForApi which includes extracted attachment text
                const messagesForApi = initialMessage
                    ? [initialMessage, ...messages, userMessageForApi]
                    : [...messages, userMessageForApi];

                let fullContent = "";

                // Add placeholder assistant message with loading state
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        content: "",
                        loading: true,
                    },
                ]);

                // Stream the response
                for await (const chunk of chatApi.streamMessage(
                    messagesForApi,
                    rawTranscription,
                    patientContext,
                )) {
                    if (
                        !streamStarted &&
                        (chunk.type === "chunk" || chunk.type === "status")
                    ) {
                        setStreamStarted(true);
                        setLoading(false);
                    }

                    if (chunk.type === "chunk") {
                        // Create a local copy of fullContent to use in the closure
                        const newContent = fullContent + chunk.content;
                        fullContent = newContent; // Update fullContent after creating the local copy

                        setMessages((prev) => {
                            const newMessages = [...prev];
                            const lastMessage =
                                newMessages[newMessages.length - 1];
                            newMessages[newMessages.length - 1] = {
                                ...lastMessage, // Preserve existing properties like isThinkingExpanded
                                role: "assistant",
                                content: newContent,
                                loading: false,
                            };
                            return newMessages;
                        });
                    } else if (chunk.type === "status" && chunk.content) {
                        const statusText = chunk.content.trim();

                        const callMatch = statusText.match(
                            /^Calling tool:\s*([^|]+?)(?:\s*\|\s*query:\s*(.+))?$/i,
                        );

                        // Only render tool UI blocks for explicit tool-call status events.
                        if (!callMatch) {
                            continue;
                        }

                        const toolName = (callMatch[1] ?? "")
                            .replace(/\s+/g, " ")
                            .trim()
                            .replace(/^["'`]+|["'`]+$/g, "")
                            .replace(/"/g, "'");

                        const toolQuery = (callMatch[2] ?? "")
                            .replace(/\s+/g, " ")
                            .trim()
                            .replace(/"/g, "'");

                        const actionLabel =
                            getClinicianToolActionLabel(toolName);
                        const clinicianStatusText = toolQuery
                            ? `${actionLabel}: ${toolQuery}`
                            : actionLabel;

                        const escapeAttr = (value = "") =>
                            String(value)
                                .replace(/&/g, "&amp;")
                                .replace(/"/g, "&quot;")
                                .replace(/</g, "&lt;")
                                .replace(/>/g, "&gt;");

                        const toolTag = `<tool name="${escapeAttr(toolName)}" status="running"${toolQuery ? ` query="${escapeAttr(toolQuery)}"` : ""}>${clinicianStatusText}</tool>`;

                        const newContent = `${fullContent}\n${toolTag}\n`;
                        fullContent = newContent;

                        setMessages((prev) => {
                            const newMessages = [...prev];
                            const lastMessage =
                                newMessages[newMessages.length - 1];
                            newMessages[newMessages.length - 1] = {
                                ...lastMessage,
                                role: "assistant",
                                content: newContent,
                                loading: false,
                            };
                            return newMessages;
                        });
                    } else if (chunk.type === "context") {
                        setMessages((prev) => {
                            const newMessages = [...prev];
                            newMessages[newMessages.length - 1] = {
                                ...newMessages[newMessages.length - 1],
                                context: chunk.content,
                                loading: false,
                            };
                            return newMessages;
                        });
                    }
                }
            } catch (error) {
                console.error("Error in chat:", error);
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: `Error: ${error.message}` },
                ]);
            } finally {
                setLoading(false);
                setStreamStarted(false);
            }
        },
        [messages, mode],
    );

    const clearChat = useCallback(() => {
        setMessages([]);
        setUserInput("");
        setShowSuggestions(true);
    }, []);

    return {
        chatExpanded,
        setChatExpanded,
        messages,
        setMessages,
        userInput,
        setUserInput,
        showSuggestions,
        setShowSuggestions,
        loading,
        sendMessage,
        clearChat,
    };
};
