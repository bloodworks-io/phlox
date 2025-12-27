// Page component for RAG functionality.
import React, { useState, useEffect } from "react";
import { Box, Text, VStack, useToast } from "@chakra-ui/react";
import { ragApi } from "../utils/api/ragApi";
import RagChat from "../components/rag/RagChat";
import DocumentExplorer from "../components/rag/DocumentExplorer";
import Uploader from "../components/rag/Uploader";
import DeleteModal from "../components/rag/DeleteModal";

const Rag = () => {
    const [collections, setCollections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [itemToDelete, setItemToDelete] = useState(null);
    const toast = useToast();
    // Collapse states
    const [collapseStates, setCollapseStates] = useState({
        chat: false,
        explorer: true,
        uploader: true,
    });
    const toggleCollapse = (section) => {
        setCollapseStates((prev) => ({
            ...prev,
            [section]: !prev[section],
        }));
    };
    // Chat states
    const [chatLoading, setChatLoading] = useState(false);
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(true);

    useEffect(() => {
        const fetchCollections = async () => {
            setLoading(true);
            try {
                const data = await ragApi.fetchCollections();
                setCollections(
                    data.files.map((name) => ({
                        name,
                        files: [],
                        loaded: false,
                    })),
                );
            } catch (error) {
                toast({
                    title: "Error",
                    description: error.message,
                    status: "error",
                    duration: 3000,
                    isClosable: true,
                });
            } finally {
                setLoading(false);
            }
        };
        fetchCollections();
    }, [toast]);

    const handleDelete = async () => {
        try {
            if (itemToDelete.type === "file") {
                await ragApi.deleteFile(
                    itemToDelete.collection,
                    itemToDelete.name,
                );
            } else {
                await ragApi.deleteCollection(itemToDelete.name);
            }
            const updatedCollections = await ragApi.fetchCollections();
            setCollections(
                updatedCollections.files.map((name) => ({
                    name,
                    files: [],
                    loaded: false,
                })),
            );
            toast({
                title: "Success",
                description: `${
                    itemToDelete.type === "file" ? "File" : "Collection"
                } deleted successfully`,
                status: "success",
                duration: 3000,
                isClosable: true,
            });
        } catch (error) {
            console.error("Error deleting:", error);
            toast({
                title: "Error",
                description: `Failed to delete ${
                    itemToDelete.type === "file" ? "file" : "collection"
                }`,
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        } finally {
            setItemToDelete(null);
        }
    };
    return (
        <Box p="5" borderRadius="sm" w="100%">
            <Text as="h2" mb="4">
                Documents
            </Text>
            <VStack spacing="5" align="stretch">
                <RagChat
                    isCollapsed={collapseStates.chat}
                    setIsCollapsed={() => toggleCollapse("chat")}
                    chatLoading={chatLoading}
                    setChatLoading={setChatLoading}
                    messages={messages}
                    setMessages={setMessages}
                    userInput={userInput}
                    setUserInput={setUserInput}
                    showSuggestions={showSuggestions}
                    setShowSuggestions={setShowSuggestions}
                />
                <DocumentExplorer
                    isCollapsed={collapseStates.explorer}
                    setIsCollapsed={() => toggleCollapse("explorer")}
                    collections={collections}
                    setCollections={setCollections}
                    loading={loading}
                    setItemToDelete={setItemToDelete}
                />
                <Uploader
                    isCollapsed={collapseStates.uploader}
                    setIsCollapsed={() => toggleCollapse("uploader")}
                    setCollections={setCollections}
                />
            </VStack>
            <DeleteModal
                isOpen={!!itemToDelete}
                onClose={() => setItemToDelete(null)}
                onDelete={handleDelete}
                item={itemToDelete}
            />
        </Box>
    );
};
export default Rag;
