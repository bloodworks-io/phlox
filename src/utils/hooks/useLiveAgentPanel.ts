import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useLiveAgent } from "./useLiveAgent";
import type { NoteTemplate, Patient } from "../patient/types";

interface UseLiveAgentPanelArgs {
    patient: Patient | null;
    setPatient: Dispatch<SetStateAction<Patient | null>>;
    currentTemplate: NoteTemplate | null;
    onRequestWrapUp: () => void;
    onLetterSaved: () => void;
    onNoteContentChanged: () => void;
    letterContent: string;
    setLetterContent: (content: string) => void;
    letterOpen: boolean;
    openPanel: (panel: string) => void;
}

export const useLiveAgentPanel = ({
    patient,
    setPatient,
    currentTemplate,
    onRequestWrapUp,
    onLetterSaved,
    onNoteContentChanged,
    letterContent,
    setLetterContent,
    letterOpen,
    openPanel,
}: UseLiveAgentPanelArgs) => {
    const liveAgent = useLiveAgent({
        patient,
        setPatient,
        currentTemplate,
        onRequestWrapUp,
        onLetterSaved,
        onNoteContentChanged,
    });

    const liveLetter = liveAgent.artifacts.find(
        (artifact) => artifact.type === "letter",
    );
    const lastSyncedLetterRef = useRef<string | null>(null);
    useEffect(() => {
        if (!liveLetter || !letterOpen) return;
        if (liveLetter.content === lastSyncedLetterRef.current) return;
        if (letterContent !== lastSyncedLetterRef.current) return;
        lastSyncedLetterRef.current = liveLetter.content;
        setLetterContent(liveLetter.content);
    }, [liveLetter, letterOpen, letterContent, setLetterContent]);

    const onOpenLetter = (artifact: { content: string }) => {
        lastSyncedLetterRef.current = artifact.content;
        setLetterContent(artifact.content);
        openPanel("letter");
    };

    return {
        ...liveAgent,
        liveLetter,
        onOpenLetter,
    };
};
