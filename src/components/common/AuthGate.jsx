import { useState, useCallback } from "react";
import {
  Box,
  Button,
  Heading,
  HStack,
  VStack,
  Text,
  Input,
  Flex,
  Image,
  Icon,
  Alert,
} from "@chakra-ui/react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { toaster } from "@/components/ui/toaster";
import { setStoredToken } from "../../utils/helpers/apiConfig";
import { universalFetch } from "../../utils/helpers/apiHelpers";

export const AuthGate = ({ onSuccess }) => {
  const [passphrase, setPassphrase] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockMessage, setLockMessage] = useState(null);

  const handleSubmit = useCallback(async () => {
    if (passphrase.length < 1) {
      toaster.create({
        title: "Passphrase Required",
        description: "Please enter your passphrase to sign in.",
        type: "warning",
        duration: 3000,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await universalFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });

      if (response.status === 423) {
        const data = await response.json().catch(() => null);
        setLockMessage(data?.detail || "Too many failed attempts. Try again shortly.");
        return;
      }

      if (!response.ok) {
        setAttempts((n) => n + 1);
        setLockMessage(null);
        setPassphrase("");
        return;
      }

      const data = await response.json();
      setStoredToken(data.token);
      onSuccess();
    } catch {
      toaster.create({
        title: "Could Not Reach Server",
        description: "Check your connection and try again.",
        type: "error",
        duration: 6000,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [passphrase, onSuccess]);

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
      minH="100dvh"
      className="splash-bg"
      px={4}
      py={8}
      position="relative"
    >
      <Box
        className="anim-fade-slide-up panels-bg splash-panel"
        p={{ base: 6, md: 8 }}
        borderRadius="2xl"
        boxShadow="2xl"
        border="1px solid"
        borderColor="surface"
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
          bgGradient="linear(to b, sidebarBackgroundFaint, transparent)"
          borderRadius="2xl"
          zIndex="0"
        />

        <VStack gap={6} align="stretch" position="relative" zIndex="1">
          <Flex
            className="anim-fade-slide-up"
            css={{ animationDelay: "80ms" }}
            direction="column"
            align="center"
            mb={2}
          >
            <Image src="/logo.webp" alt="Phlox Logo" width="60px" mb={3} />
            <Heading
              as="h1"
              textAlign="center"
              color="textPrimary"
              css={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: ["1.5rem", "1.75rem"],
                fontWeight: "700",
                lineHeight: "1.2",
                marginBottom: "0.5rem",
              }}
            >
              Sign In
            </Heading>
            <Text
              textAlign="center"
              fontSize="sm"
              color="textSecondary"
              maxW="350px"
              lineHeight="1.6"
            >
              Enter the server passphrase to access your patient data.
            </Text>
          </Flex>

          {lockMessage && (
            <Alert.Root status="error" borderRadius="md" fontSize="sm">
              <Alert.Indicator />
              <Text fontSize="xs">{lockMessage}</Text>
            </Alert.Root>
          )}

          {attempts > 0 && !lockMessage && (
            <Alert.Root status="warning" borderRadius="md" fontSize="sm">
              <Alert.Indicator />
              <Text fontSize="xs">
                Incorrect passphrase. Please try again. ({attempts} attempt
                {attempts > 1 ? "s" : ""})
              </Text>
            </Alert.Root>
          )}

          <VStack gap={4} align="stretch">
            <Box>
              <Text mb={1} fontSize="sm" fontWeight="500" color="textPrimary">
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
                  fontWeight="400"
                  autoFocus
                  borderRadius="lg"
                  bg="surface"
                  border="1px solid"
                  borderColor="border"
                  color="textPrimary"
                  _placeholder={{ color: "textSecondary" }}
                  _focus={{
                    borderColor: "accent",
                    boxShadow: "0 0 0 1px accent",
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
            </Box>
          </VStack>

          <Button
            onClick={handleSubmit}
            loading={isSubmitting}
            loadingText="Signing in..."
            disabled={passphrase.length < 1}
            borderRadius="2xl"
            size="lg"
            className="green-button"
            css={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: "600",
            }}
            mt={2}
          >
            Sign In
          </Button>
        </VStack>
      </Box>
    </Flex>
  );
};
