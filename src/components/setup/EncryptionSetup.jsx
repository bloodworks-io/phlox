import { useState, useCallback, useEffect } from "react";
import {
  Box,
  Button,
  Heading,
  VStack,
  useToast,
  Text,
  Input,
  Flex,
  Image,
  Progress,
  HStack,
  Icon,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import { FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import { motion } from "framer-motion";
import { colors } from "../../theme/colors";
import { encryptionApi, calculatePassphraseStrength } from "../../utils/api/encryptionApi";

const MotionBox = motion(Box);
const MotionVStack = motion(VStack);

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
      await encryptionApi.setup(passphrase);
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
      className="panels-bg"
      px={4}
      py={8}
    >
      <MotionBox
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        p={{ base: 6, md: 8 }}
        borderRadius="2xl"
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

        <VStack spacing={6} align="stretch" position="relative" zIndex="1">
          <Flex direction="column" align="center" mb={2}>
            <Box
              p={3}
              borderRadius="full"
              bg={`${currentColors.accent}20`}
              mb={3}
            >
              <Icon as={FaLock} boxSize={8} color={currentColors.accent} />
            </Box>
            <Heading
              as="h1"
              textAlign="center"
              color={currentColors.textPrimary}
              sx={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: ["1.5rem", "1.75rem"],
                fontWeight: "700",
                lineHeight: "1.2",
                marginBottom: "0.5rem",
              }}
            >
              Secure Your Data
            </Heading>
            <Text
              textAlign="center"
              fontSize="sm"
              color={currentColors.textSecondary}
              maxW="350px"
              lineHeight="1.6"
            >
              Create a passphrase to encrypt your patient data. This key will be
              used to secure your database.
            </Text>
          </Flex>

          <Alert status="info" borderRadius="md" fontSize="sm">
            <AlertIcon />
            <Text fontSize="xs">
              <strong>Important:</strong> If you forget your passphrase, your
              data cannot be recovered. Store it securely.
            </Text>
          </Alert>

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
                  fontFamily="monospace"
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
                  fontFamily="monospace"
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && isValid()) {
                      handleSubmit();
                    }
                  }}
                />
                <Button
                  size="md"
                  variant="ghost"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
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

          <Button
            onClick={handleSubmit}
            isLoading={isSubmitting}
            loadingText="Setting up encryption..."
            isDisabled={!isValid()}
            size="lg"
            className="switch-mode"
            sx={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: "600",
            }}
            mt={2}
          >
            Create Encryption Key
          </Button>
        </VStack>
      </MotionBox>
    </Flex>
  );
};

export default EncryptionSetup;
