import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/utils/useToastShim";
import { useTemplateSelection } from "../templates/templateContext";
import { patientApi } from "../api/patientApi";
import {
    findPatients,
    buildEncounterFromCandidate,
} from "../patient/patientLoaders";

const filterTemplateData = (templateData, template) => {
    if (!template || !template.fields) return {};

    // Create a set of valid field keys for the template
    const validFields = new Set(
        template.fields.map((field) => field.field_key),
    );

    // Filter the template data to only include valid fields
    const filteredData = {};
    Object.entries(templateData || {}).forEach(([key, value]) => {
        if (validFields.has(key)) {
            filteredData[key] = value;
        }
    });

    return filteredData;
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

export const usePatientEditor = (initialPatient = null) => {
    const [patient, setPatient] = useState(initialPatient);
    const [isModified, setIsModified] = useState(false);
    const toast = useToast();
    const navigate = useNavigate();
    const { currentTemplate } = useTemplateSelection();

    const savePatientCore = async (
        refreshSidebar,
        selectedDate,
        toast,
        initialContent = null,
    ) => {
        const missingFields = [];

        if (!patient?.first_name) missingFields.push("First name");
        if (!patient?.last_name) missingFields.push("Last name");
        if (!patient?.dob) missingFields.push("Date of Birth");
        if (!patient?.ur_number) missingFields.push("UR Number");

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

            console.log(
                "Saving patient with adaptive refinement:",
                saveRequest,
            );

            const response = await patientApi.savePatientData(
                saveRequest,
                toast,
                refreshSidebar,
            );

            if (response) {
                setIsModified(false);
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

    const savePatient = async (
        refreshSidebar,
        selectedDate,
        toast,
        initialContent = null,
    ) => {
        const response = await savePatientCore(
            refreshSidebar,
            selectedDate,
            toast,
            initialContent,
        );
        if (response && !patient.id && response.id) {
            navigate(`/note/${response.id}`);
        }
        return response;
    };

    const searchPatient = async (urNumber, selectedDate) => {
        try {
            const list = await findPatients(urNumber);
            const hit = list[0];
            if (!hit) return null;
            const loaded = await buildEncounterFromCandidate(hit, selectedDate);
            setPatient(loaded);
            toast({
                title: "Patient Found",
                description:
                    "Patient data pre-filled from the latest encounter.",
                status: "success",
                duration: 3000,
                isClosable: true,
            });
            return loaded;
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

    useEffect(() => {
        if (initialPatient) {
            setPatient(initialPatient);
        }
    }, [initialPatient]);

    return {
        patient,
        setPatient,
        setIsModified,
        savePatient,
        savePatientCore,
        searchPatient,
    };
};
