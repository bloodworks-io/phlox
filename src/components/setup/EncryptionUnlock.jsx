import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Box,
  Button,
  Heading,
  HStack,
  VStack,
  useToast,
  useColorMode,
  Text,
  Input,
  Flex,
  Icon,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import { FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import { motion } from "framer-motion";
import { colors } from "../../theme/colors";
import { encryptionApi } from "../../utils/api/encryptionApi";

const MotionBox = motion(Box);
const MotionVStack = motion(VStack);

const EncryptionUnlock = ({ onComplete }) => {
  const { colorMode } = useColorMode();
  const currentColors = colors[colorMode];
  const toast = useToast();

  const [passphrase, setPassphrase] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handleSubmit = useCallback(async () => {
    if (passphrase.length < 1) {
      toast({
        title: "Passphrase Required",
        description: "Please enter your passphrase to unlock.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Unlock and get hex passphrase
      const hexPassphrase = await encryptionApi.unlock(passphrase);

      // Start the server with the hex passphrase
      try {
        await invoke("start_server_command", { passphraseHex: hexPassphrase });
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
        title: "Unlocked",
        description: "Your database has been unlocked successfully.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      onComplete();
    } catch (error) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      toast({
        title: "Incorrect Passphrase",
        description:
          "The passphrase you entered is incorrect. Please try again.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      setPassphrase("");
    } finally {
      setIsSubmitting(false);
    }
  }, [passphrase, attempts, onComplete, toast]);

  const handleKeyPress = useCallback(
    (e) => {
      if (e.key === "Enter" && passphrase.length > 0) {
        handleSubmit();
      }
    },
    [passphrase, handleSubmit],
  );

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
        w={{ base: "100%", sm: "90%", md: "450px" }}
        maxW="450px"
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
              <Icon as={FaLock} boxSize={7} color={currentColors.accent} />
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
              Unlock Your Data
            </Heading>
            <Text
              textAlign="center"
              fontSize="sm"
              color={currentColors.textSecondary}
              maxW="350px"
              lineHeight="1.6"
            >
              Enter your passphrase to decrypt and access your patient data.
            </Text>
          </Flex>

          {attempts > 0 && (
            <Alert status="warning" borderRadius="md" fontSize="sm">
              <AlertIcon />
              <Text fontSize="xs">
                Incorrect passphrase. Please try again. ({attempts} attempt
                {attempts > 1 ? "s" : ""})
              </Text>
            </Alert>
          )}

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
                  placeholder="Enter your passphrase"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  onKeyPress={handleKeyPress}
                  size="md"
                  autoFocus
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
            </Box>
          </VStack>

          <Button
            onClick={handleSubmit}
            isLoading={isSubmitting}
            loadingText="Unlocking..."
            isDisabled={passphrase.length < 1}
            size="lg"
            className="switch-mode"
            sx={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: "600",
            }}
            mt={2}
          >
            Unlock
          </Button>
        </VStack>
      </MotionBox>
    </Flex>
  );
};

export default EncryptionUnlock;
