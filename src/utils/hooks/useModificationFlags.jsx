import { useState, useEffect, useCallback } from "react";

export const useModificationFlags = (initialPatientId, setParentIsModified) => {
    const [isLetterModified, setIsLetterModified] = useState(false);
    const [isSummaryModified, setIsSummaryModified] = useState(false);

    useEffect(() => {
        setParentIsModified(isLetterModified || isSummaryModified);
    }, [isLetterModified, isSummaryModified, setParentIsModified]);

    useEffect(() => {
        setIsLetterModified(false);
        setIsSummaryModified(false);
        setParentIsModified(false);
    }, [initialPatientId, setParentIsModified]);

    const reset = useCallback(() => {
        setIsSummaryModified(false);
    }, []);

    return {
        isLetterModified,
        setIsLetterModified,
        isSummaryModified,
        setIsSummaryModified,
        resetSummary: reset,
    };
};
