import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toaster } from "@/components/ui/toaster";

export const useDocumentExtraction = ({
    patient,
    setPatient,
    setIsModified,
}) => {
    const { t } = useTranslation();
    const [originalContent, setOriginalContent] = useState({});
    const [replacedFields, setReplacedFields] = useState({});
    const [extractedDocData, setExtractedDocData] = useState(null);
    const [docFileName, setDocFileName] = useState("");

    const handleDocumentComplete = (data) => {
        if (!data.fieldByField) {
            if (!extractedDocData) {
                setOriginalContent({ ...patient.template_data });
            }

            setExtractedDocData(data);

            toaster.create({
                title: t("documentExtraction.toast.processed"),
                description: t("documentExtraction.toast.processedDescription"),
                type: "success",
                duration: 3000,
            });
        } else {
            const fieldKey = Object.keys(data.fields)[0];

            setReplacedFields((prev) => ({
                ...prev,
                [fieldKey]: !prev[fieldKey],
            }));

            setPatient((prev) => ({
                ...prev,
                template_data: {
                    ...prev.template_data,
                    ...data.fields,
                },
            }));

            setIsModified(true);
        }
    };

    const toggleDocumentField = (fieldKey) => {
        if (!extractedDocData) return;

        const hasExtractedContent = Boolean(
            extractedDocData.fields[fieldKey]?.trim(),
        );
        if (!hasExtractedContent) {
            toaster.create({
                title: t("documentExtraction.toast.noContent"),
                description: t("documentExtraction.toast.noContentDescription"),
                type: "info",
                duration: 2000,
            });
            return;
        }

        const isCurrentlyReplaced = replacedFields[fieldKey];

        let fieldContent;
        if (isCurrentlyReplaced) {
            fieldContent = originalContent[fieldKey] || "";
        } else {
            fieldContent = extractedDocData.fields[fieldKey] || "";
        }

        handleDocumentComplete({
            fields: { [fieldKey]: fieldContent },
            fieldByField: true,
        });
    };

    const resetDocumentState = () => {
        setExtractedDocData(null);
        setReplacedFields({});
        setOriginalContent({});
        setDocFileName("");
    };

    return {
        extractedDocData,
        replacedFields,
        docFileName,
        setDocFileName,
        handleDocumentComplete,
        toggleDocumentField,
        resetDocumentState,
    };
};
