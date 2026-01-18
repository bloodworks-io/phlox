import {
  Box,
  Flex,
  IconButton,
  HStack,
  Text,
  Tooltip,
  Input,
  Spinner,
  Button,
  Collapse,
  VStack,
} from "@chakra-ui/react";
import {
  ArrowUpIcon,
  InfoIcon,
  SearchIcon,
  QuestionIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
} from "@chakra-ui/icons";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { MdChat } from "react-icons/md";
import { buildApiUrl } from "../../utils/helpers/apiConfig";
import { universalFetch } from "../../utils/helpers/apiHelpers";
import { useChat } from "../../utils/hooks/useChat";

// Function to parse message content with </think> tags
const parseMessageContent = (content) => {
  const thinkRegex = /<think>(.*?)<\/think>/s; // 's' flag allows '.' to match newlines
  const match = content.match(thinkRegex);

  // If we have a complete <think></think> tag, parse it normally
  if (match) {
    const thinkContent = match[1].trim();
    const parts = content.split(match[0]); // Split by the full <think>...</think> block
    const beforeContent = parts[0].trim();
    const afterContent = parts.slice(1).join(match[0]).trim(); // Join back in case of multiple (though we handle first)

    return {
      hasThinkTag: true,
      beforeContent,
      thinkContent,
      afterContent,
    };
  }

  // Check for an unclosed <think> tag during streaming
  const openThinkMatch = content.match(/<think>(.*?)$/s);
  if (openThinkMatch) {
    // We have an opening <think> tag without a closing one yet (during streaming)
    const beforeContent = content.split("<think>")[0].trim();
    const partialThinkContent = openThinkMatch[1].trim();

    return {
      hasThinkTag: true,
      beforeContent,
      thinkContent: partialThinkContent,
      afterContent: "", // No after content yet as the tag isn't closed
      isPartialThinking: true, // Flag to indicate streaming status
    };
  }

  return {
    hasThinkTag: false,
    content, // Return original content if no tag
  };
};

const RagChat = ({ isCollapsed, setIsCollapsed }) => {
  // Use the chat hook in RAG mode (no patient/template required)
  const {
    messages,
    setMessages,
    userInput,
    setUserInput,
    showSuggestions,
    setShowSuggestions,
    loading: chatLoading,
    sendMessage,
    clearChat,
  } = useChat({ mode: "rag" });

  const messagesEndRef = useRef(null);
  const [showTooltip, setShowTooltip] = useState(null);
  const [ragSuggestions, setRagSuggestions] = useState([]);

  // Scroll to the bottom only when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Function to toggle thinking visibility for a specific message
  const toggleThinkingVisibility = (messageIndex) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg, idx) => {
        // Find the correct message in the full messages array
        if (idx === messageIndex) {
          return {
            ...msg,
            // Toggle the state, default to false if undefined
            isThinkingExpanded: !(msg.isThinkingExpanded ?? false),
          };
        }
        return msg;
      }),
    );
  };

  const handleSendMessage = (message) => {
    sendMessage(message); // No patient/template needed for RAG mode
    setShowSuggestions(false);
  };

  const handleUserInputSend = () => {
    handleSendMessage(userInput);
  };

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        // First get user settings to know the specialty
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

  return (
    <Box className="panels-bg" p="4" borderRadius="sm">
      <Flex align="center" justify="space-between">
        <Flex align="center">
          <IconButton
            icon={isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label="Toggle collapse"
            variant="outline"
            size="sm"
            mr="2"
            className="collapse-toggle"
          />
          <HStack spacing={2}>
            <MdChat size="1.2em" />
            <Text as="h3">Chat With Documents</Text>
          </HStack>
        </Flex>
      </Flex>
      <Collapse in={!isCollapsed} animateOpacity>
        <Box
          flex="1"
          display="flex"
          flexDirection="column"
          overflow="hidden"
          css={{ width: "100%", height: "450px" }}
        >
          <Box
            flex="1"
            overflowY="auto"
            mt="4"
            p="2"
            borderRadius="sm"
            className="floating-main"
          >
            {messages.map((message, index) => {
              // Skip system messages for rendering
              if (message.role === "system") return null;

              // Parse the content for  tags
              const parsed = parseMessageContent(message.content || "");
              // Determine if the 'Thinking' section is expanded for this message
              const isThinkingExpanded = message.isThinkingExpanded ?? false;

              return (
                <Flex
                  key={`${index}-${message.role}-${parsed.hasThinkTag}`}
                  justify={
                    message.role === "assistant" ? "flex-start" : "flex-end"
                  }
                  mb="3"
                >
                  <Box
                    className={`message-box ${message.role}`}
                    px="3"
                    py="2"
                    maxWidth="85%"
                    fontSize="sm"
                    position="relative"
                  >
                    {message.loading ? (
                      <Spinner size="sm" mt="1" />
                    ) : (
                      <VStack align="start" spacing={1} width="100%">
                        {/* Render content before  tag */}
                        {parsed.hasThinkTag && parsed.beforeContent && (
                          <Text whiteSpace="pre-wrap">
                            {parsed.beforeContent}
                          </Text>
                        )}

                        {/* Handle Thinking block */}
                        {parsed.hasThinkTag && (
                          <Box width="100%" my={1}>
                            <Flex
                              align="center"
                              onClick={() => toggleThinkingVisibility(index)}
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
                                mr="2"
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

                        {/* Render content after  tag or full content if no tag */}
                        <Box fontSize="sm !important">
                          <ReactMarkdown>
                            {parsed.hasThinkTag
                              ? parsed.afterContent
                              : parsed.content}
                          </ReactMarkdown>
                        </Box>

                        {/* Render context links */}
                        {message.role === "assistant" && message.context && (
                          <HStack wrap="wrap" spacing={1} mt={1}>
                            {Object.keys(message.context).map((key) => (
                              <Tooltip
                                key={`${index}-context-${key}`}
                                label={message.context[key]}
                                placement="top"
                                hasArrow
                                fontSize="xs"
                                maxWidth="400px"
                                shouldWrapChildren
                                bg="gray.700"
                                color="white"
                                isOpen={
                                  showTooltip === `${index}-context-${key}`
                                }
                              >
                                <Text
                                  as="span"
                                  color="blue.500"
                                  cursor="pointer"
                                  fontSize="xs"
                                  _hover={{
                                    textDecoration: "underline",
                                  }}
                                  onMouseEnter={() =>
                                    setShowTooltip(`${index}-context-${key}`)
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

            {showSuggestions && (
              <Flex justify="center" align="center" mt="100" flexWrap="wrap">
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
                    m="2"
                    onClick={() => handleSendMessage(suggestion)}
                    className="chat-suggestions"
                  >
                    {suggestion}
                  </Button>
                ))}
              </Flex>
            )}

            <div ref={messagesEndRef} />
          </Box>

          <Flex
            alignItems="center"
            justify="space-between"
            pt="4"
            pl="4"
            pr="4"
          >
            <Input
              placeholder="Type your message..."
              size="sm"
              value={userInput}
              onChange={(e) => {
                setUserInput(e.target.value);
                if (showSuggestions) setShowSuggestions(false);
              }}
              flex="1"
              mr="2"
              borderRadius="10px"
              className="chat-input"
              onKeyPress={(e) => e.key === "Enter" && handleUserInputSend()}
            />
            <IconButton
              icon={<ArrowUpIcon />}
              onClick={() => handleSendMessage(userInput)}
              isDisabled={!userInput.trim() || chatLoading}
              isLoading={chatLoading}
              className="chat-send-button"
              size="md"
              aria-label="Send Message"
            />
          </Flex>

          {/* Disclaimer */}
          <Text textAlign="center" fontSize="xs" color="gray.500" mt="2">
            Phlox may make mistakes. Always verify critical information.
          </Text>
        </Box>
      </Collapse>
    </Box>
  );
};

export default RagChat;
