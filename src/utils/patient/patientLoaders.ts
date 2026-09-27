import { patientApi } from "../api/patientApi";

export const findPatients = async (query) => {
    const q = (query || "").trim();
    if (!q) return [];
    try {
        const data = await patientApi.searchPatients(q);
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Patient search failed:", error);
        return [];
    }
};

export const buildEncounterFromCandidate = async (
    candidate,
    selectedDate,
    onSummary,
) => {
    let fullTemplateData = candidate.template_data || {};
    try {
        const fullPatient = await patientApi.fetchPatientDetails(candidate.id);
        fullTemplateData = fullPatient.template_data || {};
    } catch (error) {
        console.error("Error fetching full patient data:", error);
    }

    // Create a new patient object with the passed selectedDate
    const newPatient = {
        ...candidate,
        id: null,
        encounter_date: selectedDate, // Use the passed selectedDate
        template_data: {
            ...candidate.template_data, // Use persistent data for pre-fill
        },
        isNewEncounter: true,
        // Preserve full previous visit data for the panel
        previous_visit_template_data: fullTemplateData,
        previous_visit_template_key: candidate.template_key,
        previous_visit_encounter_date: candidate.encounter_date,
        previous_visit_summary_pending: true,
    };


    patientApi
        .fetchPatientSummary(candidate.id)
        .then((summaryData) => onSummary?.(summaryData.summary))
        .catch((error) => {
            console.error("Error fetching previous visit summary:", error);
            onSummary?.(null);
        });

    return newPatient;
};
