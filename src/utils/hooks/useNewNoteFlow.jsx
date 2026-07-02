import { useState, useCallback } from "react";
import { useDisclosure } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
const toast = toaster.create;

export const useNewNoteFlow = ({ createNewPatient, guardedNavigate }) => {
    const [newNoteKey, setNewNoteKey] = useState(0);
    const {
        open: isNewNoteOpen,
        onOpen: onOpenNewNote,
        onClose: onCloseNewNote,
    } = useDisclosure();
    const [resetLetter, setResetLetter] = useState(null);

    const startNewNote = useCallback(async () => {
        await createNewPatient();
        setNewNoteKey((k) => k + 1);
        if (resetLetter) {
            resetLetter();
        }
    }, [createNewPatient, resetLetter]);

    const openNewNoteModal = useCallback(() => {
        toaster.remove();
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
