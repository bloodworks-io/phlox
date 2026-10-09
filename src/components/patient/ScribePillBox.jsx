import { useState, useCallback, useEffect, useRef } from "react";
import { Box, Text } from "@chakra-ui/react";
import PillBox from "../common/PillBox";
import { LoadingOrb } from "./scribeVisuals";
import { SpeakerDot } from "../transcript/SpeakerText";
import { onCaptureSegment } from "../../localBackend/capture";
import {
    RecordButton,
    ModeResetButton,
    TranscriptSendButton,
    TranscriptionFailurePill,
} from "./scribeButtons";

const LIVE_TRANSCRIPT_MAX_LINES = 40;

/** Live partial transcript: capture segments as they land during recording. */
const LiveCapturePanel = ({ segments, words }) => (
    <Box
        position="fixed"
        bottom="92px"
        left="50%"
        transform="translateX(-50%)"
        width="300px"
        maxHeight="220px"
        overflowY="auto"
        p={3}
        borderRadius="xl"
        backdropFilter="blur(12px)"
        pointerEvents="none"
        css={{
            "&::-webkit-scrollbar": { width: "4px" },
            "&::-webkit-scrollbar-track": { background: "transparent" },
            "&::-webkit-scrollbar-thumb": {
                background: "var(--chakra-colors-scrollbar-thumb)",
                borderRadius: "24px",
            },
        }}
    >
        {segments.map((segment, index) => (
            <Text key={index} as="div" whiteSpace="pre-wrap" fontSize="xs" lineHeight="1.5">
                {segment.speaker ? <SpeakerDot speaker={segment.speaker} /> : null}
                {segment.text}
            </Text>
        ))}
        <Text fontSize="10px" color="overlay0" pt={1}>
            {words} words · capturing
        </Text>
    </Box>
);

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
    const [liveSegments, setLiveSegments] = useState(
        /** @type {{ speaker: string | null, text: string }[]} */ ([]),
    );
    const [liveWords, setLiveWords] = useState(0);
    const liveRef = useRef({ segments: [], words: 0 });

    // Live partial transcript: reset on record start, append per utterance.
    useEffect(() => {
        if (!isRecording) return;
        liveRef.current = { segments: [], words: 0 };
        setLiveSegments([]);
        setLiveWords(0);
        return onCaptureSegment((event) => {
            const live = liveRef.current;
            live.segments.push({ speaker: event.speaker, text: event.text });
            if (live.segments.length > LIVE_TRANSCRIPT_MAX_LINES) live.segments.shift();
            live.words = event.words;
            setLiveSegments([...live.segments]);
            setLiveWords(live.words);
        });
    }, [isRecording]);

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
            {/* Live partial transcript while capturing */}
        {isRecording && !isPaused && liveSegments.length > 0 && (
            <LiveCapturePanel segments={liveSegments} words={liveWords} />
        )}

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
                    borderColor="accent"
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
