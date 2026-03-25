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
import {
    convertFileToDataUrl,
    extractPdfTextOrRenderForVision,
    isPdfFile,
} from "../../utils/helpers/pdfVisionHelpers";

const normalizeProcessingMode = (value) => {
    const mode = String(value || "")
        .trim()
        .toLowerCase();
    if (mode === "vision" || mode === "ocr" || mode === "auto") return mode;
    return "auto";
};

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
    const [documentImageMode, setDocumentImageMode] = useState("auto");
    const [visionCapable, setVisionCapable] = useState(false);

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
        const fetchInitialChatSettings = async () => {
            try {
                const [settingsResponse, globalConfigResponse] =
                    await Promise.all([
                        universalFetch(await buildApiUrl("/api/config/user")),
                        universalFetch(await buildApiUrl("/api/config/global")),
                    ]);

                const userSettings = await settingsResponse.json();

                if (globalConfigResponse.ok) {
                    const globalConfig = await globalConfigResponse.json();
                    setDocumentImageMode(
                        normalizeProcessingMode(
                            globalConfig?.DOCUMENT_IMAGE_PROCESSING_MODE,
                        ),
                    );

                    try {
                        const capability =
                            await chatApi.getCurrentVisionCapability();
                        setVisionCapable(Boolean(capability?.vision_capable));
                    } catch (capabilityError) {
                        console.warn(
                            "Failed to load cached vision capability, falling back to legacy flag:",
                            capabilityError,
                        );
                        setVisionCapable(
                            Boolean(globalConfig?.VISION_MODEL_CAPABLE),
                        );
                    }
                }

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
                console.error("Error fetching initial chat settings:", error);
            }
        };
        fetchInitialChatSettings();
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

        // If there's an image/document, process it first
        if (hasImage) {
            setIsProcessingImage(true);
            try {
                const messageText = userInput.trim();
                let extractedText = "";
                let filename = pendingImage.name || "uploaded file";
                let fileType =
                    pendingImage.type ||
                    (isPdfFile(pendingImage) ? "application/pdf" : "image/*");

                if (isPdfFile(pendingImage)) {
                    // Frontend-first PDF strategy:
                    // 1) Try direct text extraction
                    // 2) If insufficient text, render pages to images and ask visual backend
                    const pdfResult =
                        await extractPdfTextOrRenderForVision(pendingImage);

                    if (pdfResult.strategy === "text") {
                        extractedText = pdfResult.textResult.text || "";
                    } else {
                        try {
                            const visualResult =
                                await chatApi.analyzeVisualDocument({
                                    filename,
                                    content_type: "application/pdf",
                                    strategy: "vision",
                                    pages: (
                                        pdfResult.imageResult?.images || []
                                    ).map((img) => ({
                                        page_number: img.pageNumber,
                                        data_url: img.dataUrl,
                                        mime_type: img.mimeType,
                                        width: img.width,
                                        height: img.height,
                                    })),
                                    fallback_text:
                                        pdfResult.textResult?.text || "",
                                    extraction_info: {
                                        reason:
                                            pdfResult.textResult?.quality
                                                ?.reason ||
                                            "No usable embedded PDF text",
                                        stats:
                                            pdfResult.textResult?.quality
                                                ?.stats || {},
                                        page_count:
                                            pdfResult.textResult?.pageCount ||
                                            0,
                                        processed_pages:
                                            pdfResult.textResult
                                                ?.processedPages || 0,
                                        rendered_pages:
                                            pdfResult.imageResult
                                                ?.renderedPages || 0,
                                    },
                                });

                            extractedText = visualResult.text || "";
                        } catch (visionError) {
                            console.warn(
                                "Visual PDF analysis unavailable, falling back to OCR endpoint:",
                                visionError,
                            );
                            const result =
                                await chatApi.uploadImage(pendingImage);
                            extractedText = result.text || "";
                            filename = result.filename || filename;
                            fileType = result.content_type || fileType;
                        }
                    }
                } else {
                    // Non-PDF image flow with mode controls:
                    // - vision: direct visual chat response only
                    // - auto: direct visual response if endpoint/model is marked vision-capable, else OCR fallback
                    // - ocr: legacy OCR upload endpoint
                    const mode = normalizeProcessingMode(documentImageMode);
                    let effectiveVisionCapable = visionCapable;

                    if (mode === "auto" || mode === "vision") {
                        try {
                            const capability =
                                await chatApi.getCurrentVisionCapability();
                            effectiveVisionCapable = Boolean(
                                capability?.vision_capable,
                            );
                            setVisionCapable(effectiveVisionCapable);
                        } catch (capabilityError) {
                            console.warn(
                                "Failed to refresh cached vision capability for chat image flow:",
                                capabilityError,
                            );
                        }
                    }

                    const useVisionDirectly =
                        mode === "vision" ||
                        (mode === "auto" && effectiveVisionCapable);
                    const allowOcrFallback = mode !== "vision";

                    if (useVisionDirectly) {
                        try {
                            const imageDataUrl =
                                await convertFileToDataUrl(pendingImage);

                            const visualPrompt =
                                messageText || "Please analyze this image.";
                            const visualResponse = await chatApi.respondVisual({
                                prompt: visualPrompt,
                                filename,
                                content_type: fileType,
                                pages: [
                                    {
                                        page_number: 1,
                                        data_url: imageDataUrl,
                                        mime_type: fileType || "image/png",
                                    },
                                ],
                            });

                            const userVisibleText =
                                messageText || "Analyze attached image";

                            setPendingImage(null);
                            setUserInput("");
                            setIsProcessingImage(false);

                            setMessages((prev) => [
                                ...prev,
                                {
                                    role: "user",
                                    content: userVisibleText,
                                    attachments: [
                                        {
                                            filename,
                                            type: fileType,
                                            extractedText: "",
                                        },
                                    ],
                                },
                                {
                                    role: "assistant",
                                    content:
                                        visualResponse.answer ||
                                        "I couldn't analyze that image.",
                                },
                            ]);
                            return;
                        } catch (visionError) {
                            if (!allowOcrFallback) {
                                throw visionError;
                            }
                            console.warn(
                                "Direct visual chat failed, falling back to OCR endpoint:",
                                visionError,
                            );
                        }
                    }

                    // OCR fallback (auto/ocr modes)
                    const result = await chatApi.uploadImage(pendingImage);
                    extractedText = result.text || "";
                    filename = result.filename || filename;
                    fileType = result.content_type || fileType;
                }

                // Build attachment object for UI display
                const attachment = {
                    filename,
                    type: fileType,
                    extractedText,
                };

                // Clear the pending image and input
                setPendingImage(null);
                setUserInput("");
                setIsProcessingImage(false);

                // Send message with attachment (extracted text handled by useChat)
                sendMessage(messageText, null, null, null, [attachment]);
            } catch (error) {
                console.error("Error processing image/document:", error);
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
                opacity={isIntroFading && !isProcessingImage ? 0 : 1}
                transition="opacity 0.35s ease"
                pointerEvents={
                    isIntroFading && !isProcessingImage ? "none" : "auto"
                }
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
