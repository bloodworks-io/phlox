import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Box, Button, Heading, HStack, VStack, Text, Input, Flex, Image, Icon, Alert } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { encryptionApi } from "../../utils/api/encryptionApi";
import { resetApiConfig, isTauri } from "../../utils/helpers/apiConfig";

const EncryptionUnlock = ({ onComplete }) => {

  const { t } = useTranslation();
  const [passphrase, setPassphrase] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lastWasPassphrase, setLastWasPassphrase] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (passphrase.length < 1) {
      toaster.create({
        title: t("encryption.passphraseRequired"),
        description: t("encryption.enterToUnlock"),
        type: "warning",
        duration: 3000,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Unlock and get hex passphrase
      const hexPassphrase = await encryptionApi.unlock(passphrase);

      // Ensure the server is warmed up / still alive before sending; pm is idempotent
      try {
        await invoke("start_server_command");
      } catch (warmError) {
        console.warn(
          "start_server_command failed (will surface via send_passphrase):",
          warmError,
        );
      }

      // Send passphrase to the waiting server
      await invoke("send_passphrase_command", { passphraseHex: hexPassphrase });
      // Reset cached port so we get the new server port
      resetApiConfig();

      // Start llama and whisper services after server is up
      // They will use the ports allocated by the Python server
      try {
        await invoke("start_llama_service");
      } catch (llamaError) {
        console.warn(
          "Llama service did not start (no model downloaded yet):",
          llamaError,
        );
      }

      try {
        await invoke("start_whisper_service");
      } catch (whisperError) {
        console.warn(
          "Whisper service did not start (no model downloaded yet):",
          whisperError,
        );
      }

      try {
        await invoke("start_embedding_service");
      } catch (embeddingError) {
        console.warn(
          "Embedding service did not start (no model downloaded yet):",
          embeddingError,
        );
      }

      toaster.create({
        title: t("encryption.unlocked"),
        description: t("encryption.unlockedDesc"),
        type: "success",
        duration: 3000,
      });
      onComplete();
    } catch (error) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      const errStr = error?.toString() || "";
      const isPassphraseError =
        /wrong key|wrong encryption key|cannot decrypt database/i.test(errStr);
      setLastWasPassphrase(isPassphraseError);

      toaster.create({
        title: isPassphraseError
          ? t("encryption.incorrectPassphrase")
          : t("encryption.serverFailedTitle"),
        description: isPassphraseError
          ? t("encryption.incorrectDesc")
          : t("encryption.serverFailedDesc"),
        type: "error",
        duration: 6000,
      });

      if (isPassphraseError) {
        setPassphrase("");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [passphrase, attempts, onComplete, t]);

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
        className="anim-fade-slide-up panels-bg splash-panel"
        p={{ base: 6, md: 8 }}
        borderRadius="2xl"
        boxShadow="2xl"
        border={`1px solid ${"surface"}`}
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
          bgGradient={`linear(to b, "sidebarBackgroundFaint", transparent)`}
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
            <Image src="/logo.webp" alt={t("chat.logoAlt")} width="60px" mb={3} />
            <Heading
              as="h1"
              textAlign="center"
              color={"textPrimary"}
              css={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: ["1.5rem", "1.75rem"],
                fontWeight: "700",
                lineHeight: "1.2",
                marginBottom: "0.5rem"
              }}
            >
              {t("encryption.unlockTitle")}
            </Heading>
            <Text
              textAlign="center"
              fontSize="sm"
              color={"textSecondary"}
              maxW="350px"
              lineHeight="1.6"
            >
              {t("encryption.unlockSubtitle")}
            </Text>
          </Flex>

          {attempts > 0 && lastWasPassphrase && (
            <Alert.Root
              status="warning"
              borderRadius="md"
              fontSize="sm"
              className="anim-fade-slide-up"
              css={{ animationDuration: "0.2s" }}
            >
              <Alert.Indicator />
              <Text fontSize="xs">
                {t("encryption.incorrectAttempt", { count: attempts })}
              </Text>
            </Alert.Root>
          )}

          <VStack gap={4} align="stretch">
            <Box>
              <Text
                mb={1}
                fontSize="sm"
                fontWeight="500"
                color={"textPrimary"}
              >
                {t("encryption.passphrase")}
              </Text>
              <HStack>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={t("encryption.unlockPlaceholder")}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  onKeyPress={handleKeyPress}
                  size="md"
                  fontWeight="400"
                  autoFocus
                  borderRadius="lg"
                  bg={"surface"}
                  border={`1px solid ${"border"}`}
                  color={"textPrimary"}
                  _placeholder={{ color: "textSecondary" }}
                  _focus={{
                    borderColor: "accent",
                    boxShadow: `0 0 0 1px ${"accent"}`,
                  }}
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
          </VStack>

          <Button
            onClick={handleSubmit}
            loading={isSubmitting}
            loadingText={t("encryption.unlocking")}
            disabled={passphrase.length < 1}
            borderRadius="2xl"
            size="lg"
            className="green-button"
            css={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: "600"
            }}
            mt={2}
          >
            {t("encryption.unlock")}
          </Button>
        </VStack>
      </Box>
    </Flex>
  );
};

export default EncryptionUnlock;
