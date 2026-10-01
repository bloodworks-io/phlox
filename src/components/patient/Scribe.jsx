import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useTranscription } from "../../utils/hooks/useTranscription";
import { settingsApi } from "../../utils/api/settingsApi";
import { captureApi } from "../../utils/api/captureApi";
import { AudioRecorder } from "../../utils/audioRecorder";
import { isTauri } from "../../utils/helpers/apiConfig";

export const SCRIBE_MODE_STORAGE_KEY = "phlox-scribe-mode";

const CAPTURE_TAIL_SETTLE_MS = 1200;

// Hook to manage scribe state and logic
// This can be used by ScribePillBox to control recording
export const useScribe = ({
    name,
    dob,
    gender,
    template,
    noteId,
    handleTranscriptionComplete,
    setLoading,
    onSendStart,
}) => {
    const { t } = useTranslation();
    const [isAmbient, setIsAmbient] = useState(
        () => localStorage.getItem(SCRIBE_MODE_STORAGE_KEY) !== "dictate",
    );
    const [requireConsent, setRequireConsent] = useState(false);
    const [streamingCapture, setStreamingCapture] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isFinishing, setIsFinishing] = useState(false);
    const [timer, setTimer] = useState(0);
    const audioRecorderRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const captureRef = useRef(null);

    const [sendError, setSendError] = useState(null); // null = ok, else { message }
    const lastFailedRef = useRef({ blob: null, meta: null, isAmbient: null });

    // Transcription API
    const { transcribeAudio, finalizeCaptureSession, isTranscribing } =
        useTranscription((data) => {
            if (data?.error) return;
            handleTranscriptionComplete({
                fields: data.fields,
                rawTranscription: data.rawTranscription,
                transcriptionDuration: data.transcriptionDuration,
                processDuration: data.processDuration,
            });
        }, setLoading);

    // Fetch system-policy settings on mount
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const globalConfig = await settingsApi.fetchConfig();
                setRequireConsent(Boolean(globalConfig?.REQUIRE_SCRIBE_CONSENT));
                setStreamingCapture(
                    isTauri() || globalConfig?.STREAMING_CAPTURE_ENABLED === true,
                );
            } catch (error) {
                console.error("Error fetching settings:", error);
            }
        };
        fetchSettings();
    }, []);

    // Timer effect
    useEffect(() => {
        if (isRecording && !isPaused) {
            timerIntervalRef.current = setInterval(() => {
                setTimer((prev) => prev + 1);
            }, 1000);
        } else {
            clearInterval(timerIntervalRef.current);
        }
        return () => clearInterval(timerIntervalRef.current);
    }, [isRecording, isPaused]);

    const resetRecordingState = useCallback(() => {
        setIsRecording(false);
        setIsPaused(false);
        setTimer(0);
        setSendError(null);
        lastFailedRef.current = { blob: null, meta: null, isAmbient: null };
        captureRef.current = null;
        if (audioRecorderRef.current) {
            audioRecorderRef.current.stop().catch(() => {});
        }
        audioRecorderRef.current = null;
    }, []);

    // Reset when patient changes
    useEffect(() => {
        resetRecordingState();
    }, [name, dob, gender, resetRecordingState]);

    const clearLastFailed = useCallback(() => {
        lastFailedRef.current = { blob: null, meta: null, isAmbient: null };
        setSendError(null);
    }, []);

    const sendForTranscription = useCallback(
        async (blob, meta) => {
            try {
                await transcribeAudio(blob, meta, isAmbient);
                clearLastFailed();
                return true;
            } catch (error) {
                console.error("Transcription failed:", error);
                lastFailedRef.current = { blob, meta: { ...meta }, isAmbient };
                const message = error?.message || t("patient.transcriptionFailed");
                setSendError({ message });
                return false;
            }
        },
        [transcribeAudio, isAmbient, clearLastFailed, t],
    );

    const retrySend = useCallback(async () => {
        const { blob, meta, isAmbient: ambient } = lastFailedRef.current;
        if (!blob) return false;
        try {
            await transcribeAudio(blob, meta, ambient);
            clearLastFailed();
            return true;
        } catch (error) {
            console.error("Transcription retry failed:", error);
            const message = error?.message || t("patient.transcriptionFailed");
            setSendError({ message });
            return false;
        }
    }, [transcribeAudio, clearLastFailed, t]);

    const downloadLastRecording = useCallback(() => {
        const { blob } = lastFailedRef.current;
        if (!blob) return;
        const ext = blob.type.includes("wav")
            ? "wav"
            : blob.type.includes("webm")
              ? "webm"
              : "audio";
        const stamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-")
            .slice(0, 19);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `recording_${stamp}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, []);

    const dismissSendError = useCallback(() => {
        clearLastFailed();
    }, [clearLastFailed]);

    const startCaptureStreaming = useCallback(
        async (recorder) => {
            try {
                const { session_id } = await captureApi.startSession({
                    mode: isAmbient ? "ambient" : "dictate",
                    templateKey: template?.template_key,
                    name,
                    gender,
                    dob,
                    noteId,
                });
                // Recording may have been stopped while the session was
                // being created; don't arm a stale session.
                if (audioRecorderRef.current !== recorder) {
                    return;
                }
                captureRef.current = { id: session_id, failures: 0 };
                recorder.enableSegmentStreaming(async (blob) => {
                    const capture = captureRef.current;
                    if (!capture) return;
                    try {
                        await captureApi.sendAudioChunk(capture.id, blob);
                    } catch (error) {
                        console.error("Capture segment upload failed:", error);
                        capture.failures += 1;
                    }
                });
            } catch (error) {
                console.warn("Streaming capture unavailable; using batch:", error);
                captureRef.current = null;
            }
        },
        [isAmbient, template, name, gender, dob, noteId],
    );

    const startRecording = useCallback(async () => {
        try {
            const recorder = new AudioRecorder();
            await recorder.start();
            audioRecorderRef.current = recorder;
            setIsRecording(true);
            setTimer(0);
            if (streamingCapture) {
                startCaptureStreaming(recorder);
            }
        } catch (error) {
            console.error("Error starting recording:", error);
            alert(t("patient.microphoneAccessError"));
        }
    }, [t, streamingCapture, startCaptureStreaming]);

    const pauseRecording = useCallback(() => {
        audioRecorderRef.current?.pause();
        setIsPaused(true);
    }, []);

    const resumeRecording = useCallback(() => {
        audioRecorderRef.current?.resume();
        setIsPaused(false);
    }, []);

    const stopAndSendRecording = useCallback(async () => {
        // Collapse any open panels when sending
        if (onSendStart) {
            onSendStart();
        }
        if (!isRecording || !audioRecorderRef.current) {
            return null;
        }
        setIsFinishing(true);
        try {
            const recorder = audioRecorderRef.current;
            audioRecorderRef.current = null;
            setIsRecording(false);
            setIsPaused(false);
            const blob = await recorder.stop();
            const meta = {
                name,
                gender,
                dob,
                templateKey: template?.template_key,
                noteId,
            };

            // Streaming capture path: settle the flushed tail utterance, then
            // finalize. Any failure or server fallback reruns as batch with the
            // full-recording WAV.
            const capture = captureRef.current;
            captureRef.current = null;
            if (capture && capture.failures === 0) {
                await new Promise((resolve) =>
                    setTimeout(resolve, CAPTURE_TAIL_SETTLE_MS),
                );
                const data = await finalizeCaptureSession(capture.id);
                if (!data?.fallback) {
                    return blob;
                }
                console.warn(
                    "Streaming capture fell back to batch:",
                    data.reason,
                );
            }

            await sendForTranscription(blob, meta);
            return blob;
        } finally {
            setIsFinishing(false);
        }
    }, [
        isRecording,
        sendForTranscription,
        finalizeCaptureSession,
        name,
        gender,
        dob,
        template,
        noteId,
        onSendStart,
    ]);

    const resetRecording = useCallback(() => {
        if (isRecording && audioRecorderRef.current) {
            audioRecorderRef.current.stop().catch(() => {});
            audioRecorderRef.current = null;
        }
        resetRecordingState();
    }, [isRecording, resetRecordingState]);

    // Capture-mode selection for the pill's mode dial. The live agent is
    // armed/persisted by PatientDetails; only dictate/ambient land here.
    const selectCaptureMode = useCallback((mode) => {
        if (mode !== "dictate" && mode !== "ambient") return;
        setIsAmbient(mode === "ambient");
        localStorage.setItem(SCRIBE_MODE_STORAGE_KEY, mode);
    }, []);

    // Handle audio file drop
    const handleAudioDrop = useCallback(
        async (file) => {
            if (!file.type.startsWith("audio/")) {
                return false;
            }

            return sendForTranscription(file, {
                name,
                gender,
                dob,
                templateKey: template?.template_key,
                noteId,
            });
        },
        [sendForTranscription, name, gender, dob, template, noteId],
    );

    return {
        // State
        isAmbient,
        requireConsent,
        isRecording,
        isPaused,
        timer,
        isLoading: isTranscribing || isFinishing,
        sendError,

        // Actions
        startRecording,
        pauseRecording,
        resumeRecording,
        stopAndSendRecording,
        resetRecording,
        selectCaptureMode,
        handleAudioDrop,
        retrySend,
        downloadLastRecording,
        dismissSendError,
    };
};

// The actual UI is in ScribePillBox and the panels
const Scribe = ({ children }) => {
    return children || null;
};

export default Scribe;
