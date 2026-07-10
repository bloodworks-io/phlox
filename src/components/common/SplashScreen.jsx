import { useState, useCallback, useMemo } from "react";
import { Box, Button, Heading, VStack, Text, Flex, Image, HStack, Icon, Progress, Badge } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
const toast = toaster.create;
import { FaArrowRight, FaArrowLeft, FaCheckCircle } from "react-icons/fa";
import { settingsService } from "../../utils/settings/settingsUtils";
import { isTauri } from "../../utils/helpers/apiConfig";
import { isChatEnabled } from "../../utils/helpers/featureFlags";
import {
  SPLASH_STEPS,
  STEP_TITLES,
  STEP_DESCRIPTIONS,
  getStepIcon,
} from "./splash/constants";
import { usePersonalStep, PersonalStep } from "./splash/steps/PersonalStep";
import { useLLMStep, LLMStep } from "./splash/steps/LLMStep";
import {
  useTranscriptionStep,
  TranscriptionStep,
} from "./splash/steps/TranscriptionStep";
import { useTemplatesStep, TemplatesStep } from "./splash/steps/TemplatesStep";
import { useQuickChatStep, QuickChatStep } from "./splash/steps/QuickChatStep";
import { useLettersStep, LettersStep } from "./splash/steps/LettersStep";

const SplashScreen = ({ onComplete }) => {

  // Step management
  const [currentStep, setCurrentStep] = useState(SPLASH_STEPS.PERSONAL);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Determine which steps are visible based on chat enabled status
  const visibleSteps = useMemo(() => {
    const steps = [
      SPLASH_STEPS.PERSONAL,
      SPLASH_STEPS.LLM,
      SPLASH_STEPS.TRANSCRIPTION,
      SPLASH_STEPS.TEMPLATES,
    ];
    if (isChatEnabled()) {
      steps.push(SPLASH_STEPS.QUICK_CHAT);
    }
    steps.push(SPLASH_STEPS.LETTERS);
    return steps;
  }, []);

  // Total steps includes encryption step in Tauri (which runs before this screen)
  const totalSteps = visibleSteps.length + (isTauri() ? 1 : 0); // +1 for encryption step in Tauri
  const actualStepIndex = visibleSteps.indexOf(currentStep); // 0-based index for array navigation
  const currentStepIndex = actualStepIndex + (isTauri() ? 1 : 0); // Account for encryption being step 1 in Tauri

  // Step hooks
  const personal = usePersonalStep();
  const llm = useLLMStep(currentStep);
  // Pass inferenceMode to transcription step to ensure no mixed configurations
  const transcription = useTranscriptionStep(currentStep, llm.inferenceMode);
  const templates = useTemplatesStep(currentStep);
  const quickChat = useQuickChatStep();
  const letters = useLettersStep(currentStep);

  // Get current validator
  const getCurrentValidator = () => {
    switch (currentStep) {
      case SPLASH_STEPS.PERSONAL:
        return personal.validate;
      case SPLASH_STEPS.LLM:
        return llm.validate;
      case SPLASH_STEPS.TRANSCRIPTION:
        return transcription.validate;
      case SPLASH_STEPS.TEMPLATES:
        return templates.validate;
      case SPLASH_STEPS.QUICK_CHAT:
        return quickChat.validate;
      case SPLASH_STEPS.LETTERS:
        return letters.validate;
      default:
        return () => false;
    }
  };

  // Get validation message
  const getValidationMessage = () => {
    switch (currentStep) {
      case SPLASH_STEPS.PERSONAL:
        return "Please enter your name and select your specialty.";
      case SPLASH_STEPS.LLM:
        // Dynamic message based on inference mode
        if (llm.inferenceMode === "local") {
          return "Please select and download a local model before proceeding.";
        }
        return "Please select a primary model.";
      case SPLASH_STEPS.TRANSCRIPTION:
        return "Please configure the Whisper model if you've entered a URL.";
      case SPLASH_STEPS.TEMPLATES:
        return "Please select a default template.";
      case SPLASH_STEPS.QUICK_CHAT:
        return "Please fill in all quick chat button titles and prompts.";
      case SPLASH_STEPS.LETTERS:
        return "Please select a default letter template.";
      default:
        return "Please complete all required fields.";
    }
  };

  const handleNext = useCallback(() => {
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

    setCompletedSteps((prev) => new Set([...prev, currentStep]));

    const nextIndex = actualStepIndex + 1;
    if (nextIndex < visibleSteps.length) {
      setCurrentStep(visibleSteps[nextIndex]);
    } else {
      handleComplete();
    }
  }, [currentStep, actualStepIndex, visibleSteps, getCurrentValidator, getValidationMessage, toast]);

  const handlePrevious = useCallback(() => {
    const prevIndex = actualStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(visibleSteps[prevIndex]);
    }
  }, [actualStepIndex, visibleSteps]);

  const handleComplete = useCallback(async () => {
    setIsLoading(true);
    try {
      // Save user settings
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

      // Only include quick chat data if chat is enabled
      if (isChatEnabled()) {
        const quickChatData = quickChat.getData();
        Object.assign(userSettingsToSave, quickChatData);
      }
      await settingsService.saveUserSettings(userSettingsToSave);

      // Save global config
      const currentGlobalConfig = await settingsService.fetchConfig();
      const configToSave = {
        ...currentGlobalConfig,
        LLM_PROVIDER: llmData.llmProvider,
        LLM_BASE_URL: llmData.llmBaseUrl,
        PRIMARY_MODEL: llmData.primaryModel,
        WHISPER_BASE_URL: transcriptionData.whisperBaseUrl,
        WHISPER_MODEL: transcriptionData.whisperModel,
      };

      if (settingsService.saveGlobalConfig) {
        await settingsService.saveGlobalConfig(configToSave);
      } else {
        console.warn(
          "settingsService.saveGlobalConfig is not defined, falling back to updateConfig.",
        );
        await settingsService.updateConfig(configToSave);
      }

      // Set default template
      if (templatesData.selectedTemplate) {
        await settingsService.setDefaultTemplate(
          templatesData.selectedTemplate,
          toast,
        );
      }

      await settingsService.markSplashCompleted();
      toaster.create({
        title: "Setup Complete!",
        description:
          "Your initial settings have been saved. You can change any of these settings later in the Settings panel.",
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
  }, [
    personal,
    llm,
    transcription,
    templates,
    quickChat,
    letters,
    onComplete,
    toast,
  ]);

  const canProceedToNext = () => {
    return getCurrentValidator()();
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case SPLASH_STEPS.PERSONAL:
        return <PersonalStep {...personal} />;
      case SPLASH_STEPS.LLM:
        return <LLMStep {...llm} />;
      case SPLASH_STEPS.TRANSCRIPTION:
        return (
          <TranscriptionStep
            inferenceMode={llm.inferenceMode}
            {...transcription}
          />
        );
      case SPLASH_STEPS.TEMPLATES:
        return <TemplatesStep {...templates} />;
      case SPLASH_STEPS.QUICK_CHAT:
        return <QuickChatStep {...quickChat} />;
      case SPLASH_STEPS.LETTERS:
        return <LettersStep {...letters} />;
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
      {/* Tauri titlebar drag region - full window width */}
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
        className="anim-fade-scale panels-bg"
        p={{ base: 6, md: 8 }}
        borderRadius="2xl"
        boxShadow="2xl"
        border={`1px solid ${"surface"}`}
        w={{ base: "100%", sm: "90%", md: "700px" }}
        maxW="700px"
        position="relative"
        overflow="hidden"
        maxH="90vh"
        overflowY="auto"
      >
        <Box
          position="absolute"
          top="0"
          left="0"
          right="0"
          height="120px"
          bgGradient={`linear(to b, "sidebarBackgroundFaint", transparent)`}
          borderRadius="2xl"
          zIndex="0"
        />

        <VStack
          gap={6}
          align="stretch"
          position="relative"
          zIndex="1"
          className="anim-stagger"
        >
          <Flex
            direction="column"
            align="center"
            mb={4}
          >
            <Image src="/logo.webp" alt="Phlox Logo" width="60px" mb={3} />
            <Heading
              as="h1"
              textAlign="center"
              color={"textPrimary"}
            >
              Welcome to Phlox
            </Heading>
            <Text
              textAlign="center"
              fontSize="sm"
              color={"textSecondary"}
              maxW="400px"
              lineHeight="1.6"
              css={{
                fontFamily: '"Roboto", sans-serif'
              }}
            >
              Let's set up your AI-powered medical assistant
            </Text>
          </Flex>

          <Box>
            <Progress.Root
              value={((currentStepIndex + 1) / totalSteps) * 100}
              colorPalette="blue"
              borderRadius="full"
              size="sm"
              mb={2}>
              <Progress.Track>
                <Progress.Range />
              </Progress.Track>
            </Progress.Root>
            <Text
              fontSize="xs"
              color={"textSecondary"}
              textAlign="center"
              css={{
                fontFamily: '"Roboto", sans-serif'
              }}
            >
              Step {currentStepIndex + 1} of {totalSteps}
            </Text>
          </Box>

          <Box>
            <HStack mb={4} align="center" justify="center">
              <Icon
                as={getStepIcon(currentStep)}
                className="pill-box-icons"
                boxSize={5}
              />
              <Heading
                as="h2"
                color={"textPrimary"}
              >
                {STEP_TITLES[currentStep]}
              </Heading>
              {completedSteps.has(currentStep) && (
                <Badge colorPalette="green" variant="solid">
                  <Icon as={FaCheckCircle} mr={1} />
                  Complete
                </Badge>
              )}
            </HStack>
            <Text
              textAlign="center"
              fontSize="sm"
              color={"textSecondary"}
              mb={6}
              css={{
                fontFamily: '"Roboto", sans-serif'
              }}
            >
              {STEP_DESCRIPTIONS[currentStep]}
            </Text>
          </Box>

          <Box>{renderCurrentStep()}</Box>

          <Flex
            justify="space-between"
            align="center"
            mt={6}
          >
            <Button
              onClick={handlePrevious}
              disabled={currentStepIndex === 0}
              variant="outline"
              size="md"
              borderRadius="2xl"
              className="switch-mode"><FaArrowLeft />Previous
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
                fontWeight: "600"
              }}>{currentStepIndex === totalSteps - 1 ? "Complete Setup" : "Next"}{
                currentStepIndex === totalSteps - 1 ? undefined : (
                  <FaArrowRight />
                )
              }</Button>
          </Flex>
        </VStack>
      </Box>
    </Flex>
  );
};

export default SplashScreen;
