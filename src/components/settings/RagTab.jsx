import { Box, Text, NativeSelect, VStack, HStack, Spinner, Button, Dialog, Portal } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { ReEmbedProgress } from "../common/ReEmbedProgress";
import { useState } from "react";

const RagTab = ({
    config,
    embeddingModelOptions = [],
    llmModelsLoading = false,
    handleReEmbed,
}) => {
    const [isEmbeddingModelModalOpen, setIsEmbeddingModelModalOpen] =
        useState(false);
    const [pendingEmbeddingModel, setPendingEmbeddingModel] = useState(null);
    const [isReEmbedding, setIsReEmbedding] = useState(false);
    const [reEmbedProgress, setReEmbedProgress] = useState(null);

    const handleEmbeddingModelChange = (value) => {
        setPendingEmbeddingModel(value);
        setIsEmbeddingModelModalOpen(true);
    };

    const handleConfirmEmbeddingChange = async () => {
        setIsReEmbedding(true);
        setReEmbedProgress({ percentage: 0 });
        try {
            await handleReEmbed(pendingEmbeddingModel, (event) => {
                if (
                    event.type === "batch_progress" ||
                    event.type === "collection_start"
                ) {
                    setReEmbedProgress({
                        percentage: event.percentage ?? 0,
                        collection_index: event.collection_index ?? 0,
                        total_collections: event.total_collections ?? 0,
                        collection_name: event.collection_name ?? "",
                        chunks_embedded: event.chunks_embedded ?? 0,
                        total_chunks_in_collection:
                            event.total_chunks_in_collection ?? 0,
                    });
                }
            });
            setIsEmbeddingModelModalOpen(false);
            setPendingEmbeddingModel(null);
        } catch (error) {
            console.error("Error changing embedding model:", error);
        } finally {
            setIsReEmbedding(false);
            setReEmbedProgress(null);
        }
    };

    const handleCancelEmbeddingChange = () => {
        setIsEmbeddingModelModalOpen(false);
        setPendingEmbeddingModel(null);
    };

    return (
        <>
            <VStack gap={4} align="stretch">
                <Box>
                    <Text fontSize="md" fontWeight="bold">
                        Knowledge Base (RAG)
                    </Text>
                    <Text fontSize="sm" color="overlay0">
                        Configure the embedding model used for knowledge base
                        searches
                    </Text>
                </Box>

                <Box>
                    <Tooltip content="Model used for generating embeddings for RAG - changing this will re-embed all documents">
                        <Text fontSize="sm" mb="2" fontWeight={"bold"}>
                            Embedding Model
                        </Text>
                    </Tooltip>
                    {llmModelsLoading ? (
                        <HStack gap="2">
                            <Spinner size="sm" />
                            <Text fontSize="sm" color="overlay0">
                                Loading models...
                            </Text>
                        </HStack>
                    ) : (
                        <NativeSelect.Root>
                            <NativeSelect.Field
                                size="sm"
                                value={config?.EMBEDDING_MODEL || ""}
                                onChange={(e) =>
                                    handleEmbeddingModelChange(e.target.value)
                                }
                                placeholder="Select embedding model"
                                className="input-style"
                            >
                                {embeddingModelOptions.map((model) => (
                                    <option key={model} value={model}>
                                        {model}
                                    </option>
                                ))}
                            </NativeSelect.Field>
                            <NativeSelect.Indicator />
                        </NativeSelect.Root>
                    )}
                    <Text fontSize="xs" color="overlay0" mt="1">
                        Available embedding models depend on the LLM endpoint
                        configured in the LLM tab
                    </Text>
                    <Text
                        fontSize="xs"
                        color="secondaryButton"
                        mt="2"
                        fontWeight="medium"
                    >
                        ⚠️ Changing the embedding model will re-embed all
                        documents automatically
                    </Text>
                </Box>
            </VStack>

            <Dialog.Root
                open={isEmbeddingModelModalOpen}
                closeOnInteractOutside={!isReEmbedding}
                closeOnEscape={!isReEmbedding}
                size="md"
                onOpenChange={(e) => {
                    if (!e.open) {
                        (
                            isReEmbedding
                                ? undefined
                                : handleCancelEmbeddingChange
                        )();
                    }
                }}
            >
                <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content className="modal-style">
                            <Dialog.Header>Re-embed Documents</Dialog.Header>
                            <Dialog.Body>
                                {isReEmbedding ? (
                                    <VStack gap={4} align="stretch">
                                        <Text>
                                            Re-embedding documents with the new
                                            model…
                                        </Text>
                                        <ReEmbedProgress
                                            progress={reEmbedProgress}
                                        />
                                    </VStack>
                                ) : (
                                    <>
                                        <Text>
                                            Changing the embedding model will
                                            re-embed all existing document
                                            collections with the new model. Your
                                            documents and collections will be
                                            preserved.
                                        </Text>
                                        <Text mt={4} fontWeight="bold">
                                            Are you sure you want to proceed?
                                        </Text>
                                    </>
                                )}
                            </Dialog.Body>
                            {!isReEmbedding && (
                                <Dialog.Footer>
                                    <Button
                                        className="red-button"
                                        mr={3}
                                        onClick={handleCancelEmbeddingChange}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="green-button"
                                        onClick={handleConfirmEmbeddingChange}
                                    >
                                        Confirm Change
                                    </Button>
                                </Dialog.Footer>
                            )}
                        </Dialog.Content>
                    </Dialog.Positioner>
                </Portal>
            </Dialog.Root>
        </>
    );
};

export default RagTab;
