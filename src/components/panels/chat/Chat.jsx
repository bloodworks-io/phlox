import React, { useState, useRef, useEffect } from "react";
import ChatPanel from "./ChatPanel";
import FloatingPanel from "../../common/FloatingPanel";
import { useChat } from "../../../utils/hooks/useChat";

const Chat = ({ isOpen, onClose, patientData, currentTemplate, rawTranscription }) => {
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const resizerRef = useRef(null);

  // Chat state lives here now — no parent orchestration.
  const { clearChat, ...chat } = useChat();

  // Self-reset on patient change. Same pattern Letter.jsx uses for
  // useLetterTemplates(patient?.id). clearChat is a no-op on initial mount.
  useEffect(() => {
    clearChat();
  }, [patientData?.id, clearChat]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e) => {
    setDimensions((prev) => ({
      width: Math.max(
        400,
        prev.width -
          (e.clientX - resizerRef.current.getBoundingClientRect().left),
      ),
      height: Math.max(
        300,
        prev.height -
          (e.clientY - resizerRef.current.getBoundingClientRect().top),
      ),
    }));
  };

  const handleMouseUp = () => {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  };

  const handleChat = (userInput) =>
    chat.sendMessage(userInput, patientData, currentTemplate, rawTranscription);

  return (
    <FloatingPanel
      isOpen={isOpen}
      position="left-of-fab"
      showArrow={true}
      triggerId="fab-chat"
      width={`${dimensions.width}px`}
      height={`${dimensions.height - 24}px`}
      zIndex="1060"
    >
      <ChatPanel
        dimensions={dimensions}
        resizerRef={resizerRef}
        handleMouseDown={handleMouseDown}
        onClose={onClose}
        chatLoading={chat.loading}
        messages={chat.messages}
        setMessages={chat.setMessages}
        userInput={chat.userInput}
        setUserInput={chat.setUserInput}
        handleChat={handleChat}
        showSuggestions={chat.showSuggestions}
        setShowSuggestions={chat.setShowSuggestions}
        rawTranscription={rawTranscription}
        currentTemplate={currentTemplate}
        patientData={patientData}
      />
    </FloatingPanel>
  );
};

export default Chat;
