// API functions for patient related data operations.
import { toaster } from "@/components/ui/toaster";
import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

export const patientApi = {
  async savePatientData(saveRequest, toast, refreshSidebar) {
    try {
      const url = await buildApiUrl("/api/note/save");
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

      toaster.create({
        title: "Success",
        description: "Patient data saved successfully",
        type: "success",
        duration: 3000,
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

  fetchPatientDetails: async (noteId, setters) => {
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/note/id/${noteId}`);
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

  updateJobsList: async (noteId, jobsList) => {
    return handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/note/update-jobs-list`);
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noteId, jobsList }),
        });
      },
      errorMessage: "Failed to update jobs list",
    });
  },

  extractJobs: async (planText) => {
    const url = await buildApiUrl(`/api/note/extract-jobs`);
    const response = await universalFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planText }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to extract jobs");
    }
    return response.json();
  },

  /**
   * Generate chart insights with streaming status updates
   * @param {number} noteId - The patient ID
   * @param {function} onStatus - Callback for status updates (receives status string)
   * @param {object} toast - Chakra UI toast for notifications
   * @returns {Promise<object>} - The reasoning result
   */
  generateReasoningStream: async (noteId, onStatus, toast) => {
    const url = await buildApiUrl(`/api/note/${noteId}/reasoning/stream`);
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
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }

    if (toast) {
      toaster.create({
        title: "Success",
        description: "Chart insights generated successfully.",
        type: "success",
        duration: 3000,
      });
    }

    return result;
  },

  fetchPatientHistoryByTemplate: async (urNumber, templateKey) => {
    const url = await buildApiUrl(
      `/api/note/history?ur_number=${urNumber}&template_key=${templateKey}`,
    );
    const response = await universalFetch(url);
    if (!response.ok) throw new Error("Failed to fetch patient history");
    return response.json();
  },

  fetchScribeConsent: async (urNumber) => {
    const url = await buildApiUrl(
      `/api/note/consent?ur_number=${encodeURIComponent(urNumber)}`,
    );
    const response = await universalFetch(url);
    if (!response.ok) throw new Error("Failed to fetch scribe consent");
    return response.json();
  },

  saveScribeConsent: async (urNumber, consented) => {
    const url = await buildApiUrl(`/api/note/consent`);
    const response = await universalFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ur_number: urNumber, consented }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to save scribe consent");
    }
    return response.json();
  },
};
