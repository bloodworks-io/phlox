import { useState, useCallback } from "react";
import {
  Alert,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  Image,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { toaster } from "@/components/ui/toaster";
import { setStoredToken } from "../../utils/helpers/apiConfig";
import { universalFetch } from "../../utils/helpers/apiHelpers";

// First-run admin creation. Shown only when /api/auth/status reports
// needs_setup (no real users exist yet).
export const SetupWizard = ({ onSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!username || !password) {
      setError("Username and password are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters (12+ recommended).");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await universalFetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.detail || "Setup failed. Please try again.");
        return;
      }
      const data = await response.json();
      setStoredToken(data.token);
      toaster.create({
        title: "Welcome to Phlox",
        description: "Admin account created. You are signed in.",
        type: "success",
        duration: 5000,
      });
      onSuccess();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [username, password, confirm, onSuccess]);

  const inputProps = {
    size: "md",
    borderRadius: "lg",
    bg: "surface",
    border: "1px solid",
    borderColor: "border",
    color: "textPrimary",
    _placeholder: { color: "textSecondary" },
    _focus: { borderColor: "accent", boxShadow: "0 0 0 1px accent" },
  };

  return (
    <Flex
      align="center"
      justify="center"
      minH="100dvh"
      className="splash-bg"
      px={4}
      py={8}
    >
      <Box
        className="anim-fade-slide-up panels-bg splash-panel"
        p={{ base: 6, md: 8 }}
        borderRadius="2xl"
        boxShadow="2xl"
        border="1px solid"
        borderColor="surface"
        w={{ base: "100%", sm: "90%", md: "480px" }}
        maxW="480px"
      >
        <VStack gap={6} align="stretch">
          <Flex direction="column" align="center" mb={2}>
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
              Welcome
            </Heading>
            <Text
              textAlign="center"
              fontSize="sm"
              color="textSecondary"
              maxW="380px"
              lineHeight="1.6"
            >
              Create the administrator account for this Phlox instance. All
              existing data will be attached to this account.
            </Text>
          </Flex>

          {error && (
            <Alert.Root status="error" borderRadius="md" fontSize="sm">
              <Alert.Indicator />
              <Text fontSize="xs">{error}</Text>
            </Alert.Root>
          )}

          <VStack gap={4} align="stretch">
            <Box>
              <Text mb={1} fontSize="sm" fontWeight="500" color="textPrimary">
                Administrator username
              </Text>
              <Input
                type="text"
                placeholder="e.g. drsmith"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                {...inputProps}
              />
            </Box>
            <Box>
              <Text mb={1} fontSize="sm" fontWeight="500" color="textPrimary">
                Password
              </Text>
              <HStack>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  {...inputProps}
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
            <Box>
              <Text mb={1} fontSize="sm" fontWeight="500" color="textPrimary">
                Confirm password
              </Text>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Repeat your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                {...inputProps}
              />
            </Box>
          </VStack>

          <Button
            onClick={handleSubmit}
            loading={isSubmitting}
            loadingText="Creating account..."
            disabled={!username || !password || !confirm}
            borderRadius="2xl"
            size="lg"
            className="green-button"
            css={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: "600",
            }}
            mt={2}
          >
            Create Admin Account
          </Button>
        </VStack>
      </Box>
    </Flex>
  );
};
