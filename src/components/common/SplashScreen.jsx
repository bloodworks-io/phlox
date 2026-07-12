import { useState, useMemo } from "react";
import { Box, Button, Heading, VStack, Text, Flex, Image, HStack, Progress } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
const toast = toaster.create;
import { FaArrowRight, FaArrowLeft } from "react-icons/fa";
import { settingsService } from "../../utils/settings/settingsUtils";
import { isTauri } from "../../utils/helpers/apiConfig";
import {
  SPLASH_STEPS,
  STEP_TITLES,
  STEP_DESCRIPTIONS,
} from "./splash/constants";
import { usePersonalStep, AboutYouStep } from "./splash/steps/AboutYouStep";
import { AIModelsStep } from "./splash/steps/AIModelsStep";
import { TemplatesStep } from "./splash/steps/TemplatesStep";
import { useLLMStep } from "../../utils/hooks/splash/useLLMStep";
import { useTranscriptionStep } from "../../utils/hooks/splash/useTranscriptionStep";
import { useTemplatesStep } from "../../utils/hooks/splash/useTemplatesStep";
import { useLettersStep } from "../../utils/hooks/splash/useLettersStep";

const SplashScreen = ({ onComplete }) => {

  const [currentStep, setCurrentStep] = useState(SPLASH_STEPS.ABOUT_YOU);
  const [isLoading, setIsLoading] = useState(false);

  const visibleSteps = useMemo(
    () => [SPLASH_STEPS.ABOUT_YOU, SPLASH_STEPS.TEMPLATES, SPLASH_STEPS.AI_MODELS],
    [],
  );

  const totalSteps = visibleSteps.length + (isTauri() ? 1 : 0);
  const actualStepIndex = visibleSteps.indexOf(currentStep);
  const currentStepIndex = actualStepIndex + (isTauri() ? 1 : 0);

  // Hooks
  const personal = usePersonalStep();
  const llm = useLLMStep(currentStep);
  const transcription = useTranscriptionStep(currentStep, llm.inferenceMode);
  const templates = useTemplatesStep(currentStep);
  const letters = useLettersStep(currentStep);

  const getCurrentValidator = () => {
    switch (currentStep) {
      case SPLASH_STEPS.ABOUT_YOU:
        return personal.validate;
      case SPLASH_STEPS.AI_MODELS:
        return () => llm.validate() && transcription.validate();
      case SPLASH_STEPS.TEMPLATES:
        return templates.validate;
      default:
        return () => false;
    }
  };

  const getValidationMessage = () => {
    switch (currentStep) {
      case SPLASH_STEPS.ABOUT_YOU:
        return "Please enter your name and select your specialty.";
      case SPLASH_STEPS.AI_MODELS:
        if (llm.inferenceMode === "local") {
          if (!llm.validate()) return "Please download and select a model.";
          return "Please download the transcription model.";
        }
        return "Please select a primary model.";
      case SPLASH_STEPS.TEMPLATES:
        return "Please select a default template.";
      default:
        return "Please complete all required fields.";
    }
  };

  const handleNext = () => {
    const validator = getCurrentValidator();
    if (!validator()) {
      toaster.create({
        title: "Missing Information",
        description: getValidationMessage(),
        type: "warning",
        duration: 3000,
      });
      return;
    }

    const nextIndex = actualStepIndex + 1;
    if (nextIndex < visibleSteps.length) {
      setCurrentStep(visibleSteps[nextIndex]);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    const prevIndex = actualStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(visibleSteps[prevIndex]);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      let currentUserSettings = {};
      await settingsService.fetchUserSettings((data) => {
        currentUserSettings = data;
      });

      const personalData = personal.getData();
      const llmData = llm.getData();
      const transcriptionData = transcription.getData();
      const templatesData = templates.getData();
      const lettersData = letters.getData();

      const userSettingsToSave = {
        ...currentUserSettings,
        ...personalData,
        default_letter_template_id: lettersData.selectedLetterTemplate
          ? parseInt(lettersData.selectedLetterTemplate)
          : null,
      };

      await settingsService.saveUserSettings(userSettingsToSave);

      const currentGlobalConfig = await settingsService.fetchConfig();
      const configToSave = {
        ...currentGlobalConfig,
        LLM_PROVIDER: llmData.llmProvider,
        LLM_BASE_URL: llmData.llmBaseUrl,
        LLM_API_KEY: llmData.llmApiKey || "",
        PRIMARY_MODEL: llmData.primaryModel,
        WHISPER_BASE_URL: transcriptionData.whisperBaseUrl,
        WHISPER_MODEL: transcriptionData.whisperModel,
      };

      if (settingsService.saveGlobalConfig) {
        await settingsService.saveGlobalConfig(configToSave);
      } else {
        await settingsService.updateConfig(configToSave);
      }

      if (templatesData.selectedTemplate) {
        await settingsService.setDefaultTemplate(
          templatesData.selectedTemplate,
          toast,
        );
      }

      await settingsService.markSplashCompleted();
      toaster.create({
        title: "Setup Complete!",
        description: "You're ready to start using Phlox.",
        type: "success",
        duration: 5000,
      });
      onComplete();
    } catch (error) {
      toaster.create({
        title: "Error Saving Settings",
        description: error.message || "An unexpected error occurred.",
        type: "error",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canProceedToNext = () => getCurrentValidator()();

  const renderCurrentStep = () => {
    switch (currentStep) {
      case SPLASH_STEPS.ABOUT_YOU:
        return (
          <AboutYouStep
            {...personal}
            letters={letters}
          />
        );
      case SPLASH_STEPS.AI_MODELS:
        return <AIModelsStep llm={llm} transcription={transcription} />;
      case SPLASH_STEPS.TEMPLATES:
        return <TemplatesStep {...templates} />;
      default:
        return null;
    }
  };


  return (
    <Flex
      align="center"
      justify="center"
      minH="100dvh"
      className="splash-bg"
      px={4}
      py={8}
      position="relative"
    >
      {isTauri() && (
        <Box
          data-tauri-drag-region
          height="25px"
          position="fixed"
          top="0"
          left="0"
          right="0"
          zIndex="1000"
        />
      )}
      <Box
        className="anim-fade-scale panels-bg splash-panel"
        p={{ base: 6, md: 8 }}
        boxShadow="2xl"
        borderWidth="1px"
        borderColor="surface"
        w={{ base: "100%", sm: "90%", md: "600px" }}
        maxW="600px"
        h="600px"
        maxH="85vh"
        position="relative"
        overflow="hidden"
        display="flex"
        flexDirection="column"
      >
        <Box
          position="absolute"
          top="0"
          left="0"
          right="0"
          height="120px"
          bgGradient="linear(to b, sidebarBackgroundFaint, transparent)"
          zIndex="0"
        />

        {/* Header — logo, title, description, progress */}
        <VStack gap={2} position="relative" zIndex={1} flexShrink={0} align="center">
          <Image src="/logo.webp" alt="Phlox" height="40px" width="auto" />
          <Heading as="h2" size="md" color="textPrimary" textAlign="center">
            {STEP_TITLES[currentStep]}
          </Heading>
          <Text fontSize="sm" color="textSecondary" textAlign="center" maxW="420px" lineHeight="1.5">
            {STEP_DESCRIPTIONS[currentStep]}
          </Text>
          <HStack w="100%" justify="space-between" mt={1}>
            <Progress.Root
              value={((currentStepIndex + 1) / totalSteps) * 100}
              colorPalette="blue"
              borderRadius="full"
              size="sm"
              flex="1"
            >
              <Progress.Track>
                <Progress.Range />
              </Progress.Track>
            </Progress.Root>
            <Text fontSize="xs" color="textSecondary" whiteSpace="nowrap" ml={3}>
              {currentStepIndex + 1} of {totalSteps}
            </Text>
          </HStack>
        </VStack>

        {/* Content area */}
        <Box
          flex="1"
          overflowY="auto"
          position="relative"
          zIndex={1}
          className="custom-scrollbar"
          mt={4}
        >
          {renderCurrentStep()}
        </Box>

        {/* Footer */}
        <Flex
          justify="space-between"
          align="center"
          flexShrink={0}
          position="relative"
          zIndex={1}
          mt={4}
        >
          <Button
            onClick={handlePrevious}
            disabled={currentStepIndex === 0}
            variant="outline"
            size="md"
            borderRadius="2xl"
            className="switch-mode"
          >
            <FaArrowLeft />Back
          </Button>

          <Button
            onClick={handleNext}
            loading={isLoading}
            loadingText={
              currentStepIndex === totalSteps - 1
                ? "Completing setup..."
                : "Processing..."
            }
            disabled={!canProceedToNext()}
            size="md"
            borderRadius="2xl"
            className="switch-mode"
            css={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: "600",
            }}
          >
            {currentStepIndex === totalSteps - 1 ? "Start Using Phlox" : "Continue"}
            {currentStepIndex !== totalSteps - 1 && <FaArrowRight />}
          </Button>
        </Flex>
      </Box>
    </Flex>
  );
};

export default SplashScreen;
