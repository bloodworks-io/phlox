// Helper functions for handling processing of documents and transcriptions.
import { universalFetch } from "./apiHelpers";

export const handleProcessingComplete = (
  data,
  {
    setLoading,
    setters = {},
    setIsSourceCollapsed,
    setIsSummaryCollapsed,
    triggerResize = false,
    summaryRef = null,
  },
) => {
  setLoading(false);

  // Special handling for template_data since it's nested in fields
  if (setters.template_data && data.fields) {
    setters.template_data(data.fields);
  }

  // Handle other setters
  Object.entries(setters).forEach(([key, setter]) => {
    if (key !== "template_data" && data[key] !== undefined && setter) {
      setter(data[key]);
    }
  });

  // Handle UI collapse states
  if (setIsSourceCollapsed) {
    setIsSourceCollapsed(true);
  }
  if (setIsSummaryCollapsed) {
    setIsSummaryCollapsed(false);
  }

  // Only try to resize if we have a valid ref and it has the method
  if (triggerResize && summaryRef?.current?.resizeTextarea) {
    setTimeout(() => {
      summaryRef.current.resizeTextarea();
    }, 0);
  }
};

export const processDocument = async (
  file,
  patientDetails,
  onSuccess,
  onError,
) => {
  const formData = new FormData();
  formData.append("file", file);

  // Add patient details to formData if they exist
  Object.entries(patientDetails).forEach(([key, value]) => {
    if (value) formData.append(key, value);
  });

  try {
    const response = await universalFetch("/api/transcribe/process-document", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Document processing failed");
    }

    const data = await response.json();
    onSuccess(data);
    return data;
  } catch (error) {
    console.error("Error processing document:", error);
    onError(error);
    throw error;
  }
};
