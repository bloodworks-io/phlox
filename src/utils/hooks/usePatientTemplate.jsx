import { useEffect, useRef } from "react";
import { Steps } from "@chakra-ui/react";
import { useToast } from "@/utils/useToastShim";
import {
    useTemplateSelection,
    useTemplate,
} from "../templates/templateContext";
import { useToastMessage } from "./UseToastMessage";

export const usePatientTemplate = ({
    patient,
    setPatient,
    isNewPatient,
    isSearchedPatient,
    initialPatient,
    isSearchLoading,
}) => {
    const toast = useToast();
    const { showWarningToast } = useToastMessage();
    const hasDefaultTemplateBeenSet = useRef(false);

    const {
        currentTemplate,
        isTemplateChanging,
        defaultTemplate,
        templates,
        status: templateStatus,
        error: templateError,
        selectTemplate,
    } = useTemplateSelection();

    const { refreshTemplates } = useTemplate();

    // Refresh templates for new patients
    useEffect(() => {
        refreshTemplates();
    }, [refreshTemplates]);

    // Handle template errors
    useEffect(() => {
        if (templateError) {
            toast({
                title: "Template Error",
                description: templateError,
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        }
    }, [templateError, toast]);

    // Handle template consistency for already saved (historical) encounters
    useEffect(() => {
        if (!currentTemplate || !patient || isTemplateChanging) return;

        const shouldLockTemplate = !isNewPatient && !patient.isNewEncounter;

        if (
            shouldLockTemplate &&
            currentTemplate.template_key !== patient.template_key
        ) {
            selectTemplate(
                patient.template_key,
                "Maintaining historical template",
            );
        }
    }, [
        currentTemplate,
        patient,
        isNewPatient,
        selectTemplate,
        isTemplateChanging,
    ]);

    // Set default template for new patients
    useEffect(() => {
        const initializeNewPatient = async () => {
            if (isNewPatient && defaultTemplate && !patient?.template_key) {
                if (
                    !hasDefaultTemplateBeenSet.current &&
                    !patient?.template_key
                ) {
                    hasDefaultTemplateBeenSet.current = true;
                    try {
                        await selectTemplate(defaultTemplate.template_key);
                        setPatient((prev) => ({
                            ...prev,
                            template_key: defaultTemplate.template_key,
                        }));
                    } catch (error) {
                        console.error("Failed to set default template:", error);
                        toast({
                            title: "Error",
                            description: "Failed to set default template",
                            status: "error",
                            duration: 3000,
                            isClosable: true,
                        });
                    }
                }
            }
        };
        initializeNewPatient();
    }, [
        isNewPatient,
        defaultTemplate,
        patient,
        selectTemplate,
        setPatient,
        toast,
    ]);

    // Handle template data for historical patients
    useEffect(() => {
        if (
            !isNewPatient &&
            initialPatient &&
            currentTemplate &&
            !isSearchLoading
        ) {
            const newTemplateData = {};
            currentTemplate.fields.forEach((field) => {
                newTemplateData[field.field_key] =
                    initialPatient.template_data?.[field.field_key] || "";
            });

            setPatient((prev) => ({
                ...prev,
                template_data: newTemplateData,
                isHistorical: true,
            }));
        }
    }, [
        isNewPatient,
        initialPatient,
        currentTemplate,
        setPatient,
        isSearchLoading,
    ]);

    useEffect(() => {
        const handleHistoricalTemplate = async () => {
            if (!isNewPatient && !isSearchedPatient) {
                console.log(
                    "Viewing historical encounter - keeping original template",
                );
                return;
            }

            if (
                patient?.template_key &&
                defaultTemplate?.template_key &&
                patient?.template_key !== defaultTemplate?.template_key &&
                templates?.length > 0 &&
                (isNewPatient || isSearchedPatient)
            ) {
                const activeTemplate = templates.find(
                    (t) => t.template_key === patient.template_key,
                );

                if (!activeTemplate) {
                    console.warn(
                        "Pre-fill template is not active. Finding fallback...",
                    );
                    const baseKey = patient.template_key.split("_")[0];
                    const latestVersion = templates
                        .filter((t) => t.template_key.startsWith(baseKey))
                        .sort((a, b) =>
                            b.template_key.localeCompare(a.template_key),
                        )[0];

                    const fallback =
                        latestVersion || defaultTemplate || templates[0];

                    if (fallback) {
                        if (fallback.template_key === patient.template_key)
                            return;

                        console.log(
                            `Upgrading pre-fill template to: ${fallback.template_key}`,
                        );

                        setPatient((prev) => ({
                            ...prev,
                            template_key: fallback.template_key,
                            template_data: {
                                ...prev.template_data,
                            },
                        }));

                        await selectTemplate(fallback.template_key);

                        if (
                            fallback.template_key !== patient.template_key &&
                            isSearchedPatient
                        ) {
                            showWarningToast(
                                `Using ${fallback.template_name} template for this new encounter.`,
                            );
                        }
                    }
                }
            }
        };

        handleHistoricalTemplate();
    }, [
        isNewPatient,
        isSearchedPatient,
        patient?.template_key,
        defaultTemplate?.template_key,
        templates,
        defaultTemplate,
        selectTemplate,
        setPatient,
        showWarningToast,
    ]);

    return {
        currentTemplate,
        isTemplateChanging,
        defaultTemplate,
        templates,
        templateStatus,
        templateError,
        selectTemplate,
        refreshTemplates,
    };
};
