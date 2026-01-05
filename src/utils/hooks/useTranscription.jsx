import { useState } from "react";
import { transcriptionApi } from "../api/transcriptionApi";
import { handleProcessingComplete } from "../helpers/processingHelpers";
import { isTauri } from "../helpers/apiConfig";

/**
 * Convert audio to WAV format using the Tauri command (macOS only).
 * This is needed because whisper.cpp only accepts WAV files.
 * Exported for use in components that don't use the useTranscription hook.
 */
export const convertAudioToWav = async (audioBlob) => {
  if (!isTauri()) {
    // Not running in Tauri, skip conversion
    return audioBlob;
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const audioBytes = await audioBlob.arrayBuffer();
    const uint8Array = new Uint8Array(audioBytes);
    const wavBytes = await invoke("convert_audio_to_wav", {
      audioBytes: Array.from(uint8Array),
    });
    return new Blob([new Uint8Array(wavBytes)], { type: "audio/wav" });
  } catch (error) {
    console.error("Audio conversion failed, using original audio:", error);
    // If conversion fails, continue with original audio
    return audioBlob;
  }
};

export const useTranscription = (onTranscriptionComplete, setLoading) => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState(null);

  const transcribeAudio = async (audioBlob, metadata, isAmbient = true) => {
    setIsTranscribing(true);
    setTranscriptionError(null);
    if (setLoading) setLoading(true);

    try {
      // Convert audio to WAV format if in Tauri (macOS)
      const wavBlob = await convertAudioToWav(audioBlob);

      const formData = new FormData();
      formData.append("file", wavBlob, "recording.wav");

      // Add metadata if provided
      if (metadata.name) formData.append("name", metadata.name);
      if (metadata.gender) formData.append("gender", metadata.gender);
      if (metadata.dob) formData.append("dob", metadata.dob);
      if (metadata.templateKey)
        formData.append("templateKey", metadata.templateKey);
      formData.append("isAmbient", isAmbient);

      const data = await transcriptionApi.transcribeAudio(formData);

      if (onTranscriptionComplete) {
        onTranscriptionComplete(data, true);
      }

      return data;
    } catch (error) {
      setTranscriptionError(error.message);
      if (onTranscriptionComplete) {
        onTranscriptionComplete({ error: error.message });
      }
      throw error;
    } finally {
      setIsTranscribing(false);
      if (setLoading) setLoading(false);
    }
  };

  const reprocessTranscription = async (
    transcriptText,
    metadata,
    originalTranscriptionDuration,
    isAmbient = true,
  ) => {
    setIsTranscribing(true);
    setTranscriptionError(null);
    if (setLoading) setLoading(true);

    try {
      const formData = new FormData();
      formData.append("transcript_text", transcriptText);

      // Add metadata if provided
      if (metadata.name) formData.append("name", metadata.name);
      if (metadata.gender) formData.append("gender", metadata.gender);
      if (metadata.dob) formData.append("dob", metadata.dob);
      if (metadata.templateKey)
        formData.append("templateKey", metadata.templateKey);
      formData.append("isAmbient", isAmbient);

      formData.append(
        "original_transcription_duration",
        originalTranscriptionDuration || 0,
      );

      const data = await transcriptionApi.reprocessTranscription(formData);

      if (onTranscriptionComplete) {
        onTranscriptionComplete(data, true);
      }

      return data;
    } catch (error) {
      setTranscriptionError(error.message);
      if (onTranscriptionComplete) {
        onTranscriptionComplete({ error: error.message });
      }
      throw error;
    } finally {
      setIsTranscribing(false);
      if (setLoading) setLoading(false);
    }
  };

  const processDocument = async (file, metadata, options = {}) => {
    setIsTranscribing(true);
    setTranscriptionError(null);
    if (setLoading) setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Add metadata if provided
      if (metadata.name) formData.append("name", metadata.name);
      if (metadata.gender) formData.append("gender", metadata.gender);
      if (metadata.dob) formData.append("dob", metadata.dob);
      if (metadata.templateKey)
        formData.append("templateKey", metadata.templateKey);

      const data = await transcriptionApi.processDocument(formData);

      // Process document results if handler is provided
      if (options.handleComplete) {
        options.handleComplete(data);
      }

      return data;
    } catch (error) {
      setTranscriptionError(error.message);
      if (options.handleError) {
        options.handleError(error);
      }
      throw error;
    } finally {
      setIsTranscribing(false);
      if (setLoading) setLoading(false);
    }
  };

  return {
    transcribeAudio,
    processDocument,
    reprocessTranscription,
    isTranscribing,
    transcriptionError,
  };
};
