import { useEffect, useState, useRef, useCallback } from "react";
import { useTranscription } from "../../utils/hooks/useTranscription";
import { settingsService } from "../../utils/settings/settingsUtils";

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
    const [isAmbient, setIsAmbient] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [timer, setTimer] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const completeRecordingRef = useRef([]);
    const timerIntervalRef = useRef(null);

    const [sendError, setSendError] = useState(null); // null = ok, else { message }
    const lastFailedRef = useRef({ blob: null, meta: null, isAmbient: null });

    // Transcription API
    const { transcribeAudio, isTranscribing } = useTranscription((data) => {
        if (data?.error) return;
        handleTranscriptionComplete({
            fields: data.fields,
            rawTranscription: data.rawTranscription,
            transcriptionDuration: data.transcriptionDuration,
            processDuration: data.processDuration,
        });
    }, setLoading);

    // Fetch user settings on mount
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                await settingsService.fetchUserSettings((data) => {
                    if (data && typeof data.scribe_is_ambient === "boolean") {
                        setIsAmbient(data.scribe_is_ambient);
                    }
                });
            } catch (error) {
                console.error("Error fetching user settings:", error);
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

    // Reset when patient changes
    useEffect(() => {
        resetRecordingState();
    }, [name, dob, gender]);

    const resetRecordingState = useCallback(() => {
        setIsRecording(false);
        setIsPaused(false);
        setTimer(0);
        audioChunksRef.current = [];
        completeRecordingRef.current = [];
        setSendError(null);
        lastFailedRef.current = { blob: null, meta: null, isAmbient: null };
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stream
                ?.getTracks()
                .forEach((track) => track.stop());
        }
        mediaRecorderRef.current = null;
    }, []);

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
                const message = error?.message || "Transcription failed";
                setSendError({ message });
                return false;
            }
        },
        [transcribeAudio, isAmbient, clearLastFailed],
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
            const message = error?.message || "Transcription failed";
            setSendError({ message });
            return false;
        }
    }, [transcribeAudio, clearLastFailed]);

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

    const startRecording = useCallback(async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            alert("Microphone access is not supported in this browser.");
            return;
        }

        completeRecordingRef.current = [];

        setSendError(null);
        lastFailedRef.current = { blob: null, meta: null, isAmbient: null };

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            mediaRecorderRef.current = new MediaRecorder(stream);

            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setTimer(0);
        } catch (error) {
            console.error("Error starting recording:", error);
            alert(
                "Could not access microphone. Please check your permissions.",
            );
        }
    }, []);

    const pauseRecording = useCallback(() => {
        mediaRecorderRef.current?.pause();
        setIsPaused(true);
    }, []);

    const resumeRecording = useCallback(() => {
        mediaRecorderRef.current?.resume();
        setIsPaused(false);
    }, []);

    const stopAndSendRecording = useCallback(async () => {
        // Collapse any open panels when sending
        if (onSendStart) {
            onSendStart();
        }
        return new Promise((resolve) => {
            if (isRecording && mediaRecorderRef.current) {
                mediaRecorderRef.current.onstop = async () => {
                    completeRecordingRef.current = [
                        ...completeRecordingRef.current,
                        ...audioChunksRef.current,
                    ];
                    const blob = new Blob(completeRecordingRef.current, {
                        type: "audio/wav",
                    });
                    audioChunksRef.current = [];
                    setIsRecording(false);
                    setIsPaused(false);

                    await sendForTranscription(blob, {
                        name,
                        gender,
                        dob,
                        templateKey: template?.template_key,
                        noteId,
                    });

                    resolve(blob);
                };
                mediaRecorderRef.current.stop();
            } else {
                resolve(null);
            }
        });
    }, [
        isRecording,
        sendForTranscription,
        name,
        gender,
        dob,
        template,
        noteId,
        onSendStart,
    ]);

    const resetRecording = useCallback(() => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
        }
        resetRecordingState();
    }, [isRecording, resetRecordingState]);

    const toggleAmbientMode = useCallback(async () => {
        const newValue = !isAmbient;
        setIsAmbient(newValue);
        try {
            await settingsService.saveAmbientMode(newValue);
        } catch (error) {
            console.error("Failed to save ambient mode setting:", error);
        }
    }, [isAmbient]);

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
        isRecording,
        isPaused,
        timer,
        isLoading: isTranscribing,
        sendError,

        // Actions
        startRecording,
        pauseRecording,
        resumeRecording,
        stopAndSendRecording,
        resetRecording,
        toggleAmbientMode,
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
