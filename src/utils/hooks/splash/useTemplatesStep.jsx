import { useState, useEffect, useCallback } from "react";
import { toaster } from "@/components/ui/toaster";
import { SPLASH_STEPS } from "../../../components/common/splash/constants";
import { validateTemplatesStep } from "../../../utils/splash/validators";
import { settingsApi } from "../../../utils/api/settingsApi";

export const useTemplatesStep = (currentStep) => {
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [isFetchingTemplates, setIsFetchingTemplates] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (currentStep === SPLASH_STEPS.TEMPLATES && availableTemplates.length === 0) {
      setIsFetchingTemplates(true);
      try {
        const templates = await settingsApi.fetchTemplates();
        setAvailableTemplates(templates);
        if (!selectedTemplate && templates.length > 0) {
          setSelectedTemplate(templates[0].template_key);
        }
      } catch (error) {
        toaster.create({
          title: "Error fetching templates",
          description: error.message || "Could not load templates",
          type: "error",
          duration: 3000,
        });
      } finally {
        setIsFetchingTemplates(false);
      }
    }
  }, [currentStep, availableTemplates.length, selectedTemplate]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    availableTemplates,
    selectedTemplate,
    setSelectedTemplate,
    isFetchingTemplates,
    validate: () => validateTemplatesStep(selectedTemplate),
    getData: () => ({ selectedTemplate }),
  };
};
