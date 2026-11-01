import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import ScribePillBox from "./ScribePillBox";
import { renderWithProviders } from "../../test/utils";

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
});

const baseProps = {
    isRecording: false,
    isPaused: false,
    onStart: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onSend: vi.fn(),
    onReset: vi.fn(),
    isLoading: false,
    mode: "dictate",
    onModeSelect: vi.fn(),
    isModeMenuOpen: false,
    onModeMenuOpenChange: vi.fn(),
    isLive: false,
    isLiveBusy: false,
    liveStatus: "idle",
    transcriptPanel: <div>Seed transcript</div>,
    onTranscriptOpenChange: vi.fn(),
    isTranscriptionOpen: false,
    hasRawTranscription: true,
    onAudioDrop: vi.fn(),
    canRecord: true,
    onBlockedRecord: vi.fn(),
    sendError: null,
    onRetry: vi.fn(),
    onDownload: vi.fn(),
    onDismiss: vi.fn(),
};

const renderScribe = (overrides = {}) =>
    renderWithProviders(<ScribePillBox {...baseProps} {...overrides} />);

const centerButton = () => screen.getAllByRole("button")[1];

describe("ScribePillBox branch precedence", () => {
    it("renders only the loading pill while processing", () => {
        const { container } = renderScribe({
            isLoading: true,
            sendError: new Error("failure"),
            liveStatus: "review",
        });

        expect(container.querySelector(".pill-box-scribe")).not.toBeNull();
        expect(container.querySelectorAll("button")).toHaveLength(0);
    });

    it("renders the transcription failure recovery pill before live states", () => {
        renderScribe({
            sendError: { message: "Server failed" },
            liveStatus: "review",
        });

        expect(screen.getByText("Transcription failed")).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /resume live session/i }),
        ).not.toBeInTheDocument();

        const buttons = screen.getAllByRole("button");
        fireEvent.click(buttons[0]);
        fireEvent.click(buttons[1]);
        fireEvent.click(buttons[2]);
        expect(baseProps.onRetry).toHaveBeenCalledTimes(1);
        expect(baseProps.onDownload).toHaveBeenCalledTimes(1);
        expect(baseProps.onDismiss).toHaveBeenCalledTimes(1);
    });
});

describe("ScribePillBox ordinary capture controls", () => {
    it("starts, pauses, resumes, resets, and sends through the three-slot pill", () => {
        renderScribe();
        fireEvent.click(centerButton());
        expect(baseProps.onStart).toHaveBeenCalledTimes(1);

        cleanup();
        renderScribe({ isRecording: true });
        expect(screen.getAllByRole("button")).toHaveLength(3);
        fireEvent.click(screen.getAllByRole("button")[0]);
        fireEvent.click(screen.getAllByRole("button")[1]);
        fireEvent.click(screen.getAllByRole("button")[2]);
        expect(baseProps.onReset).toHaveBeenCalledTimes(1);
        expect(baseProps.onPause).toHaveBeenCalledTimes(1);
        expect(baseProps.onSend).toHaveBeenCalledTimes(1);

        cleanup();
        renderScribe({ isRecording: true, isPaused: true });
        fireEvent.click(centerButton());
        expect(baseProps.onResume).toHaveBeenCalledTimes(1);
    });

    it("routes a blocked start through the recording gate", () => {
        renderScribe({
            canRecord: false,
            onBlockedRecord: baseProps.onBlockedRecord,
        });

        fireEvent.click(centerButton());
        expect(baseProps.onStart).not.toHaveBeenCalled();
        expect(baseProps.onBlockedRecord).toHaveBeenCalledTimes(1);
    });

    it("keeps the transcript trigger unavailable when no raw transcript exists", () => {
        renderScribe({ hasRawTranscription: false });

        const transcript = screen.getByRole("button", {
            name: "No transcript available",
        });
        expect(transcript).toHaveStyle({ pointerEvents: "none" });
        expect(transcript).toHaveStyle({ opacity: "0.4" });
    });

    it("exposes the transcript trigger when a raw transcript exists", () => {
        renderScribe({ hasRawTranscription: true });

        expect(screen.getByRole("button", { name: "Transcript" })).toBeInTheDocument();
    });
});

function ModeHarness() {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState("dictate");
    return (
        <ScribePillBox
            {...baseProps}
            mode={mode}
            isModeMenuOpen={open}
            onModeMenuOpenChange={setOpen}
            onModeSelect={setMode}
        />
    );
}

describe("ScribePillBox mode menu", () => {
    it("opens the mode menu and selects ambient capture", async () => {
        renderWithProviders(<ModeHarness />);

        fireEvent.click(
            screen.getByRole("button", { name: /capture mode: dictate/i }),
        );
        const ambient = await screen.findByRole("button", {
            name: /ambient captures the whole consultation/i,
        });
        fireEvent.click(ambient);

        expect(
            screen.getByRole("button", { name: /capture mode: ambient/i }),
        ).toBeInTheDocument();
    });
});

describe("ScribePillBox audio drop gate", () => {
    it("accepts an audio file drop", () => {
        const { container } = renderScribe();
        const pill = container.querySelector(".pill-box-scribe");
        const file = new File(["audio"], "consultation.webm", {
            type: "audio/webm",
        });

        fireEvent.dragOver(pill, {
            dataTransfer: { types: ["Files"] },
        });
        fireEvent.drop(pill, {
            dataTransfer: { files: [file], types: ["Files"] },
        });

        expect(baseProps.onAudioDrop).toHaveBeenCalledWith(file);
    });

    it("routes a blocked drop through the recording gate", () => {
        const { container } = renderScribe({
            canRecord: false,
            onBlockedRecord: baseProps.onBlockedRecord,
        });
        const pill = container.querySelector(".pill-box-scribe");

        fireEvent.drop(pill, {
            dataTransfer: { files: [], types: ["Files"] },
        });

        expect(baseProps.onAudioDrop).not.toHaveBeenCalled();
        expect(baseProps.onBlockedRecord).toHaveBeenCalledTimes(1);
    });

    it("ignores non-audio files", () => {
        const { container } = renderScribe();
        const pill = container.querySelector(".pill-box-scribe");
        const file = new File(["text"], "note.txt", { type: "text/plain" });

        fireEvent.drop(pill, {
            dataTransfer: { files: [file], types: ["Files"] },
        });

        expect(baseProps.onAudioDrop).not.toHaveBeenCalled();
    });
});
