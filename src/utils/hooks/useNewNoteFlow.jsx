import { useState, useCallback } from "react";
import { useDisclosure } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";

export const useNewNoteFlow = ({ guardedNavigate }) => {
    const [newNoteKey, setNewNoteKey] = useState(0);
    const {
        open: isNewNoteOpen,
        onOpen: onOpenNewNote,
        onClose: onCloseNewNote,
    } = useDisclosure();
    const [resetLetter, setResetLetter] = useState(null);

    const openNewNoteModal = useCallback(() => {
        toaster.remove();
        onOpenNewNote();
    }, [onOpenNewNote]);

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
        completeNewNote,
        resetLetter,
        setResetLetter,
    };
};
