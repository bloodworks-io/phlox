// API functions for patient related data operations.
import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

export const patientApi = {
  async savePatientData(saveRequest, toast, refreshSidebar) {
    try {
      const url = await buildApiUrl("/api/patient/save");
      const response = await universalFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(saveRequest),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to save patient");
      }

      const data = await response.json();

      toast({
        title: "Success",
        description: "Patient data saved successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      if (refreshSidebar) {
        await refreshSidebar();
      }

      return data;
    } catch (error) {
      console.error("Error saving patient:", error);
      throw error;
    }
  },

  searchPatient: async (urNumber, callbacks = {}) => {
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(
          `/api/patient/search?ur_number=${urNumber}`,
        );
        return universalFetch(url);
      },
      onSuccess: (data) => {
        if (data.length > 0) {
          const latestEncounter = data[0];

          // Safely iterate over callbacks
          if (callbacks && typeof callbacks === "object") {
            Object.entries(callbacks).forEach(([key, setter]) => {
              if (
                typeof setter === "function" &&
                latestEncounter[key] !== undefined
              ) {
                setter(latestEncounter[key]);
              }
            });
          }

          return latestEncounter;
        }
        return null;
      },
      successMessage: "Patient data pre-filled from the latest encounter.",
      errorMessage: "No patient data found",
    });
  },

  fetchPatientDetails: async (patientId, setters) => {
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/patient/id/${patientId}`);
        return universalFetch(url);
      },
      onSuccess: (patientData) => {
        if (setters.setPatient) {
          setters.setPatient(patientData);
        }
        if (setters.setSelectedDate && setters.isFromOutstandingJobs) {
          setters.setSelectedDate(patientData.encounter_date);
          setters.setIsFromOutstandingJobs(false);
        }
        console.log(patientData);
        return patientData;
      },
      errorMessage: "Failed to fetch patient details",
    });
  },

  updateJobsList: async (patientId, jobsList) => {
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/patient/update-jobs-list`);
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientId, jobsList }),
        });
      },
      errorMessage: "Failed to update jobs list",
    });
  },

  generateReasoning: async (patientId, toast) => {
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/patient/${patientId}/reasoning`);
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      },
      successMessage: "Clinical reasoning generated successfully.",
      errorMessage: "Error running clinical reasoning",
      toast,
    });
  },
};
