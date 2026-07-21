import { useState, useEffect, useCallback } from "react";
import { findPatients } from "../patient/patientLoaders";

export const useSearchFlow = ({
    isNewPatient,
    viaModal,
    cameFromSearch,
    pathname,
    summarySetIsCollapsed,
}) => {
    const [isSearchLoading, setIsSearchLoading] = useState(false);
    const [isSearchedPatient, setIsSearchedPatient] = useState(
        Boolean(cameFromSearch),
    );
    const [searchResult, setSearchResult] = useState(null);
    const [startCardDismissed, setStartCardDismissed] = useState(
        Boolean(viaModal),
    );

    const showStartCard =
        isNewPatient && !isSearchedPatient && !startCardDismissed;

    // Mount-only: expand summary when arriving from search
    useEffect(() => {
        if (cameFromSearch) summarySetIsCollapsed?.(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reset on route change (unless we got here via the modal shortcut)
    useEffect(() => {
        if (viaModal) return;
        if (!isNewPatient) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate route-change reset; remounting PatientDetails would lose chat/document state
            setIsSearchedPatient(false);
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate route-change reset; see above
        setStartCardDismissed(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    const handleSearch = useCallback(async (query) => {
        setIsSearchLoading(true);
        try {
            return await findPatients(query);
        } finally {
            setIsSearchLoading(false);
        }
    }, []);

    const handleConfirmCandidate = useCallback(
        async (candidate, selectedDate, loadCandidate) => {
            const loaded = await loadCandidate(candidate, selectedDate);
            setSearchResult(loaded);
            setIsSearchedPatient(true);
            summarySetIsCollapsed?.(false);
        },
        [summarySetIsCollapsed],
    );

    const dismissStartCard = useCallback(() => {
        setStartCardDismissed(true);
    }, []);

    const clearSearchResult = useCallback(() => setSearchResult(null), []);

    const reset = useCallback(() => {
        setIsSearchedPatient(false);
        setStartCardDismissed(false);
    }, []);

    return {
        isSearchLoading,
        isSearchedPatient,
        searchResult,
        startCardDismissed,
        showStartCard,
        handleSearch,
        handleConfirmCandidate,
        dismissStartCard,
        clearSearchResult,
        reset,
    };
};
