import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import { patientApi } from "../../../../utils/api/patientApi";

export const useReasoningPanel = ({
    patientId,
    initialReasoning,
    onReasoningGenerated,
}) => {
    const [loading, setLoading] = useState(false);
    const [reasoning, setReasoning] = useState(initialReasoning);
    const [status, setStatus] = useState(null); // Current status message
    const [tabIndex, setTabIndex] = useState(0);
    const [dimensions, setDimensions] = useState({
        width: 500,
        height: 420,
    });
    const resizerRef = useRef(null);
    const toast = useToast();

    // Update reasoning when initialReasoning changes
    useEffect(() => {
        setReasoning(initialReasoning);
    }, [patientId, initialReasoning]);

    const handleGenerateReasoning = useCallback(async () => {
        setLoading(true);
        setStatus("Initializing reasoning engine...");
        try {
            // Use streaming API for real-time status updates
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

    // Resize functionality
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
        // State
        loading,
        reasoning,
        status,
        tabIndex,
        setTabIndex,
        dimensions,
        resizerRef,
        // Handlers
        handleGenerateReasoning,
        handleMouseDown,
    };
};
