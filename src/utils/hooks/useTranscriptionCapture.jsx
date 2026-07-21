import { useState, useCallback } from "react";

export const useTranscriptionCapture = () => {
    const [hasTranscriptionOccurred, setHasTranscriptionOccurred] =
        useState(false);
    const [initialTranscriptionContent, setInitialTranscriptionContent] =
        useState({});

    const capture = useCallback((content) => {
        setInitialTranscriptionContent({ ...content });
        setHasTranscriptionOccurred(true);
    }, []);

    const reset = useCallback(() => {
        setInitialTranscriptionContent({});
        setHasTranscriptionOccurred(false);
    }, []);

    return {
        hasTranscriptionOccurred,
        initialTranscriptionContent,
        capture,
        reset,
    };
};
