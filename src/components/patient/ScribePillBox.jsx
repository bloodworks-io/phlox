import { useState, useCallback } from "react";
import { Box } from "@chakra-ui/react";
import PillBox from "../common/PillBox";
import { LoadingOrb } from "./scribeVisuals";
import {
    RecordButton,
    ModeResetButton,
    TranscriptSendButton,
    TranscriptionFailurePill,
} from "./scribeButtons";

const ScribePillBox = ({
    // Recording state
    isRecording,
    isPaused,
    onStart,
    onPause,
    onResume,
    onSend,
    onReset,
    isLoading,
    // Mode toggle
    isAmbient,
    onModeToggle,
    // Panel handlers
    onOpenTranscription,
    // Panel states
    isTranscriptionOpen,
    // Other
    hasRawTranscription,
    // Audio file drop
    onAudioDrop,
    // Recording gate
    canRecord = true,
    onBlockedRecord,
    // Transcription failure recovery
    sendError,
    onRetry,
    onDownload,
    onDismiss,
}) => {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes("Files")) {
            setIsDragOver(true);
        }
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback(
        async (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);

            if (!canRecord) {
                onBlockedRecord?.();
                return;
            }

            if (!onAudioDrop) return;

            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith("audio/")) {
                await onAudioDrop(file);
            }
        },
        [canRecord, onBlockedRecord, onAudioDrop],
    );

    if (isLoading) {
        return (
            <PillBox
                bottom="20px"
                left="50%"
                transform="translateX(-50%)"
                className="pill-box-scribe"
                px={2}
                py={2}
                gap={0}
            >
                <LoadingOrb size={46} />
            </PillBox>
        );
    }

    if (sendError) {
        return (
            <TranscriptionFailurePill
                sendError={sendError}
                onRetry={onRetry}
                onDownload={onDownload}
                onDismiss={onDismiss}
            />
        );
    }

    return (
        <PillBox
            bottom="20px"
            className="pill-box-scribe"
            left="50%"
            transform="translateX(-50%)"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drop zone overlay */}
            {isDragOver && (
                <Box
                    position="absolute"
                    top="-8px"
                    left="-8px"
                    right="-8px"
                    bottom="-8px"
                    borderRadius="full"
                    border="2px dashed"
                    borderColor="blue.400"
                    bg="rgba(66, 153, 225, 0.15)"
                    zIndex={-1}
                    pointerEvents="none"
                />
            )}

            {/* Left: Mode toggle / Reset */}
            <ModeResetButton
                isRecording={isRecording}
                isAmbient={isAmbient}
                onModeToggle={onModeToggle}
                onReset={onReset}
            />

            {/* Center: Record button */}
            <RecordButton
                isRecording={isRecording}
                isPaused={isPaused}
                onStart={onStart}
                onPause={onPause}
                onResume={onResume}
                size={46}
                canStart={canRecord}
                onBlockedClick={onBlockedRecord}
            />

            {/* Right: Transcript / Send */}
            <TranscriptSendButton
                isRecording={isRecording}
                onOpenTranscription={onOpenTranscription}
                onSend={onSend}
                isTranscriptionOpen={isTranscriptionOpen}
                hasRawTranscription={hasRawTranscription}
            />
        </PillBox>
    );
};

export default ScribePillBox;
