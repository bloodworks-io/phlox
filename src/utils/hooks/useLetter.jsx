import { useState } from "react";
import { letterApi } from "../api/letterApi";
import { validateLetterData } from "../helpers/validationHelpers";
import { useToastMessage } from "./UseToastMessage";
import { truncateLetterContext } from "../letter/letterUtils";

export const useLetter = (setIsModified) => {
    const [loading, setLoading] = useState(false);
    const [finalCorrespondence, setFinalCorrespondence] = useState("");
    const [letterContext, setLetterContext] = useState([]);
    const [saveState, setSaveState] = useState("idle"); // Added saveState
    const { showSuccessToast, showErrorToast } = useToastMessage();

    const generateLetter = async (patient, additionalInstructions) => {
        // Clear context at the start of generation
        setLetterContext([]);
        // We require both template_data and a template key
        if (!patient?.template_data || !patient?.template_key) {
            showErrorToast(
                "Patient data and template are required for letter generation",
            );
            return;
        }

        setLoading(true);
        try {
            // Validate that necessary fields exist
            validateLetterData({
                patientName: patient.name,
                gender: patient.gender,
                dob: patient.dob,
            });

            // If no additional instructions were provided, use default instructions from the template
            if (!additionalInstructions) {
                const responseTemplates =
                    await letterApi.fetchLetterTemplates();
                if (
                    responseTemplates &&
                    responseTemplates.default_template_id
                ) {
                    const defaultTemplate = responseTemplates.templates.find(
                        (tpl) =>
                            tpl.id === responseTemplates.default_template_id,
                    );
                    if (defaultTemplate) {
                        additionalInstructions =
                            defaultTemplate.instructions || "";
                    }
                }
            }

            // Call the generateLetter API with the required fields (context is null on first generation)
            const response = await letterApi.generateLetter({
                patientName: patient.name,
                gender: patient.gender,
                dob: patient.dob,
                template_data: patient.template_data,
                additional_instruction: additionalInstructions,
                context: null,
            });
            setFinalCorrespondence(response.letter);
            setIsModified(true);
            showSuccessToast("Letter generated successfully");
        } catch (error) {
            console.error("Error generating letter:", error);
            showErrorToast(error.message || "Failed to generate letter");
        } finally {
            setLoading(false);
        }
    };

    const saveLetter = async (patientId) => {
        if (!patientId || !finalCorrespondence) {
            showErrorToast("Patient ID and letter content are required");
            return;
        }

        setSaveState("saving");
        try {
            await letterApi.saveLetter(patientId, finalCorrespondence);
            setIsModified(false);
            setSaveState("saved");
            setTimeout(() => setSaveState("idle"), 2000);
            showSuccessToast("Letter saved successfully");
        } catch (error) {
            console.error("Error saving letter:", error);
            setSaveState("idle");
            showErrorToast(error.message || "Failed to save letter");
            throw error; // Propagate error to handle in component
        }
    };

    async function refineLetter({
        patient,
        additionalInstructions,
        refinementInput,
        options,
        onSuccess = () => {},
    }) {
        if (!refinementInput.trim()) return;
        if (!options?.general?.num_ctx) {
            console.warn("Context window size not available");
            return;
        }

        setLoading(true);
        try {
            // Start with a copy of the current letter context.
            let updatedContext = [...letterContext];

            // If there is no context yet but we have an initial generated letter,
            // include it as the first assistant message.
            if (updatedContext.length === 0 && finalCorrespondence) {
                updatedContext.push({
                    role: "assistant",
                    content: finalCorrespondence,
                });
            }

            // Add the user's refinement message.
            updatedContext.push({
                role: "user",
                content: refinementInput,
            });

            // Determine token limit using the provided options.
            const maxTokens = options.general.num_ctx;
            const truncatedContext = truncateLetterContext(
                updatedContext,
                maxTokens * 0.9,
            );

            // Call the generateLetter API with the new context.
            const response = await letterApi.generateLetter({
                patientName: patient.name,
                gender: patient.gender,
                dob: patient.dob,
                template_data: patient.template_data,
                additional_instruction: additionalInstructions,
                context: truncatedContext,
            });

            // Append the assistant's response.
            const newContext = [
                ...truncatedContext,
                {
                    role: "assistant",
                    content: response.letter,
                },
            ];

            setLetterContext(newContext);
            setFinalCorrespondence(response.letter);
            setIsModified(true);
            onSuccess();
            showSuccessToast("Letter refined successfully");
        } catch (error) {
            console.error("Refinement error:", error);
            showErrorToast("Failed to refine letter");
        } finally {
            setLoading(false);
        }
    }

    function clearLetterContext() {
        setLetterContext([]);
    }

    async function loadLetter(patientId) {
        setLoading(true);
        try {
            const response = await letterApi.fetchLetter(patientId);
            setFinalCorrespondence(
                response.letter || "No letter attached to encounter",
            );
            setIsModified(false);
        } catch (error) {
            console.error("Error loading letter:", error);
            setFinalCorrespondence("No letter attached to encounter");
            showErrorToast("Failed to load letter");
        } finally {
            setLoading(false);
        }
    }

    function resetLetter() {
        setFinalCorrespondence("");
        setLetterContext([]);
        setIsModified(false);
    }

    return {
        loading,
        finalCorrespondence,
        setFinalCorrespondence,
        generateLetter,
        saveLetter,
        loadLetter,
        resetLetter,
        refineLetter,
        letterContext,
        setLetterContext,
        clearLetterContext,
        saveState,
        setSaveState,
    };
};
