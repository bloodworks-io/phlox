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
  Alert,
} from "@chakra-ui/react";
import { LuEye, LuEyeOff } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { toaster } from "@/components/ui/toaster";
import { setStoredToken } from "../../utils/helpers/apiConfig";
import { universalFetch } from "../../utils/helpers/apiHelpers";

export const AuthGate = ({ onSuccess }) => {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockMessage, setLockMessage] = useState(null);

  const handleSubmit = useCallback(async () => {
    if (username.length < 1 || password.length < 1) {
      toaster.create({
        title: t("auth.credentialsRequired"),
        description: t("auth.credentialsRequiredDescription"),
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
        body: JSON.stringify({ username, password }),
      });

      if (response.status === 423) {
        const data = await response.json().catch(() => null);
        setLockMessage(data?.detail || t("auth.tooManyAttempts"));
        return;
      }

      if (!response.ok) {
        setAttempts((n) => n + 1);
        setLockMessage(null);
        setPassword("");
        return;
      }

      const data = await response.json();
      setStoredToken(data.token);
      onSuccess();
    } catch {
      toaster.create({
        title: t("auth.couldNotReachServer"),
        description: t("auth.couldNotReachServerDescription"),
        type: "error",
        duration: 6000,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [username, password, onSuccess, t]);

  const handleKeyPress = useCallback(
    (e) => {
      if (e.key === "Enter" && username.length > 0 && password.length > 0) {
        handleSubmit();
      }
    },
    [username, password, handleSubmit],
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
        className="anim-fade-slide-up splash-panel"
        p={{ base: 6, md: 8 }}
        w={{ base: "100%", sm: "90%", md: "450px" }}
        maxW="450px"
        position="relative"
        overflow="hidden"
      >
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
              color="folio.ink"
              css={{
                fontSize: ["1.5rem", "1.75rem"],
                fontWeight: "700",
                lineHeight: "1.2",
                marginBottom: "0.5rem",
              }}
            >
              {t("auth.signIn")}
            </Heading>
            <Text
              textAlign="center"
              fontSize="sm"
              color="folio.ink"
              maxW="350px"
              lineHeight="1.6"
            >
              {t("auth.signInSubtitle")}
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
                {t("auth.attemptsWarning", { count: attempts })}
              </Text>
            </Alert.Root>
          )}

          <VStack gap={4} align="stretch">
            <Box>
              <Text mb={1} fontSize="sm" fontWeight="500" color="folio.ink">
                {t("auth.username")}
              </Text>
              <Input
                type="text"
                placeholder={t("auth.usernamePlaceholder")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={handleKeyPress}
                size="md"
                fontWeight="400"
                autoFocus
              />
            </Box>
            <Box>
              <Text mb={1} fontSize="sm" fontWeight="500" color="folio.ink">
                {t("common.password")}
              </Text>
              <HStack>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  size="md"
                  fontWeight="400"
                />
                <Button
                  size="md"
                  variant="ghost"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={t("common.togglePasswordVisibility")}
                >
                  {showPassword
                    ? <LuEyeOff strokeWidth={1.6} />
                    : <LuEye strokeWidth={1.6} />}
                </Button>
              </HStack>
            </Box>
          </VStack>

          <Button
            onClick={handleSubmit}
            loading={isSubmitting}
            loadingText={t("auth.signingIn")}
            disabled={username.length < 1 || password.length < 1}
            size="lg"
            variant="folioPrimary"
            mt={2}
          >
            {t("auth.signIn")}
          </Button>
        </VStack>
      </Box>
    </Flex>
  );
};
