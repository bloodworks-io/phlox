import { useState, useCallback } from "react";
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

  // Step hooks
  const personal = usePersonalStep();
  const llm = useLLMStep(currentStep);
  const transcription = useTranscriptionStep(currentStep);
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

    if (currentStep < SPLASH_STEPS.LETTERS) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, getCurrentValidator, getValidationMessage, toast]);

  const handlePrevious = useCallback(() => {
    if (currentStep > SPLASH_STEPS.PERSONAL) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

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
      const quickChatData = quickChat.getData();
      const lettersData = letters.getData();

      const userSettingsToSave = {
        ...currentUserSettings,
        ...personalData,
        ...quickChatData,
        default_letter_template_id: lettersData.selectedLetterTemplate
          ? parseInt(lettersData.selectedLetterTemplate)
          : null,
      };
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
          <TranscriptionStep currentColors={currentColors} {...transcription} />
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
      className="panels-bg"
      px={4}
      py={8}
    >
      <MotionBox
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        p={{ base: 6, md: 8 }}
        borderRadius="2xl"
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
              value={((currentStep + 1) / 6) * 100}
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
              Step {currentStep + 1} of 6
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
              isDisabled={currentStep === SPLASH_STEPS.PERSONAL}
              variant="outline"
              size="md"
              className="secondary-button"
            >
              Previous
            </Button>

            <Button
              rightIcon={
                currentStep === SPLASH_STEPS.LETTERS ? undefined : (
                  <FaArrowRight />
                )
              }
              onClick={handleNext}
              isLoading={isLoading}
              loadingText={
                currentStep === SPLASH_STEPS.LETTERS
                  ? "Completing setup..."
                  : "Processing..."
              }
              isDisabled={!canProceedToNext()}
              size="md"
              className="switch-mode"
              sx={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: "600",
              }}
            >
              {currentStep === SPLASH_STEPS.LETTERS ? "Complete Setup" : "Next"}
            </Button>
          </MotionFlex>
        </MotionVStack>
      </MotionBox>
    </Flex>
  );
};

export default SplashScreen;
