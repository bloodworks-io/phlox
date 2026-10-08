import { useState } from "react";
import { useDisclosure } from "@chakra-ui/react";
import type { Patient } from "../patient/types";

interface UsePatientSwitchingArgs {
    searchFlow: {
        handleConfirmCandidate: (
            candidate: Patient,
            selectedDate: string,
            loadCandidate: (
                candidate: Patient,
                selectedDate: string,
            ) => Promise<Patient>,
        ) => Promise<unknown>;
    };
    loadCandidate: (
        candidate: Patient,
        selectedDate: string,
    ) => Promise<Patient>;
    selectedDate: string;
    isSummaryModified: boolean;
    isLetterModified: boolean;
    setIsSummaryModified: (value: boolean) => void;
}

export const usePatientSwitching = ({
    searchFlow,
    loadCandidate,
    selectedDate,
    isSummaryModified,
    isLetterModified,
    setIsSummaryModified,
}: UsePatientSwitchingArgs) => {
    const [pendingCandidate, setPendingCandidate] = useState<Patient | null>(
        null,
    );
    const leaveModal = useDisclosure();

    const confirmCandidateSwitch = (candidate: Patient) =>
        searchFlow.handleConfirmCandidate(candidate, selectedDate, loadCandidate);

    const handleConfirmCandidate = (candidate: Patient) => {
        if (isSummaryModified || isLetterModified) {
            setPendingCandidate(candidate);
            leaveModal.onOpen();
            return;
        }
        confirmCandidateSwitch(candidate);
    };

    const cancelCandidateSwitch = () => {
        setPendingCandidate(null);
        leaveModal.onClose();
    };

    const confirmCandidateNavigation = () => {
        const candidate = pendingCandidate;
        cancelCandidateSwitch();
        if (!candidate) return;
        setIsSummaryModified(false);
        confirmCandidateSwitch(candidate);
    };

    return {
        leaveModal,
        handleConfirmCandidate,
        cancelCandidateSwitch,
        confirmCandidateNavigation,
    };
};
