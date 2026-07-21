import { useState, useCallback } from "react";
import { toaster } from "@/components/ui/toaster";
import { ragApi } from "../api/ragApi";
import { extractPdfMetadata } from "../helpers/pdfExtractHelpers";

export const STATUS = {
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

export const useBulkUploadQueue = ({ setCollections } = {}) => {
    const [fileQueue, setFileQueue] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const addFiles = useCallback((files) => {
        const newEntries = files.map(makeQueueEntry);
        setFileQueue((prev) => [...prev, ...newEntries]);
    }, []);

    const removeFromQueue = useCallback((id) => {
        setFileQueue((prev) => prev.filter((entry) => entry.id !== id));
    }, []);

    const updateQueueEntry = useCallback((id, updates) => {
        setFileQueue((prev) =>
            prev.map((entry) =>
                entry.id === id ? { ...entry, ...updates } : entry,
            ),
        );
    }, []);

    const updateMetadata = useCallback((id, field, value) => {
        setFileQueue((prev) =>
            prev.map((entry) =>
                entry.id === id
                    ? { ...entry, metadata: { ...entry.metadata, [field]: value } }
                    : entry,
            ),
        );
    }, []);

    const extractAll = useCallback(async () => {
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
                        title: result.title,
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

        if (pending.length > 0) {
            // Re-read latest state via setFileQueue callback to compute counts.
            setFileQueue((current) => {
                const failedCount = pending.filter((p) => {
                    const e = current.find((f) => f.id === p.id);
                    return e?.status === STATUS.FAILED;
                }).length;
                if (failedCount === 0) {
                    toaster.create({
                        title: "Extraction Complete",
                        description: `Successfully extracted ${pending.length} file(s)`,
                        type: "success",
                        duration: 3000,
                    });
                } else {
                    toaster.create({
                        title: "Extraction Partially Complete",
                        description: `${pending.length - failedCount} of ${pending.length} file(s) extracted successfully`,
                        type: "warning",
                        duration: 3000,
                    });
                }
                return current;
            });
        }
    }, [fileQueue, updateQueueEntry]);

    const commitAll = useCallback(async () => {
        if (!setCollections) return;
        setIsProcessing(true);
        const ready = fileQueue.filter((e) => e.status === STATUS.EXTRACTED);

        let committedCount = 0;
        for (const entry of ready) {
            updateQueueEntry(entry.id, { status: STATUS.COMMITTING });

            try {
                if (entry.extractedText) {
                    await ragApi.commitDirect({
                        extracted_text: entry.extractedText,
                        disease_name: entry.metadata.disease_name,
                        focus_area: entry.metadata.focus_area,
                        document_source: entry.metadata.document_source,
                        filename: entry.metadata.filename,
                        title: entry.metadata.title || null,
                        pdf_base64: entry.pdfBase64 || null,
                    });
                } else {
                    await ragApi.commitToDatabase({
                        disease_name: entry.metadata.disease_name,
                        focus_area: entry.metadata.focus_area,
                        document_source: entry.metadata.document_source,
                        filename: entry.metadata.filename,
                        title: entry.metadata.title || null,
                    });
                }
                updateQueueEntry(entry.id, {
                    status: STATUS.COMMITTED,
                    extractedText: null,
                });
                committedCount++;
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

        toaster.create({
            title: "Commit Complete",
            description: `${committedCount} of ${ready.length} file(s) committed successfully`,
            type: committedCount === ready.length ? "success" : "warning",
            duration: 3000,
        });
    }, [fileQueue, setCollections, updateQueueEntry]);

    return {
        fileQueue,
        isProcessing,
        addFiles,
        removeFromQueue,
        updateQueueEntry,
        updateMetadata,
        extractAll,
        commitAll,
        extractedCount: fileQueue.filter(
            (e) => e.status === STATUS.EXTRACTED || e.status === STATUS.COMMITTED,
        ).length,
        committedCount: fileQueue.filter((e) => e.status === STATUS.COMMITTED)
            .length,
        totalPending: fileQueue.filter((e) => e.status === STATUS.PENDING)
            .length,
        readyToCommit: fileQueue.filter((e) => e.status === STATUS.EXTRACTED)
            .length,
        hasPendingOrFailed: fileQueue.some(
            (e) => e.status === STATUS.PENDING || e.status === STATUS.FAILED,
        ),
    };
};
