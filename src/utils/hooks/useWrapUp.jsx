import { useState, useCallback } from "react";
import { useDisclosure } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { patientApi } from "../api/patientApi";

const REQUIRED_WRAP_UP_FIELDS = [
    { key: "name", label: "Name" },
    { key: "dob", label: "Date of Birth" },
    { key: "ur_number", label: "UR Number" },
    { key: "gender", label: "Gender" },
];

export const useWrapUp = ({
    patient,
    savePatientCore,
    setIsSummaryModified,
    resetSearchFlow,
    onOpenNewNoteModal,
    refreshSidebar,
    selectedDate,
    toast,
}) => {
    const [wrapUpLoading, setWrapUpLoading] = useState(false);
    const {
        open: isWrapUpOpen,
        onOpen: openWrapUp,
        onClose: closeWrapUp,
    } = useDisclosure();

    const handleOpenWrapUp = useCallback(() => {
        const missingFields = REQUIRED_WRAP_UP_FIELDS.filter(
            (f) => !patient?.[f.key],
        ).map((f) => f.label);

        if (missingFields.length > 0) {
            toaster.create({
                title: "Missing Required Fields",
                description: `Please fill in the following required fields: ${missingFields.join(", ")}`,
                type: "error",
                duration: 3000,
            });
            return;
        }
        openWrapUp();
    }, [patient, openWrapUp]);

    const handleWrapUpConfirm = useCallback(
        async (curatedJobs) => {
            setWrapUpLoading(true);
            try {
                const saved = await savePatientCore(
                    refreshSidebar,
                    selectedDate,
                    toast,
                );
                if (!saved) return;
                const noteId = saved.id ?? patient.id;

                try {
                    await patientApi.updateJobsList(noteId, curatedJobs);
                } catch (jobsErr) {
                    console.error("Failed to write curated jobs:", jobsErr);
                    toaster.create({
                        title: "Jobs not saved",
                        description:
                            "The note was saved, but the curated jobs couldn't be written. Please try again.",
                        type: "warning",
                        duration: 5000,
                    });
                    return;
                }

                setIsSummaryModified(false);
                closeWrapUp();
                resetSearchFlow();
                onOpenNewNoteModal();
            } catch (error) {
                console.error("Error during wrap up:", error);
                // savePatientCore surfaces its own toast on save failure; keep modal open.
            } finally {
                setWrapUpLoading(false);
            }
        },
        [
            patient,
            savePatientCore,
            refreshSidebar,
            selectedDate,
            toast,
            setIsSummaryModified,
            resetSearchFlow,
            onOpenNewNoteModal,
            closeWrapUp,
        ],
    );

    return {
        isWrapUpOpen,
        openWrapUp: handleOpenWrapUp,
        closeWrapUp,
        wrapUpLoading,
        confirmWrapUp: handleWrapUpConfirm,
    };
};
