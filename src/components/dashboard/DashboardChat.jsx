import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  IconButton,
  Tooltip,
  Spinner,
  Button,
  Collapse,
  Badge,
  Icon,
} from "@chakra-ui/react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  InfoIcon,
  SearchIcon,
  QuestionIcon,
  AttachmentIcon,
} from "@chakra-ui/icons";
import { FaFilePdf, FaFileImage } from "react-icons/fa";
import { useChat } from "../../utils/hooks/useChat";
import DashboardChatInput from "./DashboardChatInput";
import MarkdownRenderer from "../common/MarkdownRenderer";
import { universalFetch } from "../../utils/helpers/apiHelpers";
import { buildApiUrl } from "../../utils/helpers/apiConfig";
import { parseMessageContent } from "../../utils/chat/messageParser";
import { chatApi } from "../../utils/api/chatApi";

const DashboardChat = () => {
  const {
    messages,
    setMessages,
    userInput,
    setUserInput,
    showSuggestions,
    setShowSuggestions,
    loading: chatLoading,
    sendMessage,
  } = useChat({ mode: "rag" });

  const messagesEndRef = useRef(null);
  const [showTooltip, setShowTooltip] = useState(null);
  const [ragSuggestions, setRagSuggestions] = useState([]);
  const [pendingImage, setPendingImage] = useState(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Filter out system messages for rendering
  const visibleMessages = messages.filter((msg) => msg.role !== "system");

  // Determine if chat has started
  const hasMessages = visibleMessages.length > 0;

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current && hasMessages) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, hasMessages]);

  // Fetch suggestions on mount
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const settingsResponse = await universalFetch(
          await buildApiUrl("/api/config/user"),
        );
        const userSettings = await settingsResponse.json();
        if (userSettings.specialty) {
          const response = await universalFetch(
            await buildApiUrl(`/api/rag/suggestions`),
          );
          if (!response.ok) throw new Error("Failed to fetch suggestions");
          const data = await response.json();
          setRagSuggestions(data.suggestions);
        }
      } catch (error) {
        console.error("Error fetching RAG suggestions:", error);
      }
    };
    fetchSuggestions();
  }, []);

  const toggleThinkingVisibility = (messageIndex) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg, idx) => {
        if (idx === messageIndex) {
          return {
            ...msg,
            isThinkingExpanded: !(msg.isThinkingExpanded ?? false),
          };
        }
        return msg;
      }),
    );
  };

  const handleImageSelect = (file) => {
    setPendingImage(file);
  };

  const handleImageRemove = () => {
    setPendingImage(null);
  };

  const handleSendMessage = (message) => {
    sendMessage(message || userInput);
    setShowSuggestions(false);
  };

  const handleUserInputSend = async () => {
    const hasText = userInput.trim();
    const hasImage = pendingImage;

    if (!hasText && !hasImage) return;

    // If there's an image, process it first
    if (hasImage) {
      setIsProcessingImage(true);
      try {
        const result = await chatApi.uploadImage(pendingImage);
        const extractedText = result.text || "";
        const filename = result.filename || "uploaded file";

        // Build attachment object for UI display
        const attachment = {
          filename: filename,
          type: result.content_type,
          extractedText: extractedText,
        };

        // Clear the pending image and input
        setPendingImage(null);
        const messageText = userInput.trim();
        setUserInput("");
        setIsProcessingImage(false);

        // Send message with attachment (extracted text handled by useChat)
        sendMessage(messageText, null, null, null, [attachment]);
      } catch (error) {
        console.error("Error processing image:", error);
        setIsProcessingImage(false);
        // Still send the text message if there is one
        if (hasText) {
          sendMessage(userInput);
          setUserInput("");
          setPendingImage(null);
        }
      }
    } else {
      // Just text, send normally
      handleSendMessage(userInput);
      setUserInput("");
    }
  };

  // Empty state - centered input
  if (!hasMessages) {
    return (
      <Flex
        className="dashboard-chat-container"
        direction="column"
        align="center"
        justify="center"
        px="20px"
      >
        <VStack spacing={8} w="100%" maxW="800px">
          {/* Greeting */}
          <VStack spacing={2}>
            <Text
              fontSize="2xl"
              fontWeight="bold"
              className="dashboard-chat-greeting"
            >
              How can I help you today?
            </Text>
            <Text fontSize="md" color="gray.500">
              Ask about patients, evidence, or outstanding jobs
            </Text>
          </VStack>

          {/* Suggestions */}
          {showSuggestions && ragSuggestions.length > 0 && (
            <Flex wrap="wrap" justify="center" gap={3}>
              {ragSuggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  leftIcon={
                    index === 0 ? (
                      <InfoIcon />
                    ) : index === 1 ? (
                      <SearchIcon />
                    ) : (
                      <QuestionIcon />
                    )
                  }
                  onClick={() => handleSendMessage(suggestion)}
                  className="dashboard-chat-suggestions"
                  size="sm"
                >
                  {suggestion}
                </Button>
              ))}
            </Flex>
          )}

          {/* Centered Input */}
          <DashboardChatInput
            value={userInput}
            onChange={(e) => {
              setUserInput(e.target.value);
              if (showSuggestions) setShowSuggestions(false);
            }}
            onSend={handleUserInputSend}
            isLoading={chatLoading}
            position="centered"
            pendingImage={pendingImage}
            onImageSelect={handleImageSelect}
            onImageRemove={handleImageRemove}
            isProcessingImage={isProcessingImage}
          />
        </VStack>
      </Flex>
    );
  }

  // Active chat state - messages at top, input at bottom
  return (
    <Box className="dashboard-chat-container">
      {/* Messages Area */}
      <Box
        className="dashboard-chat-messages"
        position="fixed"
        top="80px"
        left="50%"
        transform="translateX(-50%)"
        w="100%"
        maxW="800px"
        px="20px"
      >
        <VStack spacing={4} align="stretch">
          {visibleMessages.map((message, index) => {
            const parsed = parseMessageContent(message.content || "");
            const isThinkingExpanded = message.isThinkingExpanded ?? false;

            return (
              <Flex
                key={`message-${index}`}
                justify={
                  message.role === "assistant" ? "flex-start" : "flex-end"
                }
              >
                <Box
                  className={`message-box ${message.role}`}
                  maxWidth="85%"
                  position="relative"
                >
                  {message.loading ? (
                    <Spinner size="sm" />
                  ) : (
                    <VStack align="start" spacing={1} width="100%">
                      {/* Attachment chips for user messages */}
                      {message.role === "user" && message.attachments?.length > 0 && (
                        <HStack spacing={1} mb={1} flexWrap="wrap">
                          {message.attachments.map((att, i) => {
                            const isPdf = att.type === "application/pdf";
                            const isImage = att.type?.startsWith("image/");
                            return (
                              <Badge
                                key={i}
                                size="sm"
                                variant="subtle"
                                colorScheme={isPdf ? "red" : isImage ? "blue" : "gray"}
                                borderRadius="md"
                                px={2}
                                py={1}
                              >
                                <Icon
                                  as={isPdf ? FaFilePdf : isImage ? FaFileImage : AttachmentIcon}
                                  mr={1}
                                />
                                {att.filename}
                              </Badge>
                            );
                          })}
                        </HStack>
                      )}

                      {/* Content before <think\> tag */}
                      {parsed.hasThinkTag && parsed.beforeContent && (
                        <Text whiteSpace="pre-wrap">
                          {parsed.beforeContent}
                        </Text>
                      )}

                      {/* Thinking block */}
                      {parsed.hasThinkTag && (
                        <Box width="100%" my={1}>
                          <Flex
                            align="center"
                            onClick={() =>
                              toggleThinkingVisibility(
                                messages.indexOf(message),
                              )
                            }
                            cursor="pointer"
                            className="thinking-toggle"
                            p={1}
                            borderRadius="sm"
                          >
                            <Text mr="2">
                              Thinking {parsed.isPartialThinking ? "..." : ""}
                            </Text>
                            <IconButton
                              aria-label={
                                isThinkingExpanded
                                  ? "Collapse thinking"
                                  : "Expand thinking"
                              }
                              icon={
                                isThinkingExpanded ? (
                                  <ChevronUpIcon />
                                ) : (
                                  <ChevronDownIcon />
                                )
                              }
                              variant="outline"
                              size="xs"
                              className="collapse-toggle"
                            />
                          </Flex>
                          <Collapse in={isThinkingExpanded} animateOpacity>
                            <Box
                              className="thinking-block"
                              mt={2}
                              p={1}
                              borderLeftWidth="3px"
                              borderColor="blue.300"
                            >
                              <Text
                                whiteSpace="pre-wrap"
                                className="thinking-block-text"
                              >
                                {parsed.thinkContent}
                              </Text>
                            </Box>
                          </Collapse>
                        </Box>
                      )}

                      {/* Content after <think\> tag or full content */}
                      <Box fontSize="sm !important">
                        <MarkdownRenderer>
                          {parsed.hasThinkTag
                            ? parsed.afterContent
                            : parsed.content}
                        </MarkdownRenderer>
                      </Box>

                      {/* Context citations */}
                      {message.role === "assistant" && message.context && (
                        <HStack wrap="wrap" spacing={1} mt={1}>
                          {Object.keys(message.context).map((key) => (
                            <Tooltip
                              key={`context-${index}-${key}`}
                              label={message.context[key]}
                              placement="top"
                              hasArrow
                              fontSize="xs"
                              maxWidth="400px"
                              shouldWrapChildren
                              bg="gray.700"
                              color="white"
                              isOpen={
                                showTooltip === `context-${index}-${key}`
                              }
                            >
                              <Text
                                as="span"
                                color="blue.500"
                                cursor="pointer"
                                fontSize="xs"
                                _hover={{ textDecoration: "underline" }}
                                onMouseEnter={() =>
                                  setShowTooltip(`context-${index}-${key}`)
                                }
                                onMouseLeave={() => setShowTooltip(null)}
                              >
                                [{key}]
                              </Text>
                            </Tooltip>
                          ))}
                        </HStack>
                      )}
                    </VStack>
                  )}
                </Box>
              </Flex>
            );
          })}
          <div ref={messagesEndRef} />
        </VStack>
      </Box>

      {/* Fixed Bottom Input */}
      <DashboardChatInput
        value={userInput}
        onChange={(e) => setUserInput(e.target.value)}
        onSend={handleUserInputSend}
        isLoading={chatLoading}
        position="bottom"
        showDisclaimer={true}
        pendingImage={pendingImage}
        onImageSelect={handleImageSelect}
        onImageRemove={handleImageRemove}
        isProcessingImage={isProcessingImage}
      />
    </Box>
  );
};

export default DashboardChat;
