// Component for managing the RAG knowledge base settings.
import { useState } from "react";
import {
    Box,
    Flex,
    IconButton,
    Text,
    Collapse,
    Select,
    VStack,
    Tooltip,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalFooter,
    ModalBody,
    Button,
} from "@chakra-ui/react";
import { ChevronRightIcon, ChevronDownIcon } from "@chakra-ui/icons";
import { FaDatabase } from "react-icons/fa";

const RagSettingsPanel = ({
    isCollapsed,
    setIsCollapsed,
    config,
    modelOptions,
    handleClearDatabase,
    handleConfigChange,
}) => {
    const [isEmbeddingModelModalOpen, setIsEmbeddingModelModalOpen] =
        useState(false);
    const [pendingEmbeddingModel, setPendingEmbeddingModel] = useState(null);

    const handleModelChange = (value) => {
        setPendingEmbeddingModel(value);
        setIsEmbeddingModelModalOpen(true);
    };

    const handleConfirmChange = async () => {
        try {
            await handleClearDatabase(pendingEmbeddingModel);
            setIsEmbeddingModelModalOpen(false);
            setPendingEmbeddingModel(null);
        } catch (error) {
            console.error("Error changing embedding model:", error);
        }
    };

    const handleCancelChange = () => {
        setIsEmbeddingModelModalOpen(false);
        setPendingEmbeddingModel(null);
    };

    return (
        <>
            <Box className="panels-bg" p="4" borderRadius="sm">
                <Flex align="center" justify="space-between">
                    <Flex align="center">
                        <IconButton
                            icon={
                                isCollapsed ? (
                                    <ChevronRightIcon />
                                ) : (
                                    <ChevronDownIcon />
                                )
                            }
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            aria-label="Toggle collapse"
                            variant="outline"
                            size="sm"
                            mr="2"
                            className="collapse-toggle"
                        />
                        <FaDatabase
                            size="1.2em"
                            style={{ marginRight: "5px" }}
                        />
                        <Text as="h3">Knowledge Base (RAG) Options</Text>
                    </Flex>
                </Flex>
                <Collapse in={!isCollapsed} animateOpacity>
                    <VStack spacing={4} align="stretch" mt={4}>
                        <Box>
                            <Tooltip label="Model used for generating embeddings for RAG">
                                <Text fontSize="sm" mt="2">
                                    Embedding Model
                                </Text>
                            </Tooltip>
                            <Select
                                size="sm"
                                value={config?.EMBEDDING_MODEL || ""}
                                onChange={(e) =>
                                    handleModelChange(e.target.value)
                                }
                                placeholder="Select embedding model"
                                className="input-style"
                            >
                                {modelOptions.map((model) => (
                                    <option key={model} value={model}>
                                        {model}
                                    </option>
                                ))}
                            </Select>
                            <Text fontSize="xs" color="orange.500" mt="2">
                                ⚠️ Warning: Changing the embedding model will
                                require rebuilding the RAG database
                            </Text>
                        </Box>
                    </VStack>
                </Collapse>
            </Box>

            {/* Warning Modal */}
            <Modal
                isOpen={isEmbeddingModelModalOpen}
                onClose={handleCancelChange}
                size="md"
            >
                <ModalOverlay />
                <ModalContent className="modal-style">
                    <ModalHeader>Warning: Database Reset Required</ModalHeader>
                    <ModalBody>
                        <Text>
                            Changing the embedding model requires clearing the
                            entire RAG database. This will delete all existing
                            document collections and their embeddings. This
                            action cannot be undone.
                        </Text>
                        <Text mt={4} fontWeight="bold">
                            Are you sure you want to proceed?
                        </Text>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            className="red-button"
                            mr={3}
                            onClick={handleCancelChange}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="green-button"
                            onClick={handleConfirmChange}
                        >
                            Confirm Change
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
};

export default RagSettingsPanel;
