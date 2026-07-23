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

export const buildEncounterFromCandidate = async (candidate, selectedDate) => {
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
    };

    // Fetch the previous visit summary
    try {
        const summaryData = await patientApi.fetchPatientSummary(candidate.id);
        newPatient.previous_visit_summary = summaryData.summary;
    } catch (error) {
        console.error("Error fetching previous visit summary:", error);
    }

    return newPatient;
};
