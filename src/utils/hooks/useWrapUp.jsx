import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useDisclosure } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { patientApi } from "../api/patientApi";

const REQUIRED_WRAP_UP_FIELDS = [
    { key: "name", label: "patient.field.name" },
    { key: "dob", label: "patient.field.dob" },
    { key: "ur_number", label: "patient.field.urNumber" },
    { key: "gender", label: "patient.field.gender" },
];

export const useWrapUp = ({
    patient,
    savePatientCore,
    resetTranscription,
    setIsSummaryModified,
    resetSearchFlow,
    onOpenNewNoteModal,
    refreshSidebar,
    selectedDate,
    toast,
    hasTranscriptionOccurred,
    initialTranscriptionContent,
}) => {
    const { t } = useTranslation();
    const [wrapUpLoading, setWrapUpLoading] = useState(false);
    const {
        open: isWrapUpOpen,
        onOpen: openWrapUp,
        onClose: closeWrapUp,
    } = useDisclosure();

    const handleOpenWrapUp = useCallback(() => {
        const missingFields = REQUIRED_WRAP_UP_FIELDS.filter(
            (f) => !patient?.[f.key],
        ).map((f) => t(f.label));

        if (missingFields.length > 0) {
            toaster.create({
                title: t("patient.toast.missingFields"),
                description: t("patient.toast.missingFieldsDescription", {
                    fields: missingFields.join(", "),
                }),
                type: "error",
                duration: 3000,
            });
            return;
        }
        openWrapUp();
    }, [patient, openWrapUp, t]);

    const handleWrapUpConfirm = useCallback(
        async (curatedJobs) => {
            setWrapUpLoading(true);
            try {
                const saved = await savePatientCore(
                    refreshSidebar,
                    selectedDate,
                    toast,
                    hasTranscriptionOccurred
                        ? initialTranscriptionContent
                        : null,
                );
                if (!saved) return;
                const noteId = saved.id ?? patient.id;

                try {
                    await patientApi.updateJobsList(noteId, curatedJobs);
                } catch (jobsErr) {
                    console.error("Failed to write curated jobs:", jobsErr);
                    toaster.create({
                        title: t("wrapUp.toast.jobsNotSaved"),
                        description: t("wrapUp.toast.jobsNotSavedDescription"),
                        type: "warning",
                        duration: 5000,
                    });
                    return;
                }

                setIsSummaryModified(false);
                resetTranscription();
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
            hasTranscriptionOccurred,
            initialTranscriptionContent,
            setIsSummaryModified,
            resetTranscription,
            closeWrapUp,
            resetSearchFlow,
            onOpenNewNoteModal,
            t,
        ],
    );

    return {
        isWrapUpOpen,
        wrapUpLoading,
        openWrapUp: handleOpenWrapUp,
        closeWrapUp,
        confirmWrapUp: handleWrapUpConfirm,
    };
};
