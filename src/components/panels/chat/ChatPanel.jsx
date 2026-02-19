import React, { useEffect, useRef, useState } from "react";
import { Box, Text } from "@chakra-ui/react";
import ChatHeader from "./ChatHeader";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import ChatSuggestions from "./ChatSuggestions";
import QuickChatButtons from "./QuickChatButtons";
import { buildApiUrl } from "../../../utils/helpers/apiConfig";
import { universalFetch } from "../../../utils/helpers/apiHelpers";

const ChatPanel = ({
  dimensions,
  resizerRef,
  handleMouseDown,
  onClose,
  chatLoading,
  messages,
  setMessages,
  userInput,
  setUserInput,
  handleChat,
  showSuggestions,
  setShowSuggestions,
  rawTranscription,
  currentTemplate,
  patientData,
}) => {
  const [userSettings, setUserSettings] = useState(null);
  const messagesEndRef = useRef(null);
  const filteredMessages = messages.filter((m) => m.role !== "system");

  const toggleThinkingVisibility = (idx) => {
    setMessages((prev) =>
      prev.map((msg, i) =>
        i === idx
          ? { ...msg, isThinkingExpanded: !msg.isThinkingExpanded }
          : msg,
      ),
    );
  };

  useEffect(() => {
    const fetchUserSettings = async () => {
      try {
        const response = await universalFetch(
          await buildApiUrl("/api/config/user"),
        );
        if (!response.ok) throw new Error();
        const data = await response.json();
        setUserSettings(data);
      } catch (error) {
        console.error(error);
      }
    };
    fetchUserSettings();
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = (text) => {
    if (!text.trim()) return;
    handleChat(text, messages, patientData, currentTemplate, rawTranscription);
    setUserInput("");
    setShowSuggestions(false);
  };

  const shouldShowQuickChatButtons =
    filteredMessages.length > 0 && userSettings;

  return (
    <Box
      width={`${dimensions.width}px`}
      height={`${dimensions.height - 24}px`}
      overflow="hidden"
      display="flex"
      flexDirection="column"
    >
      <ChatHeader onClose={onClose} />

      <Box flex="1" overflowY="auto" p="4" className="floating-main">
        <ChatMessages
          messages={messages}
          toggleThinkingVisibility={toggleThinkingVisibility}
        />

        {showSuggestions && filteredMessages.length === 0 && userSettings && (
          <ChatSuggestions
            handleSendMessage={handleSendMessage}
            userSettings={userSettings}
          />
        )}

        <div ref={messagesEndRef} />
      </Box>

      <Box p="3" borderTopWidth="1px" borderColor="inherit">
        {shouldShowQuickChatButtons && (
          <QuickChatButtons
            userSettings={userSettings}
            handleSendMessage={handleSendMessage}
          />
        )}

        <ChatInput
          userInput={userInput}
          setUserInput={setUserInput}
          handleSendMessage={handleSendMessage}
          chatLoading={chatLoading}
        />

        <Text textAlign="center" fontSize="xs" color="gray.500">
          Phlox may make mistakes. Always verify critical information.
        </Text>
      </Box>

      <Box
        ref={resizerRef}
        position="absolute"
        top="0"
        left="0"
        width="15px"
        height="15px"
        cursor="nwse-resize"
        onMouseDown={handleMouseDown}
        zIndex={1}
      />
    </Box>
  );
};

export default ChatPanel;
