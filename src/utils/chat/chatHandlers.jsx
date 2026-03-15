import { chatApi } from "../api/chatApi";
import {
    validateInput,
    formatPatientContext,
    // truncateConversationHistory, // We might integrate truncation later if needed
} from "./messageUtils";

export const handleChat = async (
    userInput,
    // Receive the full current messages state
    currentMessages, // Renamed for clarity
    setChatLoading,
    setMessages,
    setUserInput,
    setChatExpanded,
    // setIsSummaryCollapsed, // This seems unrelated to chat, remove if not used here
    patientData,
    currentTemplate,
    rawTranscription, // Keep rawTranscription if used by API
) => {
    if (!validateInput(userInput)) return;
    if (!patientData || !currentTemplate) {
        console.error("Patient data or template missing for chat context");
        // Optionally inform the user via a message
        setMessages((prev) => [
            ...prev,
            {
                role: "assistant",
                content:
                    "Sorry, I need patient data and a template loaded to chat.",
            },
        ]);
        return;
    }

    setChatLoading(true);
    setChatExpanded(true); // Ensure chat expands on send

    // Add the user's message optimistically
    const newUserMessage = { role: "user", content: userInput };
    setMessages((prev) => [...prev, newUserMessage]);
    setUserInput(""); // Clear input immediately

    // Format patient context for the backend to build the system message
    const patientContext = formatPatientContext(currentTemplate, patientData);
    if (!patientContext) {
        console.error("Failed to format patient context");
        setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Error preparing context for chat." },
        ]);
        setChatLoading(false);
        return;
    }

    // Use the state *before* adding the assistant's placeholder
    // Messages are just the conversation history (no initial message with patient data)
    const messagesForApi = [
        // Filter out any previous assistant error messages if needed
        ...currentMessages.filter(
            (msg) =>
                !(msg.role === "assistant" && msg.content.startsWith("Error:")),
        ),
        newUserMessage, // Include the latest user message
    ];

    // Add a placeholder for the assistant's response *before* the API call
    const assistantPlaceholder = {
        role: "assistant",
        content: "",
        loading: true,
    };
    setMessages((prev) => [...prev, assistantPlaceholder]);

    console.log("Sending messages to API:", messagesForApi); // Log the array being sent

    try {
        let streamedContent = "";
        let streamedContext = null;
        let finalResponseReceived = false;

        // Stream the response
        for await (const chunk of chatApi.streamMessage(
            messagesForApi,
            rawTranscription,
            patientContext,
        )) {
            if (chunk.type === "chunk" && chunk.content) {
                streamedContent += chunk.content;
            } else if (chunk.type === "status" && chunk.content) {
                const statusText = chunk.content.trim();

                const callMatch = statusText.match(
                    /^Calling tool:\s*([^|]+?)(?:\s*\|\s*query:\s*(.+))?$/i,
                );

                // Only render UI tool blocks for explicit tool-call status events.
                // Ignore follow-up generic status messages to prevent duplicate cards.
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

                const toClinicianActionLabel = (name) => {
                    const normalized = String(name || "").toLowerCase();

                    if (normalized.includes("pubmed")) {
                        return "Searching PubMed for supporting evidence";
                    }
                    if (normalized.includes("wiki")) {
                        return "Checking background reference information";
                    }
                    if (normalized.includes("literature")) {
                        return "Searching medical literature";
                    }
                    if (normalized.includes("transcript")) {
                        return "Reviewing encounter transcript";
                    }
                    if (normalized.includes("direct_response")) {
                        return "Preparing response";
                    }

                    return "Gathering supporting information";
                };

                const clinicianStatusText = `${toClinicianActionLabel(toolName)}...`;

                const escapeAttr = (value = "") =>
                    String(value)
                        .replace(/&/g, "&amp;")
                        .replace(/"/g, "&quot;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;");

                if (toolName) {
                    const nameAttr = escapeAttr(toolName);
                    const queryAttr = toolQuery
                        ? ` query="${escapeAttr(toolQuery)}"`
                        : "";
                    streamedContent += `\n<tool name="${nameAttr}" status="running"${queryAttr}>${clinicianStatusText}</tool>\n`;
                }
            } else if (
                chunk.type === "context" ||
                (chunk.type === "end" && chunk.function_response)
            ) {
                // Assuming 'context' type or function_response contains the context object/array
                const contextData = chunk.context || chunk.function_response;
                if (Array.isArray(contextData)) {
                    // Convert array to object if necessary
                    streamedContext = Object.fromEntries(
                        contextData.map((item, index) => [
                            (index + 1).toString(),
                            item,
                        ]),
                    );
                } else if (
                    typeof contextData === "object" &&
                    contextData !== null
                ) {
                    streamedContext = contextData;
                }
            } else if (chunk.type === "end") {
                finalResponseReceived = true;
            }

            // Update the last message (the placeholder) in the state
            setMessages((prev) => {
                const updatedMessages = [...prev];
                const lastMessageIndex = updatedMessages.length - 1;

                if (
                    lastMessageIndex >= 0 &&
                    updatedMessages[lastMessageIndex].role === "assistant"
                ) {
                    updatedMessages[lastMessageIndex] = {
                        ...updatedMessages[lastMessageIndex],
                        content: streamedContent, // Update content cumulatively
                        context: streamedContext, // Update context if received
                        loading: !finalResponseReceived, // Set loading to false only when 'end' is received
                    };
                    // If stream finished, remove loading and potentially set final state
                    if (finalResponseReceived) {
                        delete updatedMessages[lastMessageIndex].loading; // Remove loading prop
                    }
                }
                return updatedMessages;
            });
        }

        // Final update in case the stream ends without an 'end' marker but is done nonetheless
        setMessages((prev) => {
            const updatedMessages = [...prev];
            const lastMessageIndex = updatedMessages.length - 1;

            if (
                lastMessageIndex >= 0 &&
                updatedMessages[lastMessageIndex].role === "assistant" &&
                updatedMessages[lastMessageIndex].loading
            ) {
                delete updatedMessages[lastMessageIndex].loading; // Ensure loading is removed
            }
            return updatedMessages;
        });
    } catch (error) {
        console.error("Error in chat:", error);
        // Replace the assistant placeholder with an error message
        setMessages((prev) => {
            const updatedMessages = [...prev];
            const lastIndex = updatedMessages.length - 1;

            if (
                lastIndex >= 0 &&
                updatedMessages[lastIndex].role === "assistant" &&
                updatedMessages[lastIndex].loading
            ) {
                // Replace the loading placeholder with the error
                updatedMessages[lastIndex] = {
                    role: "assistant",
                    content: `Error: ${error.message || "Communication error with assistant. Please try again."}`,
                };
            } else {
                // In case the loading placeholder was somehow removed, add a new error message
                updatedMessages.push({
                    role: "assistant",
                    content: `Error: ${error.message || "Communication error with assistant. Please try again."}`,
                });
            }
            return updatedMessages;
        });
    } finally {
        setChatLoading(false);
    }
};
