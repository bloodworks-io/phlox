// Page component that renders a summary of patients for a selected date.
import { useEffect, useState } from "react";
import PatientTable from "../components/patient/PatientTable";
import { settingsService } from "../utils/settings/settingsUtils";
import { buildApiUrl } from "../utils/helpers/apiConfig";
import { universalFetch } from "../utils/helpers/apiHelpers";

const ClinicSummary = ({
  selectedDate,
  handleSelectPatient,
  refreshSidebar,
}) => {
  const [patients, setPatients] = useState([]);
  const [reasoningEnabled, setReasoningEnabled] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      const config = await settingsService.fetchConfig();
      setReasoningEnabled(config.REASONING_ENABLED);
    };
    fetchConfig();
  }, []);

  const fetchPatients = async (date, detailed = true) => {
    try {
      const url = await buildApiUrl(
        `/api/patient/list?date=${date}&detailed=${detailed}`,
      );
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
      console.error("Error fetching patients:", error);
    }
  };

  useEffect(() => {
    fetchPatients(selectedDate);
  }, [selectedDate]);

  return (
    <PatientTable
      patients={patients}
      setPatients={setPatients}
      handleSelectPatient={handleSelectPatient}
      refreshSidebar={refreshSidebar}
      title={`Clinic Summary for ${selectedDate}`}
      reasoningEnabled={reasoningEnabled}
    />
  );
};

export default ClinicSummary;
