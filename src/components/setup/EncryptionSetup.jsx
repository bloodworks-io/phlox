import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Box, Button, Heading, VStack, Text, Input, Flex, Image, Progress, HStack, Icon, Alert } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
const toast = toaster.create;
import { FaEye, FaEyeSlash } from "react-icons/fa";
import {
  encryptionApi,
  calculatePassphraseStrength,
} from "../../utils/api/encryptionApi";
import { resetApiConfig, isTauri } from "../../utils/helpers/apiConfig";
import {
  SPLASH_STEPS,
  STEP_TITLES,
  STEP_DESCRIPTIONS,
} from "../common/splash/constants";

const EncryptionSetup = ({ onComplete }) => {

  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [strength, setStrength] = useState(calculatePassphraseStrength(""));

  // Encryption + 3 splash steps (About You, Templates, AI Models)
  const totalSteps = 4;

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
      toaster.create({
        title: "Invalid Passphrase",
        description:
          passphrase.length < 12
            ? "Passphrase must be at least 12 characters"
            : passphrase !== confirmPassphrase
              ? "Passphrases do not match"
              : "Please use a stronger passphrase",
        type: "warning",
        duration: 3000,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Setup encryption and get hex passphrase
      const hexPassphrase = await encryptionApi.setup(passphrase);

      // Start the server (in warm mode) and then send the passphrase
      try {
        await invoke("start_server_command");
        await invoke("send_passphrase_command", { passphraseHex: hexPassphrase });
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

        try {
          await invoke("start_embedding_service");
        } catch (embeddingError) {
          console.warn("Embedding service did not start (no model downloaded yet):", embeddingError);
        }
      } catch (serverError) {
        console.error("Server start failed:", serverError);
        toaster.create({
          title: "Server Warning",
          description: serverError.toString(),
          type: "warning",
          duration: 5000,
        });
      }

      toaster.create({
        title: "Encryption Setup Complete",
        description:
          "Your encryption key has been created. Your data is now secure.",
        type: "success",
        duration: 5000,
      });
      onComplete();
    } catch (error) {
      toaster.create({
        title: "Setup Failed",
        description: error.toString() || "An error occurred during setup",
        type: "error",
        duration: 5000,
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

        <VStack gap={2} position="relative" zIndex={1} flexShrink={0} align="center">
          <Image src="/logo.webp" alt="Phlox" height="40px" width="auto" />
          <Heading as="h2" size="md" color="textPrimary" textAlign="center">
            {STEP_TITLES[SPLASH_STEPS.ENCRYPTION]}
          </Heading>
          <Text fontSize="sm" color="textSecondary" textAlign="center" maxW="420px" lineHeight="1.5">
            {STEP_DESCRIPTIONS[SPLASH_STEPS.ENCRYPTION]}
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

        {/* Content area — scrolls independently */}
        <Box
          flex="1"
          overflowY="auto"
          minH="340px"
          position="relative"
          zIndex={1}
          className="custom-scrollbar"
        >
          <Alert.Root status="warning" borderRadius="md">
            <Alert.Indicator />
            <Box>
              <Alert.Description>
                If you forget your passphrase, your data cannot be recovered.
              </Alert.Description>
            </Box>
          </Alert.Root>

          <VStack gap={4} align="stretch" mt={4}>
            <Box>
              <Text mb={1} fontSize="sm" fontWeight="500" color="textPrimary">
                Passphrase
              </Text>
              <HStack>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter a secure passphrase (min 12 characters)"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  size="sm"
                  className="input-style"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  <Icon asChild>{showPassword ? <FaEyeSlash /> : <FaEye />}</Icon>
                </Button>
              </HStack>

              {passphrase.length > 0 && (
                <Box mt={2}>
                  <HStack justify="space-between" mb={1}>
                    <Text fontSize="xs" color="textSecondary">
                      Strength
                    </Text>
                    <Text
                      fontSize="xs"
                      fontWeight="600"
                      color={getStrengthColor() + ".400"}
                    >
                      {strength.strength}
                    </Text>
                  </HStack>
                  <Progress.Root
                    value={getStrengthPercent()}
                    colorPalette={getStrengthColor()}
                    size="xs"
                    borderRadius="full"
                  >
                    <Progress.Track>
                      <Progress.Range />
                    </Progress.Track>
                  </Progress.Root>
                </Box>
              )}
            </Box>

            <Box>
              <Text mb={1} fontSize="sm" fontWeight="500" color="textPrimary">
                Confirm Passphrase
              </Text>
              <HStack>
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your passphrase"
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  size="sm"
                  className="input-style"
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && isValid()) {
                      handleSubmit();
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label="Toggle confirm password visibility"
                >
                  <Icon asChild>
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </Icon>
                </Button>
              </HStack>

              {confirmPassphrase.length > 0 &&
                passphrase !== confirmPassphrase && (
                  <Text mt={1} fontSize="xs" color="dangerButton">
                    Passphrases do not match
                  </Text>
                )}
            </Box>
          </VStack>
        </Box>

        {/* Footer */}
        <Flex
          justify="flex-end"
          align="center"
          flexShrink={0}
          position="relative"
          zIndex={1}
          pt={4}
        >
          <Button
            onClick={handleSubmit}
            loading={isSubmitting}
            loadingText="Setting up encryption..."
            disabled={!isValid()}
            size="md"
            borderRadius="2xl"
            className="switch-mode"
            css={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: "600",
            }}
          >
            Continue
          </Button>
        </Flex>
      </Box>
    </Flex>
  );
};

export default EncryptionSetup;
