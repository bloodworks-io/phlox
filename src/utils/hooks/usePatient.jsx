import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@chakra-ui/react";
import { patientApi } from "../api/patientApi";
import { letterApi } from "../api/letterApi";
import { handleError } from "../helpers/errorHandlers";
import { universalFetch } from "../helpers/apiHelpers";

import {
  useTemplateSelection,
  useTemplate,
} from "../templates/templateContext";

const filterTemplateData = (templateData, template) => {
  if (!template || !template.fields) return {};

  // Create a set of valid field keys for the template
  const validFields = new Set(template.fields.map((field) => field.field_key));

  // Filter the template data to only include valid fields
  const filteredData = {};
  Object.entries(templateData || {}).forEach(([key, value]) => {
    if (validFields.has(key)) {
      filteredData[key] = value;
    }
  });

  return filteredData;
};

export const usePatient = (initialPatient = null) => {
  const [patient, setPatient] = useState(initialPatient);
  const [templateKey, setTemplateKey] = useState(
    initialPatient?.template_key || null,
  );
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [isModified, setIsModified] = useState(false);
  const [finalCorrespondence, setFinalCorrespondence] = useState("");
  const [isFromOutstandingJobs, setIsFromOutstandingJobs] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const { defaultTemplate, loadDefaultTemplate } = useTemplate();
  const { currentTemplate } = useTemplateSelection();

  const loadPatientDetails = async (patientId) => {
    setLoading(true);
    try {
      const patientData = await patientApi.fetchPatientDetails(patientId, {
        setPatient,
        setSelectedDate,
        isFromOutstandingJobs,
        setIsFromOutstandingJobs,
      });
      const letter = await letterApi.fetchLetter(patientId);
      setFinalCorrespondence(letter || "No letter attached to encounter");
    } catch (error) {
      handleError(error, toast);
    } finally {
      setLoading(false);
    }
  };

  const createNewPatient = async () => {
    try {
      // Ensure default template is loaded
      let template = defaultTemplate;
      if (!template) {
        template = await loadDefaultTemplate();
      }

      if (!template) {
        throw new Error("No default template available");
      }

      const newPatient = {
        id: null,
        name: "",
        dob: "",
        ur_number: "",
        gender: "",
        template_key: "",
        template_data: {},
        raw_transcription: "",
        transcription_duration: null,
        process_duration: null,
        encounter_date: selectedDate,
        final_letter: "",
        jobs_list: [],
        all_jobs_completed: false,
        isNewEncounter: true,
      };
      console.log(selectedDate);
      setPatient(newPatient);
      setTemplateKey(template.template_key);
      setFinalCorrespondence(""); // Reset correspondence
      return newPatient;
    } catch (error) {
      console.error("Error creating new patient:", error);
      toast({
        title: "Error",
        description:
          "Failed to create new patient: No default template available",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      throw error;
    }
  };

  const savePatient = async (
    refreshSidebar,
    selectedDate,
    toast,
    initialContent = null,
  ) => {
    const missingFields = [];

    if (!patient?.name) missingFields.push("Name");
    if (!patient?.dob) missingFields.push("Date of Birth");
    if (!patient?.ur_number) missingFields.push("UR Number");
    if (!patient?.gender) missingFields.push("Gender");

    if (missingFields.length > 0) {
      toast({
        title: "Missing Required Fields",
        description: `Please fill in the following required fields: ${missingFields.join(", ")}`,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return null; // Return null to indicate save failed
    }

    try {
      if (!currentTemplate) {
        throw new Error("No template selected");
      }

      const patientToSave = {
        ...patient,
        template_key: currentTemplate.template_key,
        encounter_date: selectedDate,
        template_data: filterTemplateData(
          patient.template_data,
          currentTemplate,
        ),
      };

      // Prepare adaptive refinement data if initial content is provided
      let adaptiveRefinement = null;
      if (initialContent && patient.template_data) {
        console.error("Performing adaptive refinement");
        adaptiveRefinement = buildAdaptiveRefinementData(
          initialContent,
          patient.template_data,
          currentTemplate,
        );
      }

      // Create the save request payload
      const saveRequest = {
        patientData: patientToSave,
        ...(adaptiveRefinement &&
          Object.keys(adaptiveRefinement).length > 0 && {
            adaptive_refinement: adaptiveRefinement,
          }),
      };

      console.log("Saving patient with adaptive refinement:", saveRequest);

      const response = await patientApi.savePatientData(
        saveRequest,
        toast,
        refreshSidebar,
      );

      if (response) {
        setIsModified(false);
        if (!patient.id && response.id) {
          navigate(`/patient/${response.id}`);
        }
      }

      return response;
    } catch (error) {
      console.error("Error saving patient:", error);
      toast({
        title: "Error",
        description: "Failed to save patient data",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      throw error;
    }
  };

  const buildAdaptiveRefinementData = (
    initialContent,
    currentContent,
    template,
  ) => {
    const refinementData = {};

    if (!template?.fields) return refinementData;

    template.fields.forEach((field) => {
      const fieldKey = field.field_key;
      const initialValue = initialContent[fieldKey];
      const currentValue = currentContent[fieldKey];

      // Only include fields that have both initial and modified content
      if (initialValue && currentValue && initialValue !== currentValue) {
        // Ensure we have meaningful content (not just whitespace differences)
        const normalizedInitial = (initialValue || "").trim();
        const normalizedCurrent = (currentValue || "").trim();

        if (
          normalizedInitial &&
          normalizedCurrent &&
          normalizedInitial !== normalizedCurrent
        ) {
          refinementData[fieldKey] = {
            initial_content: normalizedInitial,
            modified_content: normalizedCurrent,
          };
          console.log(`Detected change in field '${fieldKey}':`, {
            initial: normalizedInitial.substring(0, 100),
            modified: normalizedCurrent.substring(0, 100),
          });
        }
      }
    });

    return refinementData;
  };

  const searchPatient = async (urNumber, selectedDate) => {
    try {
      const response = await universalFetch(
        `/api/patient/search?ur_number=${urNumber}`,
      );
      if (!response.ok) throw new Error("Search failed");

      const data = await response.json();
      if (data.length > 0) {
        const latestEncounter = data[0];

        // Create a new patient object with the passed selectedDate
        const newPatient = {
          ...latestEncounter,
          id: null,
          encounter_date: selectedDate, // Use the passed selectedDate
          template_data: {
            ...latestEncounter.template_data,
          },
          isNewEncounter: true,
        };

        // Fetch the previous visit summary
        try {
          const summaryResponse = await universalFetch(
            `/api/patient/summary/${latestEncounter.id}`,
          );
          if (summaryResponse.ok) {
            const summaryData = await summaryResponse.json();
            newPatient.previous_visit_summary = summaryData.summary;
          }
        } catch (error) {
          console.error("Error fetching previous visit summary:", error);
        }

        setPatient(newPatient);

        toast({
          title: "Patient Found",
          description: "Patient data pre-filled from the latest encounter.",
          status: "success",
          duration: 3000,
          isClosable: true,
        });

        return newPatient;
      }
      return null;
    } catch (error) {
      console.error("Error searching patient:", error);
      toast({
        title: "Error",
        description: `Error searching for patient: ${error.message}`,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      throw error;
    }
  };

  const generateLetter = async (letterData) => {
    try {
      await patientApi.generateLetter(
        letterData,
        setLoading,
        setFinalCorrespondence,
        toast,
      );
    } catch (error) {
      handleError(error, toast);
    }
  };

  useEffect(() => {
    if (initialPatient) {
      setPatient(initialPatient);
    }
  }, [initialPatient]);

  return {
    patient,
    setPatient,
    selectedDate,
    setSelectedDate,
    isModified,
    setIsModified,
    finalCorrespondence,
    setFinalCorrespondence,
    isFromOutstandingJobs,
    setIsFromOutstandingJobs,
    loading,
    loadPatientDetails,
    createNewPatient,
    savePatient,
    searchPatient,
    generateLetter,
  };
};
