// Utility functions for formatting, validating, and truncating chat messages according to token count.
import { encodingForModel } from "js-tiktoken";

const enc = encodingForModel("gpt-4o");

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
        encounter_date: patientData.encounter_date,
        template_data: template_data,
        template_fields: template.fields.map((field) => ({
            field_key: field.field_key,
            field_name: field.field_name,
        })),
    };
};

export const truncateConversationHistory = (messages) => {
    let conversationHistoryStr = messages
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join(" ");
    let conversationHistoryTokenCount = enc.encode(
        conversationHistoryStr,
    ).length;

    while (conversationHistoryTokenCount > 5000 && messages.length > 2) {
        messages.splice(1, 2);
        conversationHistoryStr = messages
            .map((msg) => `${msg.role}: ${msg.content}`)
            .join(" ");
        conversationHistoryTokenCount = enc.encode(
            conversationHistoryStr,
        ).length;
    }

    return messages;
};
