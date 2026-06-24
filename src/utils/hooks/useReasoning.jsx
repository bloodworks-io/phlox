import { useState, useRef, useEffect, useCallback } from "react";
import { Steps } from "@chakra-ui/react";
import { useToast } from "@/utils/useToastShim";
import { patientApi } from "../api/patientApi";


export const useReasoning = (options = {}) => {
    const { noteId, initialReasoning, onReasoningGenerated } = options;

    const [isReasoningOpen, setIsReasoningOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [reasoning, setReasoning] = useState(initialReasoning ?? null);
    const [status, setStatus] = useState(null);
    const [tabIndex, setTabIndex] = useState("0");
    const [dimensions, setDimensions] = useState({
        width: 500,
        height: 420,
    });
    const resizerRef = useRef(null);
    const toast = useToast();

    // Update reasoning when initialReasoning changes
    useEffect(() => {
        if (initialReasoning !== undefined) {
            setReasoning(initialReasoning);
        }
    }, [noteId, initialReasoning]);

    // Only provide API handler if noteId is available
    const handleGenerateReasoning = useCallback(async () => {
        if (!noteId) return;

        setLoading(true);
        setStatus("Initializing reasoning engine...");
        try {
            const res = await patientApi.generateReasoningStream(
                noteId,
                (statusMessage) => setStatus(statusMessage),
                toast,
            );
            setReasoning(res);
            if (onReasoningGenerated) {
                onReasoningGenerated(res);
            }
            setStatus(null);
        } catch (error) {
            console.error("Error generating reasoning:", error);
            setStatus(null);
        } finally {
            setLoading(false);
        }
    }, [noteId, toast, onReasoningGenerated]);

    const openReasoning = useCallback(() => {
        setIsReasoningOpen(true);
    }, []);

    const closeReasoning = useCallback(() => {
        setIsReasoningOpen(false);
    }, []);

    const toggleReasoning = useCallback(() => {
        setIsReasoningOpen((prev) => !prev);
    }, []);

    const updateDimensions = useCallback((newDimensions) => {
        setDimensions((prev) => ({
            ...prev,
            ...newDimensions,
        }));
    }, []);

    const resetReasoning = useCallback(() => {
        setReasoning(null);
        setLoading(false);
        setStatus(null);
    }, []);

    // Resize handlers for drag functionality
    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    }, []);

    const handleMouseMove = useCallback((e) => {
        setDimensions((prev) => ({
            width: Math.max(
                350,
                prev.width -
                    (e.clientX -
                        resizerRef.current.getBoundingClientRect().left),
            ),
            height: Math.max(
                300,
                prev.height -
                    (e.clientY -
                        resizerRef.current.getBoundingClientRect().top),
            ),
        }));
    }, []);

    const handleMouseUp = useCallback(() => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
    }, [handleMouseMove]);

    return {
        // Panel state
        isReasoningOpen,
        setIsReasoningOpen,
        reasoning,
        setReasoning,
        loading,
        setLoading,
        status,
        tabIndex,
        setTabIndex,
        dimensions,
        resizerRef,

        // Actions
        openReasoning,
        closeReasoning,
        toggleReasoning,
        updateDimensions,
        resetReasoning,
        handleGenerateReasoning: noteId ? handleGenerateReasoning : undefined,
        handleMouseDown,
    };
};
