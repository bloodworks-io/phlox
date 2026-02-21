import React, { useState, useRef } from "react";
import ChatPanel from "./ChatPanel";
import FloatingPanel from "../../common/FloatingPanel";

const Chat = ({
  isOpen,
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
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const resizerRef = useRef(null);

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
        chatLoading={chatLoading}
        messages={messages}
        setMessages={setMessages}
        userInput={userInput}
        setUserInput={setUserInput}
        handleChat={handleChat}
        showSuggestions={showSuggestions}
        setShowSuggestions={setShowSuggestions}
        rawTranscription={rawTranscription}
        currentTemplate={currentTemplate}
        patientData={patientData}
      />
    </FloatingPanel>
  );
};

export default Chat;
