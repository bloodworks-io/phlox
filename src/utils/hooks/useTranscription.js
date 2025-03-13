import { useState } from "react";
import { transcriptionApi } from "../api/transcriptionApi";
import { handleProcessingComplete } from "../helpers/processingHelpers";

export const useTranscription = (onTranscriptionComplete, setLoading) => {
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcriptionError, setTranscriptionError] = useState(null);

    const transcribeAudio = async (audioBlob, metadata) => {
        setIsTranscribing(true);
        setTranscriptionError(null);
        if (setLoading) setLoading(true);

        try {
            const formData = new FormData();
            formData.append("file", audioBlob, "recording.wav");

            // Add metadata if provided
            if (metadata.name) formData.append("name", metadata.name);
            if (metadata.gender) formData.append("gender", metadata.gender);
            if (metadata.dob) formData.append("dob", metadata.dob);
            if (metadata.templateKey)
                formData.append("templateKey", metadata.templateKey);

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

            formData.append(
                "original_transcription_duration",
                originalTranscriptionDuration || 0,
            );

            const data =
                await transcriptionApi.reprocessTranscription(formData);

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
