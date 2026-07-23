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

const StatusIcon = ({ status }) => {
    switch (status) {
        case STATUS.EXTRACTING:
        case STATUS.COMMITTING:
            return <Spinner size="xs" mr="2" />;
        case STATUS.EXTRACTED:
            return <CheckIcon color="successButton" mr="2" boxSize={3} />;
        case STATUS.COMMITTED:
            return (
                <CheckIcon color="successButton" mr="2" boxSize={3} />
            );
        case STATUS.FAILED:
            return <WarningIcon color="dangerButton" mr="2" boxSize={3} />;
        default:
            return null;
    }
};

const BulkUploader = ({ setCollections }) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [expandedFile, setExpandedFile] = useState(null);
    const fileInputRef = useRef(null);

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
            toaster.create({
                title: "No PDF files",
                description: "Only PDF files are supported",
                type: "warning",
                duration: 3000,
            });
            return;
        }
        if (files.length > pdfFiles.length) {
            toaster.create({
                title: "Some files skipped",
                description: `${files.length - pdfFiles.length} non-PDF file(s) were ignored`,
                type: "info",
                duration: 3000,
            });
        }
        addFiles(pdfFiles);
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            addFiles(files);
        }
        e.target.value = "";
    };

    // --- Status icon ---

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
                                _hover={{ bg: "surfaceMuted" }}
                            >
                                <Box mr="2" color="dangerButton" asChild><FaFilePdf /></Box>
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
                                            ? "dangerButton"
                                            : "overlay0"
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
                    <Text fontSize="xs" color="overlay0">
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
