import React from "react";
import {
  Flex,
  Box,
  Text,
  HStack,
  VStack,
  IconButton,
  Collapse,
  Tooltip,
  Spinner,
} from "@chakra-ui/react";
import { ChevronDownIcon, ChevronUpIcon } from "@chakra-ui/icons";
import ReactMarkdown from "react-markdown";
import { parseMessageContent } from "../../../utils/chat/messageParser";

const ChatMessages = ({ messages, toggleThinkingVisibility }) => {
  const filteredMessages = messages.filter((m) => m.role !== "system");

  if (filteredMessages.length === 0) {
    return null;
  }

  return (
    <>
      {filteredMessages.map((message, index) => {
        if (message.role === "system") return null;
        const parsed = parseMessageContent(message.content || "");
        const isThinkingExpanded = message.isThinkingExpanded || false;

        return (
          <Flex
            key={index}
            justify={message.role === "assistant" ? "flex-start" : "flex-end"}
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
                  {parsed.hasThinkTag && parsed.beforeContent && (
                    <Text whiteSpace="pre-wrap">{parsed.beforeContent}</Text>
                  )}
                  {parsed.hasThinkTag && (
                    <Box width="100%" my={1}>
                      <Flex
                        align="center"
                        onClick={() => toggleThinkingVisibility(index)}
                        cursor="pointer"
                        p={1}
                        borderRadius="sm"
                        className="thinking-toggle"
                      >
                        <Text mr="2">
                          Thinking
                          {parsed.isPartialThinking ? "..." : ""}
                        </Text>
                        <IconButton
                          aria-label="Toggle thinking"
                          icon={
                            isThinkingExpanded ? (
                              <ChevronUpIcon />
                            ) : (
                              <ChevronDownIcon />
                            )
                          }
                          variant="outline"
                          size="xs"
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
                  <Box fontSize="sm">
                    <ReactMarkdown>
                      {parsed.hasThinkTag
                        ? parsed.afterContent
                        : parsed.content}
                    </ReactMarkdown>
                  </Box>
                  {message.role === "assistant" && message.context && (
                    <HStack wrap="wrap" spacing={1} mt={1}>
                      {Object.entries(message.context).map(([key, val]) => (
                        <Tooltip
                          key={key}
                          label={val}
                          placement="top"
                          hasArrow
                          fontSize="xs"
                          maxWidth="400px"
                          shouldWrapChildren
                          bg="gray.700"
                          color="white"
                        >
                          <Text
                            as="span"
                            color="blue.500"
                            cursor="pointer"
                            fontSize="xs"
                            _hover={{
                              textDecoration: "underline",
                            }}
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
    </>
  );
};

export default ChatMessages;
