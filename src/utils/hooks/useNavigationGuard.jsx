import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import { useDisclosure } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { toaster } from "@/components/ui/toaster";

// Guards navigation when there are unsaved changes (isModified).
export const useNavigationGuard = (isModified, setIsModified) => {
    const { open, onOpen, onClose } = useDisclosure();
    const [pendingAction, setPendingAction] = useState(null);
    const navigate = useNavigate();
    const { t } = useTranslation();


    const guardedAction = useCallback(
        (action) => {
            toaster.remove();
            if (isModified) {
                setPendingAction(() => action);
                onOpen();
            } else {
                setIsModified(false);
                action();
            }
        },
        [isModified, onOpen, setIsModified],
    );

    const guardedNavigate = useCallback(
        (path, state) =>
            guardedAction(() => navigate(path, state ? { state } : undefined)),
        [guardedAction, navigate],
    );

    const confirmNavigation = useCallback(() => {
        onClose();
        if (pendingAction) {
            setIsModified(false);
            pendingAction();
            setPendingAction(null);
        }
    }, [pendingAction, onClose, setIsModified]);

    const cancelNavigation = useCallback(() => {
        onClose();
        setPendingAction(null);
    }, [onClose]);

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isModified) {
                e.preventDefault();
                e.returnValue = t("navigation.unsavedChanges");
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () =>
            window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isModified, t]);

    return {
        guardedAction,
        guardedNavigate,
        confirmNavigation,
        cancelNavigation,
        isLeaveOpen: open,
    };
};
