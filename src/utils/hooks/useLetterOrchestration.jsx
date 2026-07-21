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

    // Load letter when patient changes
    useEffect(() => {
        if (patient?.id) {
            letterHook.loadLetter(patient.id, toast);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patient?.id]);

    // Pipe resetLetter up to App via onResetLetter prop
    useEffect(() => {
        if (onResetLetter) {
            onResetLetter(letterHook.resetLetter);
        }
    }, [onResetLetter, letterHook.resetLetter]);

    const handleGenerateLetterClick = useCallback(
        async (additionalInstructions) => {
            if (!patient) return;
            openLetter();
            await letterHook.generateLetter(
                patient,
                additionalInstructions,
                toast,
                letterHook.setFinalCorrespondence,
            );
        },
        [patient, openLetter, toast, letterHook],
    );

    const handleLetterSave = useCallback(async () => {
        await letterHook.saveLetter(patient.id);
        setIsModified(false);
    }, [patient?.id, setIsModified, letterHook]);

    // Wrap setFinalCorrespondence to also flip the modified flag
    const setFinalCorrespondenceWithFlag = useCallback(
        (value) => {
            letterHook.setFinalCorrespondence(value);
            setIsModified(true);
        },
        [setIsModified, letterHook],
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
