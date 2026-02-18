import { useState, useCallback } from "react";
import { chatApi } from "../api/chatApi";
import { formatInitialMessage } from "../chat/messageUtils";

// Simple mode for RAG chat (no patient/template required)
const RAG_SYSTEM_MESSAGE = {
  role: "system",
  content:
    "The user is a healthcare professional. They will ask you questions about medical treatment and guidelines.",
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
    ) => {
      if (!input.trim()) return;

      // For patient mode, require patient and template
      if (mode === "patient" && (!patient || !currentTemplate)) return;

      setLoading(true);
      setStreamStarted(false);
      setChatExpanded(true);

      // Add user message to UI immediately
      const userMessage = { role: "user", content: input };
      setMessages((prev) => [...prev, userMessage]);

      // Clear input immediately when sending
      setUserInput("");
      setShowSuggestions(false);

      try {
        let initialMessage;

        if (mode === "rag") {
          initialMessage = RAG_SYSTEM_MESSAGE;
        } else {
          initialMessage = formatInitialMessage(currentTemplate, patient);
          if (!initialMessage) {
            throw new Error("Failed to format patient context");
          }
        }

        const messagesForApi = [initialMessage, ...messages, userMessage];

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
        )) {
          if (!streamStarted && chunk.type === "chunk") {
            setStreamStarted(true);
            setLoading(false);
          }

          if (chunk.type === "chunk") {
            // Create a local copy of fullContent to use in the closure
            const newContent = fullContent + chunk.content;
            fullContent = newContent; // Update fullContent after creating the local copy

            setMessages((prev) => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              newMessages[newMessages.length - 1] = {
                ...lastMessage, // Preserve existing properties like isThinkingExpanded
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
