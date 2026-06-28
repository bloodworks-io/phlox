import { useState } from "react";
import { Steps } from "@chakra-ui/react";
import { useToast } from "@/utils/useToastShim";
import { useTemplate } from "../templates/templateContext";
import {
    findPatients,
    buildEncounterFromCandidate,
} from "../patient/patientLoaders";

export const usePatientSession = () => {
    const [patient, setPatient] = useState(null);
    const [selectedDate, setSelectedDate] = useState(
        new Date().toISOString().split("T")[0],
    );
    const toast = useToast();
    const { defaultTemplate, loadDefaultTemplate } = useTemplate();

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
                first_name: "",
                last_name: "",
                dob: "",
                ur_number: "",
                gender: "",
                address: "",
                phone: "",
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

    const loadSelectedPatient = async (candidate, selectedDate) => {
        const newPatient = await buildEncounterFromCandidate(
            candidate,
            selectedDate,
        );
        setPatient(newPatient);
        return newPatient;
    };

    return {
        patient,
        setPatient,
        selectedDate,
        setSelectedDate,
        createNewPatient,
        findPatients,
        loadSelectedPatient,
    };
};
