import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toaster } from "@/components/ui/toaster";
import { useTemplateSelection, useTemplate } from "../templates/templateContext";
import { latestInFamily } from "../templates/templateFamily";
import { useToastMessage } from "./UseToastMessage";

// Decides which template applies to the encounter being viewed or edited:
//   - historical encounter: locked to the template it was saved with
//     (pinned keys may be soft-deleted, so they resolve with
//     includeDeleted)
//   - new encounter without a template: the default template
//   - new encounter for a returning patient whose previous template key is
//     no longer active: upgrade to the latest member of its family, where
//     the user's customizations (forks) outrank old protected versions
export const usePatientTemplate = ({
    patient,
    setPatient,
    isNewPatient,
    isSearchedPatient,
    initialPatient,
    isSearchLoading,
}) => {
    const { t } = useTranslation();
    const { showWarningToast } = useToastMessage();

    const {
        currentTemplate,
        defaultTemplate,
        templates,
        status: templateStatus,
        error: templateError,
        selectTemplate,
    } = useTemplateSelection();

    const { refreshTemplates } = useTemplate();

    // Surface template errors
    useEffect(() => {
        if (templateError) {
            toaster.create({
                title: t("patient.toast.templateError"),
                description: templateError,
                type: "error",
                duration: 5000,
            });
        }
    }, [templateError, t]);

    // Resolve the active template for the current encounter context
    useEffect(() => {
        const resolveTemplate = async () => {
            if (!patient || !templates) {
                return;
            }

            const isHistoricalView = !isNewPatient && !patient.isNewEncounter;

            if (isHistoricalView) {
                // Historical encounter: keep the template it was created
                // with, even if a newer version has since replaced it.
                if (
                    patient.template_key &&
                    currentTemplate?.template_key !== patient.template_key
                ) {
                    await selectTemplate(patient.template_key, {
                        includeDeleted: true,
                    });
                }
                return;
            }

            if (!patient.template_key) {

                const fallbackKey =
                    defaultTemplate?.template_key ??
                    templates[0]?.template_key;
                if (fallbackKey) {
                    await selectTemplate(fallbackKey);
                    setPatient((prev) =>
                        prev.template_key === fallbackKey
                            ? prev
                            : {
                                  ...prev,
                                  template_key: fallbackKey,
                              },
                    );
                }
                return;
            }

            // New encounter pre-filled from a previous visit: keep the key
            // while it is still active, otherwise upgrade to the latest
            // member of its family (forks first).
            const isActive = templates.some(
                (t) => t.template_key === patient.template_key,
            );
            if (isActive) {
                if (currentTemplate?.template_key !== patient.template_key) {
                    await selectTemplate(patient.template_key);
                }
                return;
            }

            const fallback =
                latestInFamily(templates, patient.template_key) ??
                defaultTemplate ??
                templates[0];
            if (!fallback || fallback.template_key === patient.template_key) {
                return;
            }

            setPatient((prev) => ({
                ...prev,
                template_key: fallback.template_key,
            }));
            await selectTemplate(fallback.template_key);

            if (isSearchedPatient) {
                showWarningToast(
                    t("patient.toast.usingTemplate", {
                        name: fallback.template_name,
                    }),
                );
            }
        };

        resolveTemplate();
    }, [
        patient?.template_key,
        patient?.isNewEncounter,
        isNewPatient,
        isSearchedPatient,
        defaultTemplate?.template_key,
        templates,
        currentTemplate?.template_key,
        selectTemplate,
        setPatient,
        showWarningToast,
        t,
    ]);

    // Map historical encounter data onto the current template's fields
    useEffect(() => {
        if (
            !isNewPatient &&
            initialPatient &&
            currentTemplate &&
            !isSearchLoading
        ) {
            const newTemplateData = {};
            currentTemplate.fields?.forEach((field) => {
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

    return {
        currentTemplate,
        defaultTemplate,
        templates,
        templateStatus,
        templateError,
        selectTemplate,
        refreshTemplates,
    };
};
