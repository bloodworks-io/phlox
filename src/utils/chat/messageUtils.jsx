// Utility functions for formatting and validating chat messages.
export const validateInput = (userInput) => {
    return userInput.trim() !== "";
};

export const formatPatientContext = (template, patientData) => {
    /**
     * Format patient context for the backend to build the system message.
     * Returns patient context object with name, dob, ur_number, encounter_date,
     * template_data, and template_fields.
     */
    if (!patientData || !template) {
        console.error(
            "Patient data and template are required for chat context",
            {
                hasPatientData: !!patientData,
                hasTemplate: !!template,
            },
        );
        return null;
    }

    // Check if template has fields
    if (!template.fields || !Array.isArray(template.fields)) {
        console.error("Template fields are not properly loaded:", template);
        return null;
    }

    const { template_data } = patientData;

    if (!template_data) {
        console.error("No template data available");
        return null;
    }

    return {
        name: patientData.name,
        dob: patientData.dob,
        ur_number: patientData.ur_number,
        gender: patientData.gender,
        address: patientData.address,
        phone: patientData.phone,
        encounter_date: patientData.encounter_date,
        template_data: template_data,
        template_fields: template.fields.map((field) => ({
            field_key: field.field_key,
            field_name: field.field_name,
        })),
    };
};
