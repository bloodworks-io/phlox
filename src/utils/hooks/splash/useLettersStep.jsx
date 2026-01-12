import { useState, useEffect, useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import { SPLASH_STEPS } from "../../../components/common/splash/constants";
import { validateLettersStep } from "../../../utils/splash/validators";
import { settingsService } from "../../../utils/settings/settingsUtils";

export const useLettersStep = (currentStep) => {
  const toast = useToast();
  const [availableLetterTemplates, setAvailableLetterTemplates] = useState([]);
  const [selectedLetterTemplate, setSelectedLetterTemplate] = useState("");
  const [isFetchingLetterTemplates, setIsFetchingLetterTemplates] =
    useState(false);

  const fetchLetterTemplates = useCallback(async () => {
    if (
      currentStep === SPLASH_STEPS.LETTERS &&
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
        toast({
          title: "Error fetching letter templates",
          description: error.message || "Could not load letter templates",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setIsFetchingLetterTemplates(false);
      }
    }
  }, [
    currentStep,
    availableLetterTemplates.length,
    selectedLetterTemplate,
    toast,
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
