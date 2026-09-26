import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toaster } from "@/components/ui/toaster";
import { useTemplate } from "../templates/templateContext";
import {
    findPatients,
    buildEncounterFromCandidate,
} from "../patient/patientLoaders";

export const usePatientSession = () => {
    const { t } = useTranslation();
    const [patient, setPatient] = useState(null);
    const [selectedDate, setSelectedDate] = useState(
        new Date().toISOString().split("T")[0],
    );
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
            toaster.create({
                title: t("toast.error"),
                description: t("patient.toast.createFailedNoTemplate"),
                type: "error",
                duration: 3000,
            });
            throw error;
        }
    };

    const loadSelectedPatient = async (candidate, selectedDate) => {
        const newPatient = await buildEncounterFromCandidate(
            candidate,
            selectedDate,
            // Guard: don't apply a stale summary if the user switched patients
            (summary) =>
                setPatient((prev) =>
                    prev?.isNewEncounter &&
                    prev.ur_number === candidate.ur_number
                        ? {
                              ...prev,
                              previous_visit_summary: summary ?? undefined,
                              previous_visit_summary_pending: false,
                          }
                        : prev,
                ),
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
