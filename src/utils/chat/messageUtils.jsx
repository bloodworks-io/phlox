// Utility functions for formatting, validating, and truncating chat messages according to token count.
import { encodingForModel } from "js-tiktoken";

const enc = encodingForModel("gpt-4o");

export const validateInput = (userInput) => {
    return userInput.trim() !== "";
};

export const formatInitialMessage = (template, patientData) => {
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

    // Create content array with template fields
    const contentArray = template.fields
        .map((field) => {
            const value =
                template_data[field.field_key] ||
                `No ${field.field_name.toLowerCase()} available`;
            return [
                `${field.field_name}:`,
                value,
                "", // Add empty line for spacing
            ];
        })
        .flat();

    return {
        role: "user",
        content: contentArray.join("\n"),
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
