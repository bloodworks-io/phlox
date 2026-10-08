import { useState } from "react";
import { SCRIBE_MODE_STORAGE_KEY } from "@/components/patient/Scribe";
import type { ScribeMode } from "../patient/types";

interface UseScribeModeArgs {
    scribeControls: {
        isAmbient: boolean;
        selectCaptureMode: (mode: ScribeMode) => void;
        startRecording: () => void;
    };
    liveAgent: {
        isLiveActive: boolean;
        startLive: () => void;
        stopLive: () => void;
    };
    openPanel: (panel: string) => void;
    closePanel: (panel: string) => void;
}

export const useScribeMode = ({
    scribeControls,
    liveAgent,
    openPanel,
    closePanel,
}: UseScribeModeArgs) => {
    // Picking agent arms it — mic click starts the session; other picks end it.
    const [agentArmed, setAgentArmed] = useState(
        () => localStorage.getItem(SCRIBE_MODE_STORAGE_KEY) === "agent",
    );
    // Mode popover and transcript panel are mutually exclusive.
    const [modeMenuOpen, setModeMenuOpen] = useState(false);
    const [isLiveExpanded, setIsLiveExpanded] = useState(false);

    const scribeMode: ScribeMode =
        agentArmed || liveAgent.isLiveActive
            ? "agent"
            : scribeControls.isAmbient
              ? "ambient"
              : "dictate";

    // Agent mode: mic click starts the live session; the panel keeps its
    // current expanded/collapsed state.
    const handleRecordStart = () => {
        if (scribeMode === "agent") {
            liveAgent.startLive();
            return;
        }
        scribeControls.startRecording();
    };

    const handleModeSelect = (mode: ScribeMode) => {
        localStorage.setItem(SCRIBE_MODE_STORAGE_KEY, mode);
        if (mode === "agent") {
            if (liveAgent.isLiveActive) return;
            setAgentArmed(true);
            return;
        }
        setAgentArmed(false);
        if (liveAgent.isLiveActive) {
            liveAgent.stopLive();
        }
        scribeControls.selectCaptureMode(mode);
    };

    const handleLiveStop = () => {
        if (liveAgent.isLiveActive) liveAgent.stopLive();
    };

    const handleLiveResume = () => {
        if (liveAgent.isLiveActive) return;
        liveAgent.startLive();
    };

    const handleTranscriptOpenChange = (nextOpen: boolean) => {
        if (nextOpen) {
            setModeMenuOpen(false);
            openPanel("transcription");
        } else {
            closePanel("transcription");
        }
    };

    const handleModeMenuOpenChange = (open: boolean) => {
        setModeMenuOpen(open);
        if (open) closePanel("transcription");
    };

    const toggleLiveExpand = () => setIsLiveExpanded((open) => !open);

    return {
        scribeMode,
        isLiveExpanded,
        isModeMenuOpen: modeMenuOpen,
        toggleLiveExpand,
        handleModeSelect,
        handleLiveStop,
        handleLiveResume,
        handleRecordStart,
        handleTranscriptOpenChange,
        handleModeMenuOpenChange,
    };
};
