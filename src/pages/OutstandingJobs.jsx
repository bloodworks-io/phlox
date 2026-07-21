// Page component listing patients with outstanding jobs.
import { useEffect, useState } from "react";
import PatientTable from "../components/patient/PatientTable";
import { patientApi } from "../utils/api/patientApi";

const OutstandingJobs = ({ handleSelectPatient, refreshSidebar }) => {
  const [patients, setPatients] = useState([]);

  const fetchPatientsWithJobs = async () => {
    try {
      const data = await patientApi.fetchOutstandingJobs();
      setPatients(
        data.map((patient) => ({
          ...patient,
          activeSection: "summary",
          jobs_list: JSON.parse(patient.jobs_list || "[]"),
        })),
      );
    } catch (error) {
      console.error("Error fetching patients with jobs:", error);
    }
  };

  useEffect(() => {
    fetchPatientsWithJobs();
  }, []);

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
