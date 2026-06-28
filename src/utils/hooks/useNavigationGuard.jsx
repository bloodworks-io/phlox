import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Steps, useDisclosure } from "@chakra-ui/react";
import { useToast } from "@/utils/useToastShim";

// Guards navigation when there are unsaved changes (isModified).
export const useNavigationGuard = (isModified, setIsModified) => {
    const { open, onOpen, onClose } = useDisclosure();
    const [pendingNavigation, setPendingNavigation] = useState(null);
    const navigate = useNavigate();
    const toast = useToast();

    const guardedNavigate = useCallback(
        (path, state) => {
            toast.closeAll();
            if (isModified) {
                setPendingNavigation({ path, state });
                onOpen();
            } else {
                setIsModified(false);
                navigate(path, state ? { state } : undefined);
            }
        },
        [isModified, navigate, toast, onOpen, setIsModified],
    );

    const confirmNavigation = useCallback(() => {
        onClose();
        if (pendingNavigation) {
            const { path, state } = pendingNavigation;
            setIsModified(false);
            navigate(path, state ? { state } : undefined);
            setPendingNavigation(null);
        }
    }, [pendingNavigation, navigate, onClose, setIsModified]);

    const cancelNavigation = useCallback(() => {
        onClose();
        setPendingNavigation(null);
    }, [onClose]);

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isModified) {
                e.preventDefault();
                e.returnValue =
                    "You have unsaved changes. Are you sure you want to leave?";
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () =>
            window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isModified]);

    return {
        guardedNavigate,
        confirmNavigation,
        cancelNavigation,
        isLeaveOpen: open,
    };
};
