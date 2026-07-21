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

/**
 * Owns the wrap-up sub-flow:
 *  - modal visibility + submitting flag
 *  - open-with-required-fields-validation handler
 *  - confirm handler (save + write jobs + reset sibling hooks + navigate)
 *
 * Coupling is intentionally wide: confirm genuinely orchestrates 6 things
 * (save via savePatientCore, jobs write, summary/transcription/search-flow
 * resets, onStartNewNote callback, navigate). Extracting it makes the
 * dependencies explicit at the call site rather than scattered inline.
 */
export const useWrapUp = ({
    patient,
    savePatientCore,
    resetTranscription,
    setIsSummaryModified,
    resetSearchFlow,
    onStartNewNote,
    refreshSidebar,
    selectedDate,
    navigate,
    toast,
    hasTranscriptionOccurred,
    initialTranscriptionContent,
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
                        title: "Jobs not saved",
                        description:
                            "The note was saved, but the curated jobs couldn't be written. Please try again.",
                        type: "warning",
                        duration: 5000,
                    });
                    return;
                }

                setIsSummaryModified(false);
                resetTranscription();
                closeWrapUp();
                resetSearchFlow();
                await onStartNewNote();
                navigate("/new-note");
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
            onStartNewNote,
            navigate,
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
