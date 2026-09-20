import { useState, useCallback } from "react";
import { Box, Popover } from "@chakra-ui/react";
import PillBox from "../common/PillBox";
import { LoadingOrb } from "./scribeVisuals";
import {
    RecordButton,
    ResetButton,
    TranscriptSendButton,
    TranscriptionFailurePill,
    ModeSelectButton,
    LiveAgentControls,
    AgentReviewPill,
    AgentErrorPill,
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
    // Mode dial: "dictate" | "ambient" | "agent"
    mode,
    onModeSelect,
    isModeMenuOpen = false,
    onModeMenuOpenChange,
    // Live agent
    isLive,
    isLiveBusy = false,
    liveElapsed = 0,
    onLiveStop,
    liveStatus = "idle",
    liveAgentState = "listening",
    liveArtifactsCount = 0,
    liveBacklogCount = 0,
    isLivePanelExpanded = false,
    onLiveExpand,
    onLiveRetry,
    onLiveDismissReview,
    // Transcript view popover (mutually exclusive with the mode menu)
    transcriptPanel,
    onTranscriptOpenChange,
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
            <Box
                className="anim-fade-slide-up"
                css={{ animationDuration: "0.2s" }}
            >
                <TranscriptionFailurePill
                    sendError={sendError}
                    onRetry={onRetry}
                    onDownload={onDownload}
                    onDismiss={onDismiss}
                />
            </Box>
        );
    }

    if (liveStatus === "review") {
        return (
            <AgentReviewPill
                artifactsCount={liveArtifactsCount}
                onExpand={onLiveExpand}
                onDismiss={onLiveDismissReview}
            />
        );
    }
    if (liveStatus === "error") {
        return (
            <AgentErrorPill
                onRetry={onLiveRetry}
                onDismiss={onLiveDismissReview}
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
                    borderColor="accent"
                    bg="rgba(66, 153, 225, 0.15)"
                    zIndex={-1}
                    pointerEvents="none"
                    className="anim-fade-scale"
                    css={{ animationDuration: "0.15s" }}
                />
            )}

            {/* Left: mode selector (Reset while recording; hidden while the
                pill belongs to the live agent — mode can't change then) */}
            {isLive ? null : isRecording ? (
                <ResetButton onReset={onReset} />
            ) : (
                <ModeSelectButton
                    mode={mode}
                    isLive={isLive}
                    isBusy={isLiveBusy}
                    onSelect={onModeSelect}
                    open={isModeMenuOpen}
                    onOpenChange={onModeMenuOpenChange}
                />
            )}

            {/* Center: live agent minimized view — or the mic */}
            {isLive ? (
                <LiveAgentControls
                    status={liveStatus}
                    agentState={liveAgentState}
                    elapsed={liveElapsed}
                    artifactsCount={liveArtifactsCount}
                    backlogCount={liveBacklogCount}
                    isExpanded={isLivePanelExpanded}
                    onExpand={onLiveExpand}
                    onStop={onLiveStop}
                />
            ) : (
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
            )}

            {/* Right: Transcript / Send */}
            <Popover.Root
                open={isTranscriptionOpen}
                onOpenChange={(d) => onTranscriptOpenChange?.(d.open)}
                positioning={{ placement: "top" }}
                lazyRender
            >
                <TranscriptSendButton
                    isRecording={isRecording && !isLive}
                    onSend={onSend}
                    isTranscriptionOpen={isTranscriptionOpen}
                    hasRawTranscription={hasRawTranscription}
                />
                <Popover.Positioner>
                    <Popover.Content w="280px" p={0}>
                        <Popover.Arrow>
                            <Popover.ArrowTip />
                        </Popover.Arrow>
                        {transcriptPanel}
                    </Popover.Content>
                </Popover.Positioner>
            </Popover.Root>
        </PillBox>
    );
};

export default ScribePillBox;
