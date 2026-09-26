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
import { useTranslation } from "react-i18next";
import { toaster } from "@/components/ui/toaster";
import { setStoredToken } from "../../utils/helpers/apiConfig";
import { universalFetch } from "../../utils/helpers/apiHelpers";

// First-run admin creation. Shown only when /api/auth/status reports
// needs_setup (no real users exist yet).
export const SetupWizard = ({ onSuccess }) => {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!username || !password) {
      setError(t("setup.usernameRequired"));
      return;
    }
    if (password.length < 8) {
      setError(t("setup.passwordTooShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("setup.passwordsDoNotMatch"));
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
        setError(data?.detail || t("setup.setupFailed"));
        return;
      }
      const data = await response.json();
      setStoredToken(data.token);
      toaster.create({
        title: t("setup.welcomeToastTitle"),
        description: t("setup.welcomeToastDescription"),
        type: "success",
        duration: 5000,
      });
      onSuccess();
    } catch {
      setError(t("setup.couldNotReachServer"));
    } finally {
      setIsSubmitting(false);
    }
  }, [username, password, confirm, onSuccess, t]);

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
              {t("setup.welcome")}
            </Heading>
            <Text
              textAlign="center"
              fontSize="sm"
              color="textSecondary"
              maxW="380px"
              lineHeight="1.6"
            >
              {t("setup.intro")}
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
                {t("setup.adminUsername")}
              </Text>
              <Input
                type="text"
                placeholder={t("setup.usernamePlaceholder")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                {...inputProps}
              />
            </Box>
            <Box>
              <Text mb={1} fontSize="sm" fontWeight="500" color="textPrimary">
                {t("common.password")}
              </Text>
              <HStack>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={t("setup.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  {...inputProps}
                />
                <Button
                  size="md"
                  variant="ghost"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={t("common.togglePasswordVisibility")}
                >
                  <Icon as={showPassword ? FaEyeSlash : FaEye} />
                </Button>
              </HStack>
            </Box>
            <Box>
              <Text mb={1} fontSize="sm" fontWeight="500" color="textPrimary">
                {t("setup.confirmPassword")}
              </Text>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder={t("setup.confirmPasswordPlaceholder")}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                {...inputProps}
              />
            </Box>
          </VStack>

          <Button
            onClick={handleSubmit}
            loading={isSubmitting}
            loadingText={t("setup.creatingAccount")}
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
            {t("setup.createAdminAccount")}
          </Button>
        </VStack>
      </Box>
    </Flex>
  );
};
