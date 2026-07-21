// Page component listing patients with outstanding jobs.
import useSWR from "swr";
import PatientTable from "../components/patient/PatientTable";
import { patientApi } from "../utils/api/patientApi";
import { KEYS } from "../utils/cache/keys";

const outstandingJobsFetcher = async () => {
    const data = await patientApi.fetchOutstandingJobs();
    return data.map((patient) => ({
        ...patient,
        activeSection: "summary",
        jobs_list: JSON.parse(patient.jobs_list || "[]"),
    }));
};

const OutstandingJobs = ({ handleSelectPatient, refreshSidebar }) => {
    const { data, mutate } = useSWR(KEYS.OUTSTANDING_JOBS, outstandingJobsFetcher);
    const patients = data || [];
    const setPatients = (updater) => mutate(updater, { revalidate: false });

    return (
        <PatientTable
            patients={patients}
            setPatients={setPatients}
            handleSelectPatient={handleSelectPatient}
            refreshSidebar={refreshSidebar}
            title="Outstanding Jobs"
            groupByDate={true}
            summaryOnly={true}
        />
    );
};

export default OutstandingJobs;
