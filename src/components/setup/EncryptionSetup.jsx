import { useState, useCallback, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Box,
  Button,
  Heading,
  VStack,
  useToast,
  useColorMode,
  Text,
  Input,
  Flex,
  Image,
  Progress,
  HStack,
  Icon,
} from "@chakra-ui/react";
import { FaEye, FaEyeSlash, FaExclamationTriangle, FaLock } from "react-icons/fa";
import { motion } from "framer-motion";
import { colors } from "../../theme/colors";
import {
  encryptionApi,
  calculatePassphraseStrength,
} from "../../utils/api/encryptionApi";
import { resetApiConfig, isTauri } from "../../utils/helpers/apiConfig";
import { isChatEnabled } from "../../utils/helpers/featureFlags";
import {
  SPLASH_STEPS,
  STEP_TITLES,
  STEP_DESCRIPTIONS,
  getStepIcon,
  containerVariants,
  itemVariants,
} from "../common/splash/constants";

const MotionBox = motion(Box);
const MotionVStack = motion(VStack);
const MotionFlex = motion(Flex);
const MotionHeading = motion(Heading);
const MotionText = motion(Text);

const EncryptionSetup = ({ onComplete }) => {
  const { colorMode } = useColorMode();
  const currentColors = colors[colorMode];
  const toast = useToast();

  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [strength, setStrength] = useState(calculatePassphraseStrength(""));

  // Calculate total steps including encryption as step 1
  const totalSteps = useMemo(() => {
    // Base steps from SplashScreen: Personal, LLM, Transcription, Templates, Letters = 5
    // Plus optional QuickChat if enabled
    // Plus encryption step = 1
    const baseSteps = 5;
    const chatSteps = isChatEnabled() ? 1 : 0;
    return 1 + baseSteps + chatSteps; // encryption + splash steps
  }, []);

  const currentStepIndex = 0; // Encryption is always step 1 (index 0)

  useEffect(() => {
    setStrength(calculatePassphraseStrength(passphrase));
  }, [passphrase]);

  const isValid = useCallback(() => {
    return (
      passphrase.length >= 12 &&
      passphrase === confirmPassphrase &&
      strength.score >= 2
    );
  }, [passphrase, confirmPassphrase, strength]);

  const handleSubmit = useCallback(async () => {
    if (!isValid()) {
      toast({
        title: "Invalid Passphrase",
        description:
          passphrase.length < 12
            ? "Passphrase must be at least 12 characters"
            : passphrase !== confirmPassphrase
              ? "Passphrases do not match"
              : "Please use a stronger passphrase",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Setup encryption and get hex passphrase
      const hexPassphrase = await encryptionApi.setup(passphrase);

      // Start the server with the hex passphrase
      try {
        await invoke("start_server_command", { passphraseHex: hexPassphrase });
        // Reset cached port so we get the new server port
        resetApiConfig();

        // Start llama and whisper services after server is up
        // They will use the ports allocated by the Python server
        try {
          await invoke("start_llama_service");
        } catch (llamaError) {
          console.warn("Llama service did not start (no model downloaded yet):", llamaError);
        }

        try {
          await invoke("start_whisper_service");
        } catch (whisperError) {
          console.warn("Whisper service did not start (no model downloaded yet):", whisperError);
        }
      } catch (serverError) {
        console.error("Server start failed:", serverError);
        toast({
          title: "Server Warning",
          description: serverError.toString(),
          status: "warning",
          duration: 5000,
          isClosable: true,
        });
      }

      toast({
        title: "Encryption Setup Complete",
        description:
          "Your encryption key has been created. Your data is now secure.",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      onComplete();
    } catch (error) {
      toast({
        title: "Setup Failed",
        description: error.toString() || "An error occurred during setup",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [passphrase, confirmPassphrase, strength, isValid, onComplete, toast]);

  const getStrengthColor = () => {
    if (strength.score <= 1) return "red";
    if (strength.score === 2) return "yellow";
    if (strength.score === 3) return "blue";
    return "green";
  };

  const getStrengthPercent = () => {
    return (strength.score / 4) * 100;
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
        w={{ base: "100%", sm: "90%", md: "500px" }}
        maxW="500px"
        position="relative"
        overflow="hidden"
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
                as={getStepIcon(SPLASH_STEPS.ENCRYPTION)}
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
                {STEP_TITLES[SPLASH_STEPS.ENCRYPTION]}
              </Heading>
            </HStack>
            <Text
              textAlign="center"
              fontSize="sm"
              color={currentColors.textSecondary}
              mb={4}
              sx={{ fontFamily: '"Roboto", sans-serif' }}
            >
              {STEP_DESCRIPTIONS[SPLASH_STEPS.ENCRYPTION]}
            </Text>
          </MotionBox>

          {/* Warning alert with better legibility */}
          <MotionBox variants={itemVariants}>
            <Box
              bg="orange.100"
              borderLeft="4px solid"
              borderColor="orange.400"
              p={3}
              borderRadius="md"
            >
              <HStack align="start">
                <Icon as={FaExclamationTriangle} color="orange.500" mt={0.5} />
                <Text color="gray.700" fontSize="sm" lineHeight="1.5">
                  <strong>Important:</strong> If you forget your passphrase, your
                  data cannot be recovered. Store it securely.
                </Text>
              </HStack>
            </Box>
          </MotionBox>

          <VStack spacing={4} align="stretch">
            <Box>
              <Text
                mb={1}
                fontSize="sm"
                fontWeight="500"
                color={currentColors.textPrimary}
              >
                Passphrase
              </Text>
              <HStack>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter a secure passphrase (min 12 characters)"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  size="md"
                  bg={currentColors.surface}
                  border={`1px solid ${currentColors.border}`}
                  color={currentColors.textPrimary}
                  _placeholder={{ color: currentColors.textSecondary }}
                  _focus={{
                    borderColor: currentColors.accent,
                    boxShadow: `0 0 0 1px ${currentColors.accent}`,
                  }}
                />
                <Button
                  size="md"
                  variant="ghost"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  <Icon as={showPassword ? FaEyeSlash : FaEye} />
                </Button>
              </HStack>

              {passphrase.length > 0 && (
                <Box mt={2}>
                  <HStack justify="space-between" mb={1}>
                    <Text fontSize="xs" color={currentColors.textSecondary}>
                      Strength
                    </Text>
                    <Text
                      fontSize="xs"
                      fontWeight="600"
                      color={currentColors[getStrengthColor()] || "gray"}
                    >
                      {strength.strength}
                    </Text>
                  </HStack>
                  <Progress
                    value={getStrengthPercent()}
                    colorScheme={getStrengthColor()}
                    size="xs"
                    borderRadius="full"
                  />
                </Box>
              )}
            </Box>

            <Box>
              <Text
                mb={1}
                fontSize="sm"
                fontWeight="500"
                color={currentColors.textPrimary}
              >
                Confirm Passphrase
              </Text>
              <HStack>
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your passphrase"
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  size="md"
                  bg={currentColors.surface}
                  border={`1px solid ${currentColors.border}`}
                  color={currentColors.textPrimary}
                  _placeholder={{ color: currentColors.textSecondary }}
                  _focus={{
                    borderColor: currentColors.accent,
                    boxShadow: `0 0 0 1px ${currentColors.accent}`,
                  }}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && isValid()) {
                      handleSubmit();
                    }
                  }}
                />
                <Button
                  size="md"
                  variant="ghost"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label="Toggle confirm password visibility"
                >
                  <Icon as={showConfirmPassword ? FaEyeSlash : FaEye} />
                </Button>
              </HStack>

              {confirmPassphrase.length > 0 &&
                passphrase !== confirmPassphrase && (
                  <Text mt={1} fontSize="xs" color="red.400">
                    Passphrases do not match
                  </Text>
                )}
            </Box>
          </VStack>

          <MotionFlex
            variants={itemVariants}
            justify="flex-end"
            align="center"
            mt={2}
          >
            <Button
              onClick={handleSubmit}
              isLoading={isSubmitting}
              loadingText="Setting up encryption..."
              isDisabled={!isValid()}
              size="md"
              borderRadius="2xl !important"
              className="switch-mode"
              sx={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: "600",
              }}
            >
              Continue
            </Button>
          </MotionFlex>
        </MotionVStack>
      </MotionBox>
    </Flex>
  );
};

export default EncryptionSetup;
