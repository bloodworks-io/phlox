import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { toaster } from "@/components/ui/toaster";
import { useTemplateSelection } from "../templates/templateContext";
import { patientApi } from "../api/patientApi";
import { buildEncounterFromCandidate } from "../patient/patientLoaders";

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


export const usePatientEditor = (initialPatient = null) => {
    const [patient, setPatient] = useState(initialPatient);
    const [, setIsModified] = useState(false);
    const navigate = useNavigate();
    const { currentTemplate } = useTemplateSelection();

    const savePatientCore = async (refreshSidebar, selectedDate, toast) => {
        const missingFields = [];

        if (!patient?.first_name) missingFields.push("First name");
        if (!patient?.last_name) missingFields.push("Last name");
        if (!patient?.dob) missingFields.push("Date of Birth");
        if (!patient?.ur_number) missingFields.push("UR Number");

        if (missingFields.length > 0) {
            toaster.create({
                title: "Missing Required Fields",
                description: `Please fill in the following required fields: ${missingFields.join(", ")}`,
                type: "error",
                duration: 3000,
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

            const saveRequest = { patientData: patientToSave };


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
            toaster.create({
                title: "Error",
                description: "Failed to save patient data",
                type: "error",
                duration: 3000,
            });
            throw error;
        }
    };

    const savePatient = async (refreshSidebar, selectedDate, toast) => {
        const response = await savePatientCore(refreshSidebar, selectedDate, toast);
        if (response && !patient.id && response.id) {
            navigate(`/note/${response.id}`);
        }
        return response;
    };

    const loadCandidate = async (candidate, selectedDate) => {
        const loaded = await buildEncounterFromCandidate(
            candidate,
            selectedDate,
        );
        setPatient(loaded);
        return loaded;
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
        loadCandidate,
    };
};
