import { useState, useEffect, useCallback } from "react";
import { toaster } from "@/components/ui/toaster";
import { SPLASH_STEPS } from "../../../components/common/splash/constants";
import { validateLettersStep } from "../../../utils/splash/validators";
import { settingsService } from "../../../utils/settings/settingsUtils";

export const useLettersStep = (currentStep) => {
  const [availableLetterTemplates, setAvailableLetterTemplates] = useState([]);
  const [selectedLetterTemplate, setSelectedLetterTemplate] = useState("");
  const [isFetchingLetterTemplates, setIsFetchingLetterTemplates] =
    useState(false);

  const fetchLetterTemplates = useCallback(async () => {
    if (
      currentStep === SPLASH_STEPS.ABOUT_YOU &&
      availableLetterTemplates.length === 0
    ) {
      setIsFetchingLetterTemplates(true);
      try {
        const response = await settingsService.fetchLetterTemplates();
        setAvailableLetterTemplates(response.templates || []);
        if (
          !selectedLetterTemplate &&
          response.templates &&
          response.templates.length > 0
        ) {
          setSelectedLetterTemplate(response.templates[0].id.toString());
        }
      } catch (error) {
        toaster.create({
          title: "Error fetching letter templates",
          description: error.message || "Could not load letter templates",
          type: "error",
          duration: 3000,
        });
      } finally {
        setIsFetchingLetterTemplates(false);
      }
    }
  }, [
    currentStep,
    availableLetterTemplates.length,
    selectedLetterTemplate,
  ]);

  useEffect(() => {
    fetchLetterTemplates();
  }, [fetchLetterTemplates]);

  return {
    availableLetterTemplates,
    selectedLetterTemplate,
    setSelectedLetterTemplate,
    isFetchingLetterTemplates,
    validate: () => validateLettersStep(selectedLetterTemplate),
    getData: () => ({ selectedLetterTemplate }),
  };
};
