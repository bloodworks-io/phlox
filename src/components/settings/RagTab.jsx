import { Box, Text, NativeSelect, VStack, HStack, Spinner, Button, Dialog, Portal } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { ReEmbedProgress } from "../common/ReEmbedProgress";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const RagTab = ({
    config,
    embeddingModelOptions = [],
    llmModelsLoading = false,
    handleReEmbed,
}) => {
    const { t } = useTranslation();
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
                        {t("settings.rag.title")}
                    </Text>
                    <Text fontSize="sm" color="overlay0">
                        {t("settings.rag.description")}
                    </Text>
                </Box>

                <Box>
                    <Tooltip content={t("settings.rag.embeddingModelTooltip")}>
                        <Text fontSize="sm" mb="2" fontWeight={"bold"}>
                            {t("settings.rag.embeddingModel")}
                        </Text>
                    </Tooltip>
                    {llmModelsLoading ? (
                        <HStack gap="2">
                            <Spinner size="sm" />
                            <Text fontSize="sm" color="overlay0">
                                {t("settings.loadingModels")}
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
                                placeholder={t("settings.rag.selectModel")}
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
                        {t("settings.rag.modelsHint")}
                    </Text>
                    <Text
                        fontSize="xs"
                        color="secondaryButton"
                        mt="2"
                        fontWeight="medium"
                    >
                        {t("settings.rag.reembedWarning")}
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
                            <Dialog.Header>{t("settings.rag.reembedTitle")}</Dialog.Header>
                            <Dialog.Body>
                                {isReEmbedding ? (
                                    <VStack gap={4} align="stretch">
                                        <Text>
                                            {t("settings.rag.reembedding")}
                                        </Text>
                                        <ReEmbedProgress
                                            progress={reEmbedProgress}
                                        />
                                    </VStack>
                                ) : (
                                    <>
                                        <Text>
                                            {t("settings.rag.confirmBody")}
                                        </Text>
                                        <Text mt={4} fontWeight="bold">
                                            {t("settings.rag.confirmQuestion")}
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
                                        {t("action.cancel")}
                                    </Button>
                                    <Button
                                        className="green-button"
                                        onClick={handleConfirmEmbeddingChange}
                                    >
                                        {t("settings.rag.confirmChange")}
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
