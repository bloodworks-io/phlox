import { useState, useCallback } from "react";

/**
 * Hook to manage the reasoning panel state and data.
 * Similar pattern to useChat and useLetter.
 */
export const useReasoning = () => {
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);
  const [reasoning, setReasoning] = useState(null);
  const [loading, setLoading] = useState(false);

  // Panel dimensions for resizing
  const [dimensions, setDimensions] = useState({
    width: 450,
    height: 400,
  });

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

  // Reset reasoning when patient changes
  const resetReasoning = useCallback(() => {
    setReasoning(null);
    setLoading(false);
  }, []);

  return {
    isReasoningOpen,
    setIsReasoningOpen,
    reasoning,
    setReasoning,
    loading,
    setLoading,
    openReasoning,
    closeReasoning,
    toggleReasoning,
    dimensions,
    updateDimensions,
    resetReasoning,
  };
};
