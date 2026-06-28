// Functionality for specific patient actions such as saving, searching, and letter generation.
import { patientApi } from "../api/patientApi";
import { letterApi } from "../api/letterApi";

export const handleSavePatient = async (
    patient,
    toast,
    refreshSidebar,
    navigate,
) => {
    if (
        !patient ||
        !patient.name ||
        !patient.dob ||
        !patient.ur_number ||
        !patient.gender
    ) {
        toast({
            title: "Missing Fields",
            description:
                "Name, Date of Birth, UR Number, and Gender must be filled in.",
            status: "error",
            duration: 3000,
            isClosable: true,
        });
        return;
    }

    try {
        const savedPatient = await patientApi.savePatientData(
            patient,
            toast,
            refreshSidebar,
        );
        if (savedPatient && !patient.id) {
            navigate(`/note/${savedPatient.id}`);
        }
        return savedPatient;
    } catch (error) {
        console.error("Error saving patient:", error);
        throw error;
    }
};

export const handleLoadPatientDetails = async (noteId, setters) => {
    try {
        const patientData = await patientApi.fetchPatientDetails(
            noteId,
            setters,
        );
        return patientData;
    } catch (error) {
        console.error("Error loading patient details:", error);
        throw error;
    }
};

export const handleFetchPatientLetter = async (noteId) => {
    const response = await letterApi.fetchLetter(noteId);

    return response;
};

export const resetJobsItems = async (
    noteId,
    patients,
    setPatients,
    refreshSidebar,
) => {
    try {
        // Find the patient
        const patient = patients.find((p) => p.id === noteId);
        if (!patient) {
            console.error("Patient not found");
            return;
        }

        // Reset all jobs to incomplete
        const updatedJobsList = patient.jobs_list.map((item) => ({
            ...item,
            completed: false,
        }));

        // Update the jobs list on the server
        await patientApi.updateJobsList(noteId, updatedJobsList);

        // Update the local state
        if (setPatients) {
            setPatients((prevPatients) =>
                prevPatients.map((p) =>
                    p.id === noteId
                        ? { ...p, jobs_list: updatedJobsList }
                        : p,
                ),
            );
        }

        // Refresh the UI
        if (typeof refreshSidebar === "function") {
            refreshSidebar();
        }
    } catch (error) {
        console.error("Error resetting jobs list:", error);
        throw error;
    }
};

const debounceState = new Map();

export const toggleJobsItem = async (
    noteId,
    index,
    patients,
    refreshSidebar,
) => {
    if (!refreshSidebar) {
        console.warn("refreshSidebar function not provided");
        return;
    }

    try {
        const patient = patients.find((p) => p.id === noteId);
        if (patient) {
            const updatedJobsList = [...patient.jobs_list];
            updatedJobsList[index].completed =
                !updatedJobsList[index].completed;

            await patientApi.updateJobsList(noteId, updatedJobsList);

            // Since we're not passing setPatients anymore, we'll rely on refreshSidebar
            // to update the UI
            if (typeof refreshSidebar === "function") {
                refreshSidebar();
            }
        }
    } catch (error) {
        console.error("Error toggling jobs item:", error);
        throw error;
    }
};

const executeUpdate = async (noteId, jobsList, refreshSidebar) => {
    try {
        await patientApi.updateJobsList(noteId, jobsList);
        if (typeof refreshSidebar === "function") {
            refreshSidebar();
        }
    } catch (error) {
        console.error("Error updating jobs list (debounced):", error);
    } finally {
        debounceState.delete(noteId);
    }
};

export const debouncedUpdateJobsList = (
    noteId,
    jobsList,
    refreshSidebar,
    debounceMs = 500,
) => {
    const existing = debounceState.get(noteId);
    if (existing) {
        clearTimeout(existing.timer);
    }

    const timer = setTimeout(() => {
        executeUpdate(noteId, jobsList, refreshSidebar);
    }, debounceMs);

    debounceState.set(noteId, { timer, jobsList, refreshSidebar });
};

export const flushPendingJobsUpdate = (noteId) => {
    const existing = debounceState.get(noteId);
    if (existing) {
        clearTimeout(existing.timer);
        executeUpdate(noteId, existing.jobsList, existing.refreshSidebar);
    }
};

export const handleGenerateLetter = async (
    primaryHistory,
    additionalHistory,
    investigations,
    encounterDetail,
    impression,
    encounterPlan,
    setFinalLetter,
    toast,
    patientName,
    gender,
    setLoading,
    additionalInstructions = null,
) => {
    if (!patientName?.trim() || !gender?.trim()) {
        toast({
            title: "Error",
            description:
                "Patient name and gender are required for letter generation",
            status: "error",
            duration: 5000,
            isClosable: true,
        });
        return;
    }

    const letterData = {
        summary_text: `${primaryHistory}\n\n${additionalHistory}\n\n${investigations}\n\n${encounterDetail}\n\n${impression}\n\n${encounterPlan}`,
        patientName,
        gender,
        primaryHistory,
        additional_instruction: additionalInstructions,
    };

    try {
        const response = await letterApi.generateLetter(letterData);
        setFinalLetter(response.letter);
        toast({
            title: "Success",
            description: "Letter generated successfully.",
            status: "success",
            duration: 3000,
            isClosable: true,
        });
        return response;
    } catch (error) {
        console.error("Error generating letter:", error);
        toast({
            title: "Error",
            description: "Error generating letter",
            status: "error",
            duration: 3000,
            isClosable: true,
        });
        throw error;
    } finally {
        if (setLoading) setLoading(false);
    }
};
