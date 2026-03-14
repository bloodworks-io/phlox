import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import { patientApi } from "../api/patientApi";


export const useReasoning = (options = {}) => {
    const { patientId, initialReasoning, onReasoningGenerated } = options;

    const [isReasoningOpen, setIsReasoningOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [reasoning, setReasoning] = useState(initialReasoning ?? null);
    const [status, setStatus] = useState(null);
    const [tabIndex, setTabIndex] = useState(0);
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
    }, [patientId, initialReasoning]);

    // Only provide API handler if patientId is available
    const handleGenerateReasoning = useCallback(async () => {
        if (!patientId) return;

        setLoading(true);
        setStatus("Initializing reasoning engine...");
        try {
            const res = await patientApi.generateReasoningStream(
                patientId,
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
    }, [patientId, toast, onReasoningGenerated]);

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
        handleGenerateReasoning: patientId ? handleGenerateReasoning : undefined,
        handleMouseDown,
    };
};
