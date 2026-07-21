import { useState, useEffect } from "react";
import useSWR from "swr";
import { toaster } from "@/components/ui/toaster";
import { SPLASH_STEPS } from "../../../components/common/splash/constants";
import { validateLettersStep } from "../../../utils/splash/validators";
import { settingsService } from "../../../utils/settings/settingsUtils";
import { KEYS } from "../../cache/keys";

export const useLettersStep = (currentStep) => {
  const [selectedLetterTemplate, setSelectedLetterTemplate] = useState("");

  const shouldFetch = currentStep === SPLASH_STEPS.ABOUT_YOU;
  const {
    data: availableLetterTemplates = [],
    isValidating: isFetchingLetterTemplates,
    error,
  } = useSWR(shouldFetch ? KEYS.LETTER_TEMPLATES : null, async () => {
    const response = await settingsService.fetchLetterTemplates();
    return response.templates || [];
  });

  useEffect(() => {
    if (error) {
      toaster.create({
        title: "Error fetching letter templates",
        description: error.message || "Could not load letter templates",
        type: "error",
        duration: 3000,
      });
    }
  }, [error]);

  // Auto-select first option when data arrives and nothing is selected
  useEffect(() => {
    if (availableLetterTemplates.length > 0 && !selectedLetterTemplate) {
      setSelectedLetterTemplate(availableLetterTemplates[0].id.toString());
    }
  }, [availableLetterTemplates, selectedLetterTemplate]);

  return {
    availableLetterTemplates,
    selectedLetterTemplate,
    setSelectedLetterTemplate,
    isFetchingLetterTemplates,
    validate: () => validateLettersStep(selectedLetterTemplate),
    getData: () => ({ selectedLetterTemplate }),
  };
};
