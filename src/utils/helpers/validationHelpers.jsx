// Helper functions for validating data before submission.
export const validatePatientData = (patientData) => {
    const requiredFields = ["name", "dob", "ur_number", "gender"];
    const missingFields = requiredFields.filter((field) => !patientData[field]);

    if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
    }

    return true;
};

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
