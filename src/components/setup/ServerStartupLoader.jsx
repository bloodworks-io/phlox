import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, Heading, VStack, Text, Flex, Spinner, Icon } from "@chakra-ui/react";
import { FaServer } from "react-icons/fa";
import { settingsApi } from "../../utils/api/settingsApi";
import { isTauri } from "../../utils/helpers/apiConfig";

const LOADING_MESSAGES = [
  "setup.serverStartup.loading1",
  "setup.serverStartup.loading2",
  "setup.serverStartup.loading3",
  "setup.serverStartup.loading4",
  "setup.serverStartup.loading5",
  "setup.serverStartup.loading6",
  "setup.serverStartup.loading7",
  "setup.serverStartup.loading8",
  "setup.serverStartup.loading9",
  "setup.serverStartup.loading10",
  "setup.serverStartup.loading11",
  "setup.serverStartup.loading12",
  "setup.serverStartup.loading13",
  "setup.serverStartup.loading14",
  "setup.serverStartup.loading15",
];

const POLL_INTERVAL = 2000; // ms - increased to reduce CPU load
const TIMEOUT = 60000; // 60 seconds - increased for slower systems

const ServerStartupLoader = ({ onReady, onError }) => {

  const { t } = useTranslation();
  const [messageIndex, setMessageIndex] = useState(0);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [shouldPoll, setShouldPoll] = useState(true);

  // Store callbacks and state in refs to avoid dependency issues
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const shouldPollRef = useRef(shouldPoll);
  const isTimedOutRef = useRef(isTimedOut);

  // Keep refs in sync with state
  useEffect(() => {
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
    shouldPollRef.current = shouldPoll;
    isTimedOutRef.current = isTimedOut;
  }, [onReady, onError, shouldPoll, isTimedOut]);

  // Single consolidated useEffect for all intervals
  // Note: We track shouldPoll/isTimedOut inside the interval callbacks
  // rather than as dependencies to prevent interval recreation
  useEffect(() => {
    if (!shouldPoll) return;

    let elapsedInterval, pollInterval, messageInterval, timeoutId;

    // Update elapsed time
    elapsedInterval = setInterval(() => {
      setElapsed((prev) => prev + POLL_INTERVAL);
    }, POLL_INTERVAL);

    // Poll server status - inline to avoid dependency issues
    const pollServerStatusAsync = async () => {
      // Check refs instead of state to avoid stale closures
      if (shouldPollRef.current && !isTimedOutRef.current) {
        try {
          await settingsApi.fetchServerStatus(AbortSignal.timeout(5000));
          shouldPollRef.current = false;
          setShouldPoll(false);
          onReadyRef.current();
        } catch {
          // Server not ready yet, continue polling
        }
      }
    };

    // Initial poll
    pollServerStatusAsync();

    // Set up polling interval
    pollInterval = setInterval(pollServerStatusAsync, POLL_INTERVAL);

    // Cycle loading messages every 2 seconds
    messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);

    // Timeout after 30 seconds
    timeoutId = setTimeout(() => {
      shouldPollRef.current = false;
      setShouldPoll(false);
      setIsTimedOut(true);
      onErrorRef.current(new Error(t("setup.serverStartup.timeout")));
    }, TIMEOUT);

    // Cleanup ALL intervals
    return () => {
      clearInterval(elapsedInterval);
      clearInterval(pollInterval);
      clearInterval(messageInterval);
      clearTimeout(timeoutId);
    };

  }, [shouldPoll, t]);

  const handleRetry = () => {
    setIsTimedOut(false);
    setElapsed(0);
    setShouldPoll(true);
  };

  if (isTimedOut) {
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
          p={8}
          borderRadius="2xl"
          boxShadow="2xl"
          border={`1px solid ${"surface"}`}
          w="100%"
          maxW="450px"
          textAlign="center"
        >
          <VStack gap={6}>
            <Icon boxSize={12} color="dangerButton" asChild><FaServer /></Icon>
            <Heading
              as="h1"
              color={"textPrimary"}
              css={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: "1.5rem",
                fontWeight: "700"
              }}
            >
              {t("setup.serverStartup.takingLong")}
            </Heading>
            <Text color={"textSecondary"}>
              {t("setup.serverStartup.takingLongDesc")}
            </Text>
            <Text color={"textSecondary"} fontSize="sm">
              {t("setup.serverStartup.waited", {
                seconds: Math.floor(elapsed / 1000),
              })}
            </Text>
            <Button
              onClick={handleRetry}
              size="lg"
              className="green-button"
              css={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: "600"
              }}
            >
              {t("setup.serverStartup.tryAgain")}
            </Button>
          </VStack>
        </Box>
      </Flex>
    );
  }

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
        p={8}
        borderRadius="2xl"
        boxShadow="2xl"
        border={`1px solid ${"surface"}`}
        w="100%"
        maxW="450px"
        textAlign="center"
      >
        <VStack gap={6}>
          <Spinner
            size="xl"
            color={"accent"}
            borderWidth="4px"
            animationDuration="0.8s"
          />
          <Heading
            as="h1"
            color={"textPrimary"}
            css={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: "1.5rem",
              fontWeight: "700"
            }}
          >
            {t("setup.serverStartup.starting")}
          </Heading>
          <Text
            color={"textSecondary"}
            fontSize="lg"
            minH="2rem"
            key={messageIndex}
            className="anim-fade-slide-up"
            css={{ animationDuration: "0.3s" }}
          >
            {t(LOADING_MESSAGES[messageIndex])}
          </Text>
        </VStack>
        </Box>
      </Flex>
  );
};

export default ServerStartupLoader;
