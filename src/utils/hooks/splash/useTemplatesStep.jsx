import { useState, useEffect, useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import { SPLASH_STEPS } from "../../../components/common/splash/constants";
import { validateTemplatesStep } from "../../../utils/splash/validators";
import { settingsService } from "../../../utils/settings/settingsUtils";

export const useTemplatesStep = (currentStep) => {
  const toast = useToast();
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [isFetchingTemplates, setIsFetchingTemplates] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (currentStep === SPLASH_STEPS.TEMPLATES && availableTemplates.length === 0) {
      setIsFetchingTemplates(true);
      try {
        await settingsService.fetchTemplates((templates) => {
          setAvailableTemplates(templates);
          if (!selectedTemplate && templates.length > 0) {
            setSelectedTemplate(templates[0].template_key);
          }
        });
      } catch (error) {
        toast({
          title: "Error fetching templates",
          description: error.message || "Could not load templates",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setIsFetchingTemplates(false);
      }
    }
  }, [currentStep, availableTemplates.length, selectedTemplate, toast]);

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
