// Component for bulk uploading and vectorizing multiple PDF documents.
import React, { useState, useRef } from "react";
import { Field, Box, Text, Flex, HStack, VStack, Input, Button, IconButton, Collapsible, Spinner } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import {
    ChevronDownIcon,
    CloseIcon,
    CheckIcon,
    WarningIcon,
} from "../common/icons";
import { FaFilePdf, FaCloudUploadAlt } from "react-icons/fa";
import { useBulkUploadQueue, STATUS } from "../../utils/hooks/useBulkUploadQueue";
import { filterPdfFiles } from "./utils";
import { useTranslation } from "react-i18next";
import type { DocumentCollection } from "./types";

type QueueApi = ReturnType<typeof useBulkUploadQueue>;
type QueueEntry = QueueApi["fileQueue"][number];

const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
        case STATUS.EXTRACTING:
        case STATUS.COMMITTING:
            return <Spinner size="xs" mr="2" />;
        case STATUS.EXTRACTED:
            return <CheckIcon color="successButton" mr="2" boxSize={3} />;
        case STATUS.COMMITTED:
            return (
                <CheckIcon
                    color="successButton"
                    mr="2"
                    boxSize={3}
                    className="anim-fade-scale"
                    css={{ animationDuration: "0.2s" }}
                />
            );
        case STATUS.FAILED:
            return <WarningIcon color="dangerButton" mr="2" boxSize={3} />;
        default:
            return null;
    }
};

interface BulkUploaderProps {
    setCollections: React.Dispatch<React.SetStateAction<DocumentCollection[]>>;
}

const BulkUploader = ({ setCollections }: BulkUploaderProps) => {
    const { t } = useTranslation();
    const [isDragOver, setIsDragOver] = useState(false);
    const [expandedFile, setExpandedFile] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const {
        fileQueue,
        isProcessing,
        addFiles,
        removeFromQueue,
        updateMetadata,
        extractAll,
        commitAll,
        extractedCount,
        committedCount,
        totalPending,
        readyToCommit,
        hasPendingOrFailed,
    } = useBulkUploadQueue({ setCollections });

    // --- Drag and drop handlers ---

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer?.files || []);
        const pdfFiles = filterPdfFiles(files);
        if (pdfFiles.length === 0) {
            toaster.create({
                title: t("rag.toast.noPdfFiles"),
                description: t("rag.toast.onlyPdfSupported"),
                type: "warning",
                duration: 3000,
            });
            return;
        }
        if (files.length > pdfFiles.length) {
            toaster.create({
                title: t("rag.toast.someFilesSkipped"),
                description: t("rag.toast.nonPdfIgnored", {
                    number: files.length - pdfFiles.length,
                }),
                type: "info",
                duration: 3000,
            });
        }
        addFiles(pdfFiles);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            addFiles(files);
        }
        e.target.value = "";
    };

    // --- Status icon ---

    const statusLabel = (entry: QueueEntry) => {
        switch (entry.status) {
            case STATUS.PENDING:
                return t("rag.status.pending");
            case STATUS.EXTRACTING:
                return t("rag.status.extracting");
            case STATUS.EXTRACTED:
                return t("rag.status.readyToCommit");
            case STATUS.COMMITTING:
                return t("rag.status.committing");
            case STATUS.COMMITTED:
                return t("rag.status.committed");
            case STATUS.FAILED:
                return entry.error || t("rag.status.failed");
            default:
                return "";
        }
    };

    return (
        <VStack gap={4} align="stretch">
            {/* Drop zone */}
            <Box
                        border="2px dashed"
                        borderColor={isDragOver ? "accent" : "border"}
                        borderRadius="md"
                        p="6"
                        textAlign="center"
                        cursor="pointer"
                        bg={isDragOver ? "surfaceMuted" : "transparent"}
                        _hover={{ borderColor: "border" }}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        transition="all 0.2s"
                    >
                        <FaCloudUploadAlt
                            size="2em"
                            color={isDragOver ? "#3182ce" : "#a0aec0"}
                            style={{ margin: "0 auto 8px" }}
                        />
                        <Text fontSize="sm" color="overlay0">
                            {t("rag.dropZoneHint")}
                        </Text>
                        <Input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".pdf"
                            onChange={handleFileSelect}
                            display="none"
                        />
                    </Box>
            {/* File queue */}
            {fileQueue.length > 0 && (
                <VStack gap={2} align="stretch">
                    {fileQueue.map((entry) => (
                        <Box
                            key={entry.id}
                            className="anim-fade-slide-up"
                            css={{ animationDuration: "0.15s" }}
                        >
                            <Flex
                                alignItems="center"
                                p="2"
                                borderRadius="sm"
                                className="documentExplorer-style"
                                _hover={{ bg: "surfaceMuted" }}
                            >
                                <Box mr="2" color="dangerButton" asChild><FaFilePdf /></Box>
                                <Text
                                    fontSize="sm"
                                    fontWeight="medium"
                                    flex="1"
                                    minW="0"
                                    truncate
                                >
                                    {entry.file.name}
                                </Text>
                                <StatusIcon status={entry.status} />
                                <Text
                                    fontSize="xs"
                                    color={
                                        entry.status === STATUS.FAILED
                                            ? "dangerButton"
                                            : "overlay0"
                                    }
                                    mr="2"
                                >
                                    {statusLabel(entry)}
                                </Text>
                                {entry.status === STATUS.EXTRACTED && (
                                    <IconButton
                                        aria-label={t("rag.editMetadata")}
                                        size="xs"
                                        variant="ghost"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedFile(
                                                expandedFile ===
                                                    entry.id
                                                    ? null
                                                    : entry.id,
                                            );
                                        }}
                                        mr="1"><ChevronDownIcon /></IconButton>
                                )}
                                {(entry.status === STATUS.PENDING ||
                                    entry.status === STATUS.EXTRACTED) &&
                                    !isProcessing && (
                                        <IconButton
                                            aria-label={t("rag.removeFromQueue")}
                                            size="xs"
                                            variant="ghost"
                                            colorPalette="red"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeFromQueue(
                                                    entry.id,
                                                );
                                            }}><CloseIcon /></IconButton>
                                    )}
                            </Flex>

                            {/* Metadata editing */}
                            {entry.status === STATUS.EXTRACTED &&
                                entry.metadata && (
                                    <Collapsible.Root
                                        open={
                                            expandedFile === entry.id
                                        }>
                                        <Collapsible.Content>
                                            <VStack
                                                gap={2}
                                                align="stretch"
                                                pl="8"
                                                py="2"
                                                className="filelist-style"
                                            >
                                                <Field.Root>
                                                <Field.Label
                                                    fontSize="xs"
                                                    mb="0"
                                                >
                                                    {t("rag.collectionName")}
                                                </Field.Label>
                                                <Input
                                                    size="sm"
                                                    className="input-style"
                                                    value={
                                                        entry.metadata
                                                            .disease_name
                                                    }
                                                    onChange={(e) =>
                                                        updateMetadata(
                                                            entry.id,
                                                            "disease_name",
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                                </Field.Root>
                                                <Field.Root>
                                                <Field.Label
                                                    fontSize="xs"
                                                    mb="0"
                                                >
                                                    {t("rag.documentSource")}
                                                </Field.Label>
                                                <Input
                                                    size="sm"
                                                    className="input-style"
                                                    value={
                                                        entry.metadata
                                                            .document_source
                                                    }
                                                    onChange={(e) =>
                                                        updateMetadata(
                                                            entry.id,
                                                            "document_source",
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                                </Field.Root>
                                                <Field.Root>
                                                <Field.Label
                                                    fontSize="xs"
                                                    mb="0"
                                                >
                                                    {t("rag.focusArea")}
                                                </Field.Label>
                                                <Input
                                                    size="sm"
                                                    className="input-style"
                                                    value={
                                                        entry.metadata
                                                            .focus_area
                                                    }
                                                    onChange={(e) =>
                                                        updateMetadata(
                                                            entry.id,
                                                            "focus_area",
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                                </Field.Root>
                                            </VStack>
                                        </Collapsible.Content>
                                    </Collapsible.Root>
                                )}
                        </Box>
                    ))}
                </VStack>
            )}
            {/* Action bar */}
            {fileQueue.length > 0 && (
                <Flex
                    justify="space-between"
                    align="center"
                    wrap="wrap"
                    gap="2"
                >
                    <Text fontSize="xs" color="overlay0">
                        {t("rag.queueSummary", {
                            pending: totalPending,
                            ready: readyToCommit,
                            committed: committedCount,
                        })}
                    </Text>
                    <HStack>
                        <Button
                            onClick={extractAll}
                            disabled={
                                !hasPendingOrFailed || isProcessing
                            }
                            loading={isProcessing && extractedCount === 0}
                            loadingText={t("rag.status.extracting")}
                            size="sm"
                            className="orange-button"><CheckIcon />{t("rag.extractAll")}
                                                    </Button>
                        <Button
                            onClick={commitAll}
                            disabled={
                                readyToCommit === 0 || isProcessing
                            }
                            loading={
                                isProcessing && readyToCommit === 0
                            }
                            loadingText={t("rag.status.committing")}
                            size="sm"
                            className="green-button"><CheckIcon />{t("rag.commitAll")}
                                                    </Button>
                    </HStack>
                </Flex>
            )}
        </VStack>
    );
};

export default BulkUploader;
