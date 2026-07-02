import { useState } from "react";
import { toaster } from "@/components/ui/toaster";
const toast = toaster.create;

export const useDocumentExtraction = ({
    patient,
    setPatient,
    setIsModified,
    toast,
}) => {
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
                title: "Document processed",
                description: "Use the toggle buttons to update fields",
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
                title: "No content available",
                description:
                    "This field doesn't have any content in the uploaded document",
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
