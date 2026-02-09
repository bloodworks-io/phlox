import { useState, useEffect, useCallback } from "react";
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

const POLL_INTERVAL = 500; // ms
const TIMEOUT = 30000; // 30 seconds

const ServerStartupLoader = ({ onReady, onError }) => {
  const { colorMode } = useColorMode();
  const currentColors = colors[colorMode];

  const [messageIndex, setMessageIndex] = useState(0);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const pollServerStatus = useCallback(async () => {
    const startTime = Date.now();

    try {
      const baseUrl = isTauri() ? await buildApiUrl("") : "";

      // Poll the /api/config/status endpoint
      // Note: The status endpoint is at /api/config/status
      const response = await fetch(`${baseUrl}/api/config/status`);

      if (response.ok) {
        // Server is ready!
        onReady();
        return;
      }
    } catch (error) {
      // Server not ready yet, continue polling
    }

    // Check timeout
    if (Date.now() - startTime > TIMEOUT) {
      setIsTimedOut(true);
      onError(new Error("Server startup timed out"));
      return;
    }

    // Continue polling
    setTimeout(pollServerStatus, POLL_INTERVAL);
  }, [onReady, onError]);

  useEffect(() => {
    pollServerStatus();
  }, [pollServerStatus]);

  // Cycle through loading messages
  useEffect(() => {
    if (!isTimedOut) {
      const interval = setInterval(() => {
        setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 2000); // Change message every 2 seconds

      return () => clearInterval(interval);
    }
  }, [isTimedOut]);

  // Update elapsed time for timeout display
  useEffect(() => {
    if (!isTimedOut) {
      const interval = setInterval(() => {
        setElapsed((prev) => prev + POLL_INTERVAL);
      }, POLL_INTERVAL);

      return () => clearInterval(interval);
    }
  }, [isTimedOut]);

  const handleRetry = () => {
    setIsTimedOut(false);
    setElapsed(0);
    pollServerStatus();
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
