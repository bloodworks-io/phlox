import { useState, useCallback } from "react";
import { useDisclosure, useToast } from "@chakra-ui/react";

export const useNewNoteFlow = ({ createNewPatient, guardedNavigate }) => {
    const [newNoteKey, setNewNoteKey] = useState(0);
    const {
        isOpen: isNewNoteOpen,
        onOpen: onOpenNewNote,
        onClose: onCloseNewNote,
    } = useDisclosure();
    const [resetLetter, setResetLetter] = useState(null);
    const toast = useToast();

    const startNewNote = useCallback(async () => {
        await createNewPatient();
        setNewNoteKey((k) => k + 1);
        if (resetLetter) {
            resetLetter();
        }
    }, [createNewPatient, resetLetter]);

    const openNewNoteModal = useCallback(() => {
        toast.closeAll();
        onOpenNewNote();
    }, [toast, onOpenNewNote]);

    const completeNewNote = useCallback(
        ({ cameFromSearch } = {}) => {
            setNewNoteKey((k) => k + 1);
            if (resetLetter) {
                resetLetter();
            }
            onCloseNewNote();
            guardedNavigate("/new-note", {
                viaModal: true,
                cameFromSearch: Boolean(cameFromSearch),
            });
        },
        [resetLetter, onCloseNewNote, guardedNavigate],
    );

    return {
        newNoteKey,
        isNewNoteOpen,
        openNewNoteModal,
        closeNewNoteModal: onCloseNewNote,
        startNewNote,
        completeNewNote,
        resetLetter,
        setResetLetter,
    };
};
