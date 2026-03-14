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

  /**
   * Generate clinical reasoning with streaming status updates
   * @param {number} patientId - The patient ID
   * @param {function} onStatus - Callback for status updates (receives status string)
   * @param {object} toast - Chakra UI toast for notifications
   * @returns {Promise<object>} - The reasoning result
   */
  generateReasoningStream: async (patientId, onStatus, toast) => {
    const url = await buildApiUrl(`/api/patient/${patientId}/reasoning/stream`);
    const response = await universalFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to generate reasoning");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "status" && onStatus) {
              onStatus(data.message);
            } else if (data.type === "result") {
              result = data.data;
            }
          } catch (e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }

    if (toast) {
      toast({
        title: "Success",
        description: "Clinical reasoning generated successfully.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    }

    return result;
  },

  fetchPatientHistoryByTemplate: async (urNumber, templateKey) => {
    const url = await buildApiUrl(
      `/api/patient/history?ur_number=${urNumber}&template_key=${templateKey}`,
    );
    const response = await universalFetch(url);
    if (!response.ok) throw new Error("Failed to fetch patient history");
    return response.json();
  },
};
