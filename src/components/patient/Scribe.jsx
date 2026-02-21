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

  // Transcription API
  const { transcribeAudio, isTranscribing } = useTranscription((data) => {
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
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream
        ?.getTracks()
        .forEach((track) => track.stop());
    }
    mediaRecorderRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Microphone access is not supported in this browser.");
      return;
    }

    // Clear previous recording chunks when starting a new recording
    // (previous recording was already sent, so this is a fresh start)
    completeRecordingRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setTimer(0);
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Could not access microphone. Please check your permissions.");
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

          // Send for transcription
          try {
            await transcribeAudio(
              blob,
              { name, gender, dob, templateKey: template?.template_key },
              isAmbient,
            );
          } catch (error) {
            console.error("Transcription failed:", error);
          }

          resolve(blob);
        };
        mediaRecorderRef.current.stop();
      } else {
        resolve(null);
      }
    });
  }, [isRecording, transcribeAudio, name, gender, dob, template, isAmbient, onSendStart]);

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

      try {
        await transcribeAudio(
          file,
          { name, gender, dob, templateKey: template?.template_key },
          isAmbient,
        );
        return true;
      } catch (error) {
        console.error("Audio file transcription failed:", error);
        return false;
      }
    },
    [transcribeAudio, name, gender, dob, template, isAmbient],
  );

  return {
    // State
    isAmbient,
    isRecording,
    isPaused,
    timer,
    isLoading: isTranscribing,

    // Actions
    startRecording,
    pauseRecording,
    resumeRecording,
    stopAndSendRecording,
    resetRecording,
    toggleAmbientMode,
    handleAudioDrop,
  };
};

// The actual UI is in ScribePillBox and the panels
const Scribe = ({ children }) => {
  return children || null;
};

export default Scribe;
