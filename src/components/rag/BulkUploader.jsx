// Component for bulk uploading and vectorizing multiple PDF documents.
import React, { useState, useRef } from "react";
import { Field, Box, Text, Flex, HStack, VStack, Input, Button, IconButton, Collapsible, Spinner } from "@chakra-ui/react";
import { useToast } from "@/utils/useToastShim";
import {
    ChevronDownIcon,
    CloseIcon,
    CheckIcon,
    WarningIcon,
} from "../common/icons";
import { FaFilePdf, FaCloudUploadAlt } from "react-icons/fa";
import { ragApi } from "../../utils/api/ragApi";
import { extractPdfMetadata } from "../../utils/helpers/pdfExtractHelpers";

const STATUS = {
    PENDING: "pending",
    EXTRACTING: "extracting",
    EXTRACTED: "extracted",
    COMMITTING: "committing",
    COMMITTED: "committed",
    FAILED: "failed",
};

/** Create a fresh queue entry for a File object. */
function makeQueueEntry(file) {
    return {
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        status: STATUS.PENDING,
        extractedText: null,
        metadata: null,
        error: null,
    };
}

const BulkUploader = ({ setCollections }) => {
    const [fileQueue, setFileQueue] = useState([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [expandedFile, setExpandedFile] = useState(null);
    const fileInputRef = useRef(null);
    const toast = useToast();

    // --- Drag and drop handlers ---

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer?.files || []);
        const pdfFiles = files.filter(
            (f) =>
                f.type === "application/pdf" ||
                f.name.toLowerCase().endsWith(".pdf"),
        );
        if (pdfFiles.length === 0) {
            toast({
                title: "No PDF files",
                description: "Only PDF files are supported",
                status: "warning",
                duration: 3000,
                isClosable: true,
            });
            return;
        }
        if (files.length > pdfFiles.length) {
            toast({
                title: "Some files skipped",
                description: `${files.length - pdfFiles.length} non-PDF file(s) were ignored`,
                status: "info",
                duration: 3000,
                isClosable: true,
            });
        }
        addFiles(pdfFiles);
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            addFiles(files);
        }
        // Reset so the same file can be re-selected
        e.target.value = "";
    };

    const addFiles = (files) => {
        const newEntries = files.map(makeQueueEntry);
        setFileQueue((prev) => [...prev, ...newEntries]);
    };

    // --- Queue manipulation ---

    const removeFromQueue = (id) => {
        setFileQueue((prev) => prev.filter((entry) => entry.id !== id));
    };

    const updateQueueEntry = (id, updates) => {
        setFileQueue((prev) =>
            prev.map((entry) =>
                entry.id === id ? { ...entry, ...updates } : entry,
            ),
        );
    };

    const updateMetadata = (id, field, value) => {
        setFileQueue((prev) =>
            prev.map((entry) =>
                entry.id === id
                    ? { ...entry, metadata: { ...entry.metadata, [field]: value } }
                    : entry,
            ),
        );
    };

    // --- Extraction ---

    const extractAll = async () => {
        setIsProcessing(true);
        const pending = fileQueue.filter(
            (e) => e.status === STATUS.PENDING || e.status === STATUS.FAILED,
        );

        for (const entry of pending) {
            updateQueueEntry(entry.id, {
                status: STATUS.EXTRACTING,
                error: null,
            });

            try {
                const result = await extractPdfMetadata(entry.file);
                updateQueueEntry(entry.id, {
                    status: STATUS.EXTRACTED,
                    extractedText: result.extractedText,
                    pdfBase64: result.pdfBase64,
                    metadata: {
                        disease_name: result.disease_name,
                        focus_area: result.focus_area,
                        document_source: result.document_source,
                        filename: result.filename,
                    },
                });
            } catch (error) {
                console.error(
                    `Extraction failed for ${entry.file.name}:`,
                    error,
                );
                updateQueueEntry(entry.id, {
                    status: STATUS.FAILED,
                    error: error.message || "Extraction failed",
                });
            }
        }

        setIsProcessing(false);

        const finalQueue = fileQueue;
        const failed = pending.filter((e) => {
            const current = finalQueue.find((f) => f.id === e.id);
            return current?.status === STATUS.FAILED;
        });

        if (failed.length === 0 && pending.length > 0) {
            toast({
                title: "Extraction Complete",
                description: `Successfully extracted ${pending.length} file(s)`,
                status: "success",
                duration: 3000,
                isClosable: true,
            });
        } else if (failed.length > 0) {
            toast({
                title: "Extraction Partially Complete",
                description: `${pending.length - failed.length} of ${pending.length} file(s) extracted successfully`,
                status: "warning",
                duration: 3000,
                isClosable: true,
            });
        }
    };

    // --- Commit ---

    const commitAll = async () => {
        setIsProcessing(true);
        const ready = fileQueue.filter((e) => e.status === STATUS.EXTRACTED);

        for (const entry of ready) {
            updateQueueEntry(entry.id, { status: STATUS.COMMITTING });

            try {
                if (entry.extractedText) {
                    // Direct commit with pre-extracted text
                    await ragApi.commitDirect({
                        extracted_text: entry.extractedText,
                        disease_name: entry.metadata.disease_name,
                        focus_area: entry.metadata.focus_area,
                        document_source: entry.metadata.document_source,
                        filename: entry.metadata.filename,
                        pdf_base64: entry.pdfBase64 || null,
                    });
                } else {
                    // Legacy two-step path (backend OCR fallback)
                    await ragApi.commitToDatabase({
                        disease_name: entry.metadata.disease_name,
                        focus_area: entry.metadata.focus_area,
                        document_source: entry.metadata.document_source,
                        filename: entry.metadata.filename,
                    });
                }
                updateQueueEntry(entry.id, {
                    status: STATUS.COMMITTED,
                    extractedText: null, // free memory
                });
            } catch (error) {
                console.error(
                    `Commit failed for ${entry.metadata.filename}:`,
                    error,
                );
                updateQueueEntry(entry.id, {
                    status: STATUS.FAILED,
                    error: error.message || "Commit failed",
                });
            }
        }

        // Refresh collections
        try {
            const updatedCollections = await ragApi.fetchCollections();
            setCollections(
                updatedCollections.files.map((name) => ({
                    name,
                    files: [],
                    loaded: false,
                })),
            );
        } catch (error) {
            console.error("Error refreshing collections:", error);
        }

        setIsProcessing(false);

        const committedCount = ready.filter((e) => {
            const current = fileQueue.find((f) => f.id === e.id);
            return current?.status === STATUS.COMMITTED;
        }).length;

        toast({
            title: "Commit Complete",
            description: `${committedCount} of ${ready.length} file(s) committed successfully`,
            status: committedCount === ready.length ? "success" : "warning",
            duration: 3000,
            isClosable: true,
        });
    };

    // --- Summary stats ---

    const extractedCount = fileQueue.filter(
        (e) => e.status === STATUS.EXTRACTED || e.status === STATUS.COMMITTED,
    ).length;
    const committedCount = fileQueue.filter(
        (e) => e.status === STATUS.COMMITTED,
    ).length;
    const totalPending = fileQueue.filter(
        (e) => e.status === STATUS.PENDING,
    ).length;
    const readyToCommit = fileQueue.filter(
        (e) => e.status === STATUS.EXTRACTED,
    ).length;
    const hasPendingOrFailed = fileQueue.some(
        (e) => e.status === STATUS.PENDING || e.status === STATUS.FAILED,
    );

    // --- Status icon ---

    const StatusIcon = ({ status }) => {
        switch (status) {
            case STATUS.EXTRACTING:
            case STATUS.COMMITTING:
                return <Spinner size="xs" mr="2" />;
            case STATUS.EXTRACTED:
                return <CheckIcon color="green.500" mr="2" boxSize={3} />;
            case STATUS.COMMITTED:
                return (
                    <CheckIcon color="green.500" mr="2" boxSize={3} />
                );
            case STATUS.FAILED:
                return <WarningIcon color="red.500" mr="2" boxSize={3} />;
            default:
                return null;
        }
    };

    const statusLabel = (entry) => {
        switch (entry.status) {
            case STATUS.PENDING:
                return "Pending";
            case STATUS.EXTRACTING:
                return "Extracting...";
            case STATUS.EXTRACTED:
                return "Ready to commit";
            case STATUS.COMMITTING:
                return "Committing...";
            case STATUS.COMMITTED:
                return "Committed ✓";
            case STATUS.FAILED:
                return entry.error || "Failed";
            default:
                return "";
        }
    };

    return (
        <VStack gap={4} align="stretch">
            {/* Drop zone */}
            <Box
                        border="2px dashed"
                        borderColor={isDragOver ? "blue.400" : "gray.300"}
                        borderRadius="md"
                        p="6"
                        textAlign="center"
                        cursor="pointer"
                        bg={isDragOver ? "blue.50" : "transparent"}
                        _hover={{ borderColor: "gray.400" }}
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
                        <Text fontSize="sm" color="gray.500">
                            Drag and drop PDFs here, or click to browse
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
                        <Box key={entry.id}>
                            <Flex
                                alignItems="center"
                                p="2"
                                borderRadius="sm"
                                className="documentExplorer-style"
                                _hover={{ bg: "gray.100" }}
                            >
                                <Box mr="2" color="red.400" asChild><FaFilePdf /></Box>
                                <Text
                                    fontSize="sm"
                                    fontWeight="medium"
                                    flex="1"
                                    isTruncated
                                >
                                    {entry.file.name}
                                </Text>
                                <StatusIcon status={entry.status} />
                                <Text
                                    fontSize="xs"
                                    color={
                                        entry.status === STATUS.FAILED
                                            ? "red.500"
                                            : "gray.500"
                                    }
                                    mr="2"
                                >
                                    {statusLabel(entry)}
                                </Text>
                                {entry.status === STATUS.EXTRACTED && (
                                    <IconButton
                                        aria-label="Edit metadata"
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
                                            aria-label="Remove from queue"
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
                                                    Collection Name
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
                                                    Document Source
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
                                                    Focus Area
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
                    <Text fontSize="xs" color="gray.500">
                        {totalPending} pending · {readyToCommit} ready
                        to commit · {committedCount} committed
                    </Text>
                    <HStack>
                        <Button
                            onClick={extractAll}
                            disabled={
                                !hasPendingOrFailed || isProcessing
                            }
                            loading={isProcessing && extractedCount === 0}
                            loadingText="Extracting..."
                            size="sm"
                            className="orange-button"><CheckIcon />Extract All
                                                    </Button>
                        <Button
                            onClick={commitAll}
                            disabled={
                                readyToCommit === 0 || isProcessing
                            }
                            loading={
                                isProcessing && readyToCommit === 0
                            }
                            loadingText="Committing..."
                            size="sm"
                            className="green-button"><CheckIcon />Commit All
                                                    </Button>
                    </HStack>
                </Flex>
            )}
        </VStack>
    );
};

export default BulkUploader;
