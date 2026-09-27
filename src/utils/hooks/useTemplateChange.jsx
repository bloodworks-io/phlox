import { useState } from "react";
import { patientApi } from "../api/patientApi";
import { getTemplateFamilyBase } from "../templates/templateFamily";

export const useTemplateChange = ({
    patient,
    setPatient,
    selectTemplate,
}) => {
    const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
    const [pendingTemplateKey, setPendingTemplateKey] = useState(null);

    const requestTemplateChange = (templateKey) => {
        setPendingTemplateKey(templateKey);
        setIsChangeModalOpen(true);
    };

    const cancelTemplateChange = () => {
        setIsChangeModalOpen(false);
    };

    const confirmTemplateChange = async () => {
        if (!pendingTemplateKey) {
            return;
        }

        // Returning patient: pre-fill persistent fields from the most
        // recent note of the target template's family.
        if (patient?.ur_number) {
            try {
                const baseTemplateKey = getTemplateFamilyBase(
                    pendingTemplateKey,
                );
                const history = await patientApi.fetchPatientHistoryByTemplate(
                    patient.ur_number,
                    baseTemplateKey,
                );

                if (history && history.length > 0) {
                    const mostRecent = history[0];
                    setPatient((prev) => ({
                        ...prev,
                        template_key: pendingTemplateKey,
                        template_data: {
                            ...mostRecent.template_data,
                        },
                    }));
                    setIsChangeModalOpen(false);
                    await selectTemplate(pendingTemplateKey);
                    return;
                }
            } catch (error) {
                console.error("Error fetching history for template:", error);
            }
        }

        // No history (or the lookup failed): start the new template empty.
        setPatient((prev) => ({
            ...prev,
            template_key: pendingTemplateKey,
            template_data: {},
        }));
        setIsChangeModalOpen(false);
        await selectTemplate(pendingTemplateKey);
    };

    return {
        isChangeModalOpen,
        pendingTemplateKey,
        requestTemplateChange,
        cancelTemplateChange,
        confirmTemplateChange,
    };
};
