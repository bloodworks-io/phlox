import {
  VStack,
  FormControl,
  FormLabel,
  Input,
  Select,
  HStack,
  Tooltip,
  Flex,
  Spinner,
  Text,
  Box,
} from "@chakra-ui/react";
import { InfoIcon } from "@chakra-ui/icons";
import { motion } from "framer-motion";
import { stepVariants } from "../constants";
import { useTranscriptionStep } from "../../../../utils/hooks/splash/useTranscriptionStep";

const MotionVStack = motion(VStack);

export { useTranscriptionStep };

export const TranscriptionStep = ({
  whisperBaseUrl,
  setWhisperBaseUrl,
  whisperModel,
  setWhisperModel,
  availableWhisperModels,
  whisperModelListAvailable,
  isFetchingWhisperModels,
  fetchWhisperModels,
  currentColors,
}) => (
  <MotionVStack
    key="transcription"
    variants={stepVariants}
    initial="hidden"
    animate="visible"
    exit="exit"
    spacing={6}
    w="100%"
  >
    <VStack spacing={4} w="100%">
      <Box w="100%" p={4} borderRadius="md" className="floating-main">
        <Text fontSize="sm" color={currentColors.textSecondary} mb={2}>
          <strong>Note:</strong> Voice transcription is optional but highly
          recommended for hands-free operation during patient consultations.
        </Text>
      </Box>

      <FormControl>
        <HStack>
          <FormLabel
            color={currentColors.textSecondary}
            sx={{
              fontFamily: '"Roboto", sans-serif',
              fontSize: "sm",
              fontWeight: "500",
            }}
          >
            Whisper Base URL (Optional)
          </FormLabel>
          <Tooltip
            label="The URL where your Whisper transcription server is running. Leave empty to skip voice transcription setup."
            placement="top"
            hasArrow
            fontSize="xs"
            bg="gray.700"
            color="white"
          >
            <InfoIcon boxSize={3} color={currentColors.textSecondary} />
          </Tooltip>
        </HStack>
        <Input
          placeholder="e.g., http://localhost:8080"
          value={whisperBaseUrl}
          onChange={(e) => {
            setWhisperBaseUrl(e.target.value);
          }}
          onBlur={fetchWhisperModels}
          className="input-style"
          size="md"
        />
      </FormControl>

      {whisperBaseUrl.trim() && (
        <FormControl isRequired>
          <HStack>
            <FormLabel
              color={currentColors.textSecondary}
              sx={{
                fontFamily: '"Roboto", sans-serif',
                fontSize: "sm",
                fontWeight: "500",
              }}
            >
              Whisper Model
            </FormLabel>
            <Tooltip
              label="The Whisper model to use for speech-to-text. Common options include whisper-1, base, small, medium, or large."
              placement="top"
              hasArrow
              fontSize="xs"
              bg="gray.700"
              color="white"
            >
              <InfoIcon boxSize={3} color={currentColors.textSecondary} />
            </Tooltip>
          </HStack>
          {whisperModelListAvailable && availableWhisperModels.length > 0 ? (
            <Select
              placeholder="Select Whisper model"
              value={whisperModel}
              onChange={(e) => setWhisperModel(e.target.value)}
              isDisabled={isFetchingWhisperModels}
              className="input-style"
              size="md"
            >
              {availableWhisperModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              placeholder="Enter model name (e.g., whisper-1, base, small)"
              value={whisperModel}
              onChange={(e) => setWhisperModel(e.target.value)}
              isDisabled={isFetchingWhisperModels}
              className="input-style"
              size="md"
            />
          )}
          {isFetchingWhisperModels && (
            <Flex align="center" mt={2}>
              <Spinner size="xs" mr={2} color={currentColors.primaryButton} />
              <Text
                fontSize="sm"
                color={currentColors.textSecondary}
                sx={{ fontFamily: '"Roboto", sans-serif' }}
              >
                Loading Whisper models...
              </Text>
            </Flex>
          )}
        </FormControl>
      )}
    </VStack>
  </MotionVStack>
);
