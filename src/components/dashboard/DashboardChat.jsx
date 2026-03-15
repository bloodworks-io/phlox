import React, { useState, useEffect, useRef } from "react";
import { Box, Flex, VStack, Text, Button } from "@chakra-ui/react";
import { InfoIcon, SearchIcon, QuestionIcon } from "@chakra-ui/icons";
import { useChat } from "../../utils/hooks/useChat";
import DashboardChatInput from "./DashboardChatInput";
import DashboardTodoPanel from "./DashboardTodoPanel";
import DashboardMessageList from "./DashboardMessageList";
import { universalFetch } from "../../utils/helpers/apiHelpers";
import { buildApiUrl } from "../../utils/helpers/apiConfig";
import { chatApi } from "../../utils/api/chatApi";
import { useDashboardTodos } from "../../utils/hooks/useDashboardTodos";

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
    const [ragSuggestions, setRagSuggestions] = useState([]);
    const [pendingImage, setPendingImage] = useState(null);
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const [isIntroFading, setIsIntroFading] = useState(false);

    const {
        todos,
        visibleTodos,
        newTodo,
        setNewTodo,
        showAllTodos,
        setShowAllTodos,
        isCollapsed: isTodoPanelCollapsed,
        toggleCollapsed: toggleTodoPanelCollapsed,
        isLoading: isTodosLoading,
        isSaving: isTodosSaving,
        addTodo,
        toggleTodo,
        deleteTodo,
        handleTodoKeyDown,
    } = useDashboardTodos({
        initialShowAll: false,
        initialCollapsed: true,
    });

    // Filter out system messages for rendering while preserving original index
    const visibleMessages = messages
        .map((message, messageIndex) => ({ message, messageIndex }))
        .filter(({ message }) => message.role !== "system");

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
                    if (!response.ok)
                        throw new Error("Failed to fetch suggestions");
                    const data = await response.json();
                    setRagSuggestions(data.suggestions);
                }
            } catch (error) {
                console.error("Error fetching RAG suggestions:", error);
            }
        };
        fetchSuggestions();
    }, []);

    const handleImageSelect = (file) => {
        setPendingImage(file);
    };

    const handleImageRemove = () => {
        setPendingImage(null);
    };

    const handleSendMessage = async (message) => {
        const text = message || userInput;
        if (!text?.trim()) return;

        if (!hasMessages && !isIntroFading) {
            setIsIntroFading(true);
            await new Promise((resolve) => setTimeout(resolve, 240));
        }

        sendMessage(text);
        setShowSuggestions(false);
    };

    const handleUserInputSend = async () => {
        const hasText = userInput.trim();
        const hasImage = pendingImage;

        if (!hasText && !hasImage) return;

        // If there's an image, process it first
        if (hasImage) {
            if (!hasMessages && !isIntroFading) {
                setIsIntroFading(true);
                await new Promise((resolve) => setTimeout(resolve, 240));
            }

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
            await handleSendMessage(userInput);
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
                opacity={isIntroFading ? 0 : 1}
                transition="opacity 0.35s ease"
                pointerEvents={isIntroFading ? "none" : "auto"}
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
                                    onClick={() =>
                                        handleSendMessage(suggestion)
                                    }
                                    className="dashboard-chat-suggestions"
                                    size="sm"
                                >
                                    {suggestion}
                                </Button>
                            ))}
                        </Flex>
                    )}

                    {/* Centered Input + overlay todo panel (does not affect intro layout flow) */}
                    <Box w="100%" maxW="800px" position="relative">
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

                        <Box
                            position="absolute"
                            top="calc(100% + 8px)"
                            left="0"
                            right="0"
                            zIndex={2}
                            pointerEvents="none"
                        >
                            <Box pointerEvents="auto">
                                <DashboardTodoPanel
                                    todos={todos}
                                    visibleTodos={visibleTodos}
                                    newTodo={newTodo}
                                    setNewTodo={setNewTodo}
                                    showAllTodos={showAllTodos}
                                    setShowAllTodos={setShowAllTodos}
                                    isCollapsed={isTodoPanelCollapsed}
                                    toggleCollapsed={toggleTodoPanelCollapsed}
                                    isLoading={isTodosLoading}
                                    isSaving={isTodosSaving}
                                    addTodo={addTodo}
                                    toggleTodo={toggleTodo}
                                    deleteTodo={deleteTodo}
                                    handleTodoKeyDown={handleTodoKeyDown}
                                />
                            </Box>
                        </Box>
                    </Box>
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
                left="0"
                right="0"
                bottom="110px"
                w="100%"
                px="0"
            >
                <DashboardMessageList
                    visibleMessages={visibleMessages}
                    setMessages={setMessages}
                    messagesEndRef={messagesEndRef}
                />
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
