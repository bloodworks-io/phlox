import { useEffect, useCallback } from "react";
import { useLetter } from "./useLetter";

export const useLetterOrchestration = ({
    patient,
    setIsModified,
    onResetLetter,
    openLetter,
    toast,
}) => {
    const letterHook = useLetter(setIsModified);
    const { loadLetter, generateLetter, saveLetter, setFinalCorrespondence, resetLetter } = letterHook;

    // Load letter when patient changes
    useEffect(() => {
        if (patient?.id) {
            loadLetter(patient.id, toast);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patient?.id]);

    // Pipe resetLetter up to App via onResetLetter prop
    useEffect(() => {
        if (onResetLetter) {
            onResetLetter(resetLetter);
        }
    }, [onResetLetter, resetLetter]);

    const handleGenerateLetterClick = useCallback(
        async (additionalInstructions) => {
            if (!patient) return;
            openLetter();
            await generateLetter(
                patient,
                additionalInstructions,
                toast,
                setFinalCorrespondence,
            );
        },
        [patient, openLetter, toast, generateLetter, setFinalCorrespondence],
    );

    const handleLetterSave = useCallback(async () => {
        await saveLetter(patient.id);
        setIsModified(false);
    }, [patient?.id, setIsModified, saveLetter]);

    // Wrap setFinalCorrespondence to also flip the modified flag
    const setFinalCorrespondenceWithFlag = useCallback(
        (value) => {
            setFinalCorrespondence(value);
            setIsModified(true);
        },
        [setIsModified, setFinalCorrespondence],
    );

    return {
        finalCorrespondence: letterHook.finalCorrespondence,
        loading: letterHook.loading,
        setFinalCorrespondence: setFinalCorrespondenceWithFlag,
        handleGenerateLetterClick,
        handleLetterSave,
        // Direct pass-through — letterHook.refineLetter is stable from useLetter
        handleRefineLetter: letterHook.refineLetter,
        // setIsModified is consumed by LetterPanel's onLetterChange — pass through
        setIsModified,
    };
};
