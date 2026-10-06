import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { letterApi } from "../api/letterApi";
import type { LetterMessage, LetterTemplatesResponse } from "../api/letterApi";
import { validateLetterData } from "../helpers/validationHelpers";
import { useToastMessage } from "./UseToastMessage";

export type SaveState = "idle" | "saving" | "saved";

export interface LetterPatient {
    id: number | null;
    name: string;
    gender: string;
    dob: string;
    template_key: string | null;
    template_data: Record<string, unknown> | null;
}

export type SetIsModified = (value: boolean) => void;

interface RefineLetterArgs {
    patient: LetterPatient;
    additionalInstructions?: string | null;
    refinementInput: string;
    onSuccess?: () => void;
}

export const useLetter = (setIsModified: SetIsModified) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [finalCorrespondence, setFinalCorrespondence] = useState("");
    const [letterContext, setLetterContext] = useState<LetterMessage[]>([]);
    const [saveState, setSaveState] = useState<SaveState>("idle");
    const { showSuccessToast, showErrorToast } = useToastMessage();

    const generateLetter = async (
        patient: LetterPatient,
        additionalInstructions?: string | null,
    ) => {
        // Clear context at the start of generation
        setLetterContext([]);
        // We require both template_data and a template key
        if (!patient?.template_data || !patient?.template_key) {
            showErrorToast(
                t("letter.toast.dataRequired"),
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
                const responseTemplates: LetterTemplatesResponse =
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
            showSuccessToast(t("letter.toast.generated"));
        } catch (error) {
            console.error("Error generating letter:", error);
            showErrorToast(error.message || t("letter.toast.generateFailed"));
        } finally {
            setLoading(false);
        }
    };

    const saveLetter = async (noteId: number) => {
        if (!noteId || !finalCorrespondence) {
            showErrorToast(t("letter.toast.saveRequired"));
            return;
        }

        setSaveState("saving");
        try {
            await letterApi.saveLetter(noteId, finalCorrespondence);
            setIsModified(false);
            setSaveState("saved");
            setTimeout(() => setSaveState("idle"), 2000);
            showSuccessToast(t("letter.toast.saved"));
        } catch (error) {
            console.error("Error saving letter:", error);
            setSaveState("idle");
            showErrorToast(error.message || t("letter.toast.saveFailed"));
            throw error; // Propagate error to handle in component
        }
    };

    async function refineLetter({
        patient,
        additionalInstructions,
        refinementInput,
        onSuccess = () => {},
    }: RefineLetterArgs) {
        if (!refinementInput.trim()) return;

        setLoading(true);
        try {
            // Start with a copy of the current letter context.
            const updatedContext: LetterMessage[] = [...letterContext];

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

            // Call the generateLetter API; the server truncates the context
            const response = await letterApi.generateLetter({
                patientName: patient.name,
                gender: patient.gender,
                dob: patient.dob,
                template_data: patient.template_data ?? {},
                additional_instruction: additionalInstructions,
                context: updatedContext,
            });

            // Append the assistant's response.
            const newContext: LetterMessage[] = [
                ...(response.context || []),
                {
                    role: "assistant",
                    content: response.letter,
                },
            ];

            setLetterContext(newContext);
            setFinalCorrespondence(response.letter);
            setIsModified(true);
            onSuccess();
            showSuccessToast(t("letter.toast.refined"));
        } catch (error) {
            console.error("Refinement error:", error);
            showErrorToast(t("letter.toast.refineFailed"));
        } finally {
            setLoading(false);
        }
    }

    function clearLetterContext() {
        setLetterContext([]);
    }

    async function loadLetter(noteId: number) {
        setLoading(true);
        try {
            const response = await letterApi.fetchLetter(noteId);
            setFinalCorrespondence(response.letter || "");
            setIsModified(false);
        } catch (error) {
            console.error("Error loading letter:", error);
            setFinalCorrespondence("");
            showErrorToast(t("letter.toast.loadFailed"));
        } finally {
            setLoading(false);
        }
    }

    const resetLetter = useCallback(() => {
        setFinalCorrespondence("");
        setLetterContext([]);
        setIsModified(false);
    }, [setIsModified]);

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
