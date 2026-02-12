import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Button,
  Heading,
  VStack,
  Text,
  Flex,
  Spinner,
  Icon,
  useColorMode,
} from "@chakra-ui/react";
import { FaServer } from "react-icons/fa";
import { motion } from "framer-motion";
import { colors } from "../../theme/colors";
import { buildApiUrl } from "../../utils/helpers/apiConfig";
import { isTauri } from "../../utils/helpers/apiConfig";

const MotionBox = motion(Box);

const LOADING_MESSAGES = [
  "Reticulating splines...",
  "Initializing quip database...",
  "Herding cats...",
  "Warming up the hamsters...",
  "Calculating escape velocity...",
  "Decrypting the arc of the covenant...",
  "Consulting the oracle...",
  "Synergizing our core competencies...",
  "Aligning our chakras...",
  "Loading next experience point...",
  "Polishing the bits...",
  "Defragmenting the ether...",
  "Convincing the AI to cooperate...",
  "Applying coffee to the problem...",
  "Downloading more RAM...",
];

const POLL_INTERVAL = 2000; // ms - increased to reduce CPU load
const TIMEOUT = 30000; // 30 seconds

const ServerStartupLoader = ({ onReady, onError }) => {
  const { colorMode } = useColorMode();
  const currentColors = colors[colorMode];

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
          const baseUrl = isTauri() ? await buildApiUrl("") : "";
          const response = await fetch(`${baseUrl}/api/config/status`, {
            signal: AbortSignal.timeout(5000),
          });
          if (response.ok) {
            shouldPollRef.current = false;
            setShouldPoll(false);
            onReadyRef.current();
          }
        } catch (error) {
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
      onErrorRef.current(new Error("Server startup timed out"));
    }, TIMEOUT);

    // Cleanup ALL intervals
    return () => {
      clearInterval(elapsedInterval);
      clearInterval(pollInterval);
      clearInterval(messageInterval);
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldPoll]);

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
        minH="100vh"
        className="panels-bg"
        px={4}
        py={8}
      >
        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          p={8}
          borderRadius="2xl"
          boxShadow="2xl"
          className="panels-bg"
          border={`1px solid ${currentColors.surface}`}
          w="100%"
          maxW="450px"
          textAlign="center"
        >
          <VStack spacing={6}>
            <Icon as={FaServer} boxSize={12} color="red.500" />
            <Heading
              as="h1"
              color={currentColors.textPrimary}
              sx={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: "1.5rem",
                fontWeight: "700",
              }}
            >
              Server Taking Too Long
            </Heading>
            <Text color={currentColors.textSecondary}>
              The server is taking longer than expected to start. This might be
              due to system resources or other factors.
            </Text>
            <Text color={currentColors.textSecondary} fontSize="sm">
              Waited {Math.floor(elapsed / 1000)} seconds
            </Text>
            <Button
              onClick={handleRetry}
              size="lg"
              className="switch-mode"
              sx={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: "600",
              }}
            >
              Try Again
            </Button>
          </VStack>
        </MotionBox>
      </Flex>
    );
  }

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
        p={8}
        borderRadius="2xl"
        boxShadow="2xl"
        className="panels-bg"
        border={`1px solid ${currentColors.surface}`}
        w="100%"
        maxW="450px"
        textAlign="center"
      >
        <VStack spacing={6}>
          <Spinner
            size="xl"
            color={currentColors.accent}
            thickness="4px"
            speed="0.8s"
          />
          <Heading
            as="h1"
            color={currentColors.textPrimary}
            sx={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: "1.5rem",
              fontWeight: "700",
            }}
          >
            Starting Server
          </Heading>
          <Text color={currentColors.textSecondary} fontSize="lg" minH="2rem">
            {LOADING_MESSAGES[messageIndex]}
          </Text>
        </VStack>
      </MotionBox>
    </Flex>
  );
};

export default ServerStartupLoader;
