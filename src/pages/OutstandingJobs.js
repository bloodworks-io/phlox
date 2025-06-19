// Page component listing patients with outstanding jobs.
import { useEffect, useState } from "react";
import PatientTable from "../components/patient/PatientTable";
import { settingsService } from "../utils/settings/settingsUtils";
import { buildApiUrl } from "../utils/helpers/apiConfig";
import { universalFetch } from "../utils/helpers/apiHelpers";

const OutstandingJobs = ({ handleSelectPatient, refreshSidebar }) => {
  const [patients, setPatients] = useState([]);
  const [reasoningEnabled, setReasoningEnabled] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      const config = await settingsService.fetchConfig();
      setReasoningEnabled(config.REASONING_ENABLED);
    };
    fetchConfig();
  }, []);

  const fetchPatientsWithJobs = async () => {
    try {
      const url = await buildApiUrl(`/api/patient/outstanding-jobs`);
      const response = await universalFetch(url);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
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
      reasoningEnabled={reasoningEnabled}
    />
  );
};

export default OutstandingJobs;
