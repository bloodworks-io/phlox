import { useEffect, useCallback } from "react";
import { useLetter } from "./useLetter";
import type { LetterPatient, SetIsModified } from "./useLetter";

interface UseLetterOrchestrationArgs {
    patient: LetterPatient | null;
    setIsModified: SetIsModified;
    onResetLetter?: (resetLetter: () => void) => void;
    openLetter: () => void;
}

export const useLetterOrchestration = ({
    patient,
    setIsModified,
    onResetLetter,
    openLetter,
}: UseLetterOrchestrationArgs) => {
    const letterHook = useLetter(setIsModified);
    const { loadLetter, generateLetter, saveLetter, setFinalCorrespondence, resetLetter } = letterHook;

    // Load letter when patient changes
    useEffect(() => {
        if (patient?.id) {
            loadLetter(patient.id);
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
        async (additionalInstructions?: string | null) => {
            if (!patient) return;
            openLetter();
            await generateLetter(patient, additionalInstructions);
        },
        [patient, openLetter, generateLetter],
    );

    const handleLetterSave = async () => {
        if (!patient?.id) return;
        await saveLetter(patient.id);
        setIsModified(false);
    };

    // Wrap setFinalCorrespondence to also flip the modified flag
    const setFinalCorrespondenceWithFlag = useCallback(
        (value: string) => {
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
