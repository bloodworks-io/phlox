import { useState, useCallback, useMemo } from "react";
import {
  Box,
  Button,
  Heading,
  VStack,
  useToast,
  Text,
  Flex,
  Image,
  useColorMode,
  HStack,
  Icon,
  Progress,
  Badge,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { FaArrowRight, FaArrowLeft, FaCheckCircle } from "react-icons/fa";
import { colors } from "../../theme/colors";
import { settingsService } from "../../utils/settings/settingsUtils";
import { isTauri } from "../../utils/helpers/apiConfig";
import { isChatEnabled } from "../../utils/helpers/featureFlags";
import {
  SPLASH_STEPS,
  STEP_TITLES,
  STEP_DESCRIPTIONS,
  getStepIcon,
  containerVariants,
  itemVariants,
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

const MotionBox = motion(Box);
const MotionVStack = motion(VStack);
const MotionFlex = motion(Flex);
const MotionHeading = motion(Heading);
const MotionText = motion(Text);

const SplashScreen = ({ onComplete }) => {
  const { colorMode } = useColorMode();
  const currentColors = colors[colorMode];
  const toast = useToast();

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
      toast({
        title: "Missing Information",
        description: getValidationMessage(),
        status: "warning",
        duration: 3000,
        isClosable: true,
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
      toast({
        title: "Setup Complete!",
        description:
          "Your initial settings have been saved. You can change any of these settings later in the Settings panel.",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      onComplete();
    } catch (error) {
      toast({
        title: "Error Saving Settings",
        description: error.message || "An unexpected error occurred.",
        status: "error",
        duration: 5000,
        isClosable: true,
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
        return <PersonalStep currentColors={currentColors} {...personal} />;
      case SPLASH_STEPS.LLM:
        return <LLMStep currentColors={currentColors} {...llm} />;
      case SPLASH_STEPS.TRANSCRIPTION:
        return (
          <TranscriptionStep
            currentColors={currentColors}
            inferenceMode={llm.inferenceMode}
            {...transcription}
          />
        );
      case SPLASH_STEPS.TEMPLATES:
        return <TemplatesStep currentColors={currentColors} {...templates} />;
      case SPLASH_STEPS.QUICK_CHAT:
        return <QuickChatStep currentColors={currentColors} {...quickChat} />;
      case SPLASH_STEPS.LETTERS:
        return <LettersStep currentColors={currentColors} {...letters} />;
      default:
        return null;
    }
  };

  return (
    <Flex
      align="center"
      justify="center"
      minH="100vh"
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

      <MotionBox
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        p={{ base: 6, md: 8 }}
        borderRadius="2xl !important"
        boxShadow="2xl"
        className="panels-bg"
        border={`1px solid ${currentColors.surface}`}
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
          bgGradient={`linear(to b, ${currentColors.sidebar.background}15, transparent)`}
          borderRadius="2xl"
          zIndex="0"
        />

        <MotionVStack
          spacing={6}
          align="stretch"
          position="relative"
          zIndex="1"
        >
          <MotionFlex
            variants={itemVariants}
            direction="column"
            align="center"
            mb={4}
          >
            <Image src="/logo.webp" alt="Phlox Logo" width="60px" mb={3} />
            <MotionHeading
              as="h1"
              textAlign="center"
              color={currentColors.textPrimary}
              sx={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: ["1.5rem", "1.75rem"],
                fontWeight: "700",
                lineHeight: "1.2",
                marginBottom: "0.5rem",
                letterSpacing: "-0.02em",
              }}
            >
              Welcome to Phlox
            </MotionHeading>
            <MotionText
              textAlign="center"
              fontSize="sm"
              color={currentColors.textSecondary}
              maxW="400px"
              lineHeight="1.6"
              sx={{ fontFamily: '"Roboto", sans-serif' }}
            >
              Let's set up your AI-powered medical assistant
            </MotionText>
          </MotionFlex>

          <MotionBox variants={itemVariants}>
            <Progress
              value={((currentStepIndex + 1) / totalSteps) * 100}
              colorScheme="blue"
              borderRadius="full"
              size="sm"
              mb={2}
            />
            <Text
              fontSize="xs"
              color={currentColors.textSecondary}
              textAlign="center"
              sx={{ fontFamily: '"Roboto", sans-serif' }}
            >
              Step {currentStepIndex + 1} of {totalSteps}
            </Text>
          </MotionBox>

          <MotionBox variants={itemVariants}>
            <HStack mb={4} align="center" justify="center">
              <Icon
                as={getStepIcon(currentStep)}
                className="pill-box-icons"
                boxSize={5}
              />
              <Heading
                as="h2"
                color={currentColors.textPrimary}
                sx={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontSize: ["1.25rem", "1.5rem"],
                  fontWeight: "600",
                  lineHeight: "1.2",
                }}
              >
                {STEP_TITLES[currentStep]}
              </Heading>
              {completedSteps.has(currentStep) && (
                <Badge colorScheme="green" variant="solid">
                  <Icon as={FaCheckCircle} mr={1} />
                  Complete
                </Badge>
              )}
            </HStack>
            <Text
              textAlign="center"
              fontSize="sm"
              color={currentColors.textSecondary}
              mb={6}
              sx={{ fontFamily: '"Roboto", sans-serif' }}
            >
              {STEP_DESCRIPTIONS[currentStep]}
            </Text>
          </MotionBox>

          <Box>{renderCurrentStep()}</Box>

          <MotionFlex
            variants={itemVariants}
            justify="space-between"
            align="center"
            mt={6}
          >
            <Button
              leftIcon={<FaArrowLeft />}
              onClick={handlePrevious}
              isDisabled={currentStepIndex === 0}
              variant="outline"
              size="md"
              borderRadius="2xl !important"
              className="switch-mode"
            >
              Previous
            </Button>

            <Button
              rightIcon={
                currentStepIndex === totalSteps - 1 ? undefined : (
                  <FaArrowRight />
                )
              }
              onClick={handleNext}
              isLoading={isLoading}
              loadingText={
                currentStepIndex === totalSteps - 1
                  ? "Completing setup..."
                  : "Processing..."
              }
              isDisabled={!canProceedToNext()}
              size="md"
              borderRadius="2xl !important"
              className="switch-mode"
              sx={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: "600",
              }}
            >
              {currentStepIndex === totalSteps - 1 ? "Complete Setup" : "Next"}
            </Button>
          </MotionFlex>
        </MotionVStack>
      </MotionBox>
    </Flex>
  );
};

export default SplashScreen;
