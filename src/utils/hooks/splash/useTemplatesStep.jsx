import { useState, useEffect } from "react";
import useSWR from "swr";
import { toaster } from "@/components/ui/toaster";
import { SPLASH_STEPS } from "../../../components/common/splash/constants";
import { validateTemplatesStep } from "../../../utils/splash/validators";
import { settingsApi } from "../../../utils/api/settingsApi";
import { KEYS } from "../../cache/keys";

export const useTemplatesStep = (currentStep) => {
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const shouldFetch = currentStep === SPLASH_STEPS.TEMPLATES;
  const {
    data: availableTemplates = [],
    isValidating: isFetchingTemplates,
    error,
  } = useSWR(shouldFetch ? KEYS.TEMPLATES : null, () =>
    settingsApi.fetchTemplates(),
  );

  useEffect(() => {
    if (error) {
      toaster.create({
        title: "Error fetching templates",
        description: error.message || "Could not load templates",
        type: "error",
        duration: 3000,
      });
    }
  }, [error]);

  // Auto-select first option when data arrives and nothing is selected
  useEffect(() => {
    if (availableTemplates.length > 0 && !selectedTemplate) {
      setSelectedTemplate(availableTemplates[0].template_key);
    }
  }, [availableTemplates, selectedTemplate]);

  return {
    availableTemplates,
    selectedTemplate,
    setSelectedTemplate,
    isFetchingTemplates,
    validate: () => validateTemplatesStep(selectedTemplate),
    getData: () => ({ selectedTemplate }),
  };
};
