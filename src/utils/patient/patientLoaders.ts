import { universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

export const findPatients = async (query) => {
    const q = (query || "").trim();
    if (!q) return [];
    const response = await universalFetch(
        await buildApiUrl(`/api/note/search?q=${encodeURIComponent(q)}`),
    );
    if (!response.ok) throw new Error("Search failed");
    const data = await response.json();
    return Array.isArray(data) ? data : [];
};

export const buildEncounterFromCandidate = async (candidate, selectedDate) => {
    let fullTemplateData = candidate.template_data || {};
    try {
        const fullPatientResponse = await universalFetch(
            await buildApiUrl(`/api/note/id/${candidate.id}`),
        );
        if (fullPatientResponse.ok) {
            const fullPatient = await fullPatientResponse.json();
            fullTemplateData = fullPatient.template_data || {};
        }
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
        const summaryResponse = await universalFetch(
            await buildApiUrl(`/api/note/summary/${candidate.id}`),
        );
        if (summaryResponse.ok) {
            const summaryData = await summaryResponse.json();
            newPatient.previous_visit_summary = summaryData.summary;
        }
    } catch (error) {
        console.error("Error fetching previous visit summary:", error);
    }

    return newPatient;
};
