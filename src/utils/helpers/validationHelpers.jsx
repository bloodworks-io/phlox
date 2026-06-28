// Helper functions for validating data before submission.

export const areRequiredDemographicsMet = (patient) =>
    Boolean(
        patient?.first_name?.trim() &&
        patient?.last_name?.trim() &&
        patient?.dob?.trim() &&
        patient?.ur_number?.trim(),
    );

export const validateLetterData = (letterData) => {
    const validations = {
        patientName: (val) => typeof val === "string" && val.length > 0,
        gender: (val) => ["M", "F"],
    };

    Object.entries(validations).forEach(([field, validator]) => {
        if (!validator(letterData[field])) {
            throw new Error(`Invalid ${field}`);
        }
    });

    return true;
};
