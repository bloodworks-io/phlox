// Page component that renders a summary of patients for a selected date.
import useSWR from "swr";
import PatientTable from "../components/patient/PatientTable";
import { patientApi } from "../utils/api/patientApi";
import { KEYS } from "../utils/cache/keys";

const clinicSummaryFetcher = (date, detailed) => async () => {
    const data = await patientApi.fetchNoteList({ date, detailed });
    return data.map((patient) => ({
        ...patient,
        activeSection: "summary",
        jobs_list: JSON.parse(patient.jobs_list || "[]"),
    }));
};

const ClinicSummary = ({
    selectedDate,
    handleSelectPatient,
    refreshSidebar,
}) => {
    const { data, mutate } = useSWR(
        KEYS.noteList(selectedDate, true),
        clinicSummaryFetcher(selectedDate, true),
        { revalidateOnMount: true },
    );
    const patients = data || [];

    // SWR-backed setter so PatientTable can do local row edits without
    // triggering a revalidation round-trip.
    const setPatients = (updater) => mutate(updater, { revalidate: false });

    return (
        <PatientTable
            patients={patients}
            setPatients={setPatients}
            handleSelectPatient={handleSelectPatient}
            refreshSidebar={refreshSidebar}
            title={`Clinic Summary for ${selectedDate}`}
        />
    );
};

export default ClinicSummary;
