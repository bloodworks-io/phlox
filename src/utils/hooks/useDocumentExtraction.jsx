import { useState } from "react";

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

            toast({
                title: "Document processed",
                description: "Use the toggle buttons to update fields",
                status: "success",
                duration: 3000,
                isClosable: true,
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
            toast({
                title: "No content available",
                description:
                    "This field doesn't have any content in the uploaded document",
                status: "info",
                duration: 2000,
                isClosable: true,
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
