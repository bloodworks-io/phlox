import { useState, useEffect } from "react";
import { letterApi } from "../api/letterApi";
import { settingsApi } from "../api/settingsApi";

export const useLetterTemplates = (patientId) => {
    const [letterTemplates, setLetterTemplates] = useState([]);
    const [defaultTemplateId, setDefaultTemplateId] = useState(null);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [additionalInstructions, setAdditionalInstructions] = useState("");
    const [options, setOptions] = useState(null);

    // Fetch options (settings)
    useEffect(() => {
        const fetchOptions = async () => {
            try {
                const response = await settingsApi.fetchOptions();
                setOptions(response);
            } catch (error) {
                console.error("Failed to fetch options:", error);
            }
        };
        fetchOptions();
    }, []);

    // Fetch letter templates
    useEffect(() => {
        if (!patientId) return;

        letterApi
            .fetchLetterTemplates()
            .then((response) => {
                setLetterTemplates(response.templates);
                if (response.default_template_id) {
                    setDefaultTemplateId(response.default_template_id);

                    // Reset to default template when patient changes or component mounts
                    const defaultTpl = response.templates.find(
                        (t) => t.id === response.default_template_id,
                    );
                    if (defaultTpl) {
                        setSelectedTemplate(defaultTpl);
                        // Set initial instructions from default template
                        setAdditionalInstructions(
                            defaultTpl.instructions || "",
                        );
                    }
                }
            })
            .catch((err) =>
                console.error("Error fetching letter templates:", err),
            );
    }, [patientId]);

    const selectTemplate = (template) => {
        if (template === "custom") {
            setSelectedTemplate("custom");
        } else {
            setSelectedTemplate(template);
            setAdditionalInstructions(template.instructions || "");
        }
    };

    const getInstructions = () => {
        if (selectedTemplate === "custom") {
            return additionalInstructions;
        } else if (selectedTemplate && selectedTemplate.instructions) {
            return selectedTemplate.instructions;
        } else if (!selectedTemplate && defaultTemplateId) {
            const defaultTpl = letterTemplates.find(
                (t) => t.id === defaultTemplateId,
            );
            return defaultTpl
                ? defaultTpl.instructions
                : additionalInstructions;
        }
        return additionalInstructions;
    };

    return {
        letterTemplates,
        defaultTemplateId,
        selectedTemplate,
        additionalInstructions,
        setAdditionalInstructions,
        options,
        selectTemplate,
        getInstructions,
    };
};
