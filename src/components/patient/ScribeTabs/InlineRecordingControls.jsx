import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Box,
  Flex,
  Text,
  useColorMode,
  Tooltip,
  Spinner,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { FaMicrophone, FaPause, FaPlay, FaStop, FaTimes } from "react-icons/fa";
import { colors } from "../../../theme/colors";

// Animation keyframes
const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.15); opacity: 0.8; }
`;

const recordingRing = keyframes`
  0% { transform: scale(1); opacity: 0.6; }
  100% { transform: scale(1.5); opacity: 0; }
`;

const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const lavaBlob1 = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(6px, -4px) scale(1.2); }
  66% { transform: translate(-4px, 5px) scale(0.9); }
`;

const lavaBlob2 = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-5px, 4px) scale(0.85); }
  66% { transform: translate(4px, -3px) scale(1.15); }
`;

const lavaBlob3 = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(3px, 6px) scale(1.1); }
`;

// Compact inline waveform for header row
const InlineWaveform = React.memo(({ isRecording, isPaused }) => {
  const { colorMode } = useColorMode();
  const barCount = 8;

  const [bars] = useState(() =>
    [...Array(barCount)].map(() => ({
      frequency: 0.6 + Math.random() * 0.6,
      delay: Math.random() * -1,
    })),
  );

  if (!isRecording && !isPaused) return null;

  const barColor =
    colorMode === "light"
      ? colors.light.primaryButton
      : colors.dark.primaryButton;

  return (
    <Flex h="20px" align="center" justify="center" mx={2}>
      {bars.map((bar, i) => (
        <Box
          key={i}
          w="2px"
          mx="0.5px"
          borderRadius="full"
          bg={barColor}
          opacity={isPaused ? "0.3" : "0.8"}
          animation={
            isRecording && !isPaused
              ? `inlineBarAnimation ${bar.frequency}s infinite ease-in-out`
              : "none"
          }
          sx={{
            "@keyframes inlineBarAnimation": {
              "0%, 100%": { height: "3px" },
              "50%": { height: "14px" },
            },
          }}
          style={{
            animationDelay: `${bar.delay}s`,
            height: isPaused ? "3px" : undefined,
            transition: "all 0.15s ease-out",
          }}
        />
      ))}
    </Flex>
  );
});

// Timer display
const InlineTimer = ({ timer, isPaused }) => {
  const minutes = Math.floor(timer / 60);
  const seconds = String(timer % 60).padStart(2, "0");
  return (
    <Text
      fontSize="lg"
      minW="32px"
      letterSpacing="0.5px"
      sx={{ fontFamily: '"Roboto", sans-serif' }}
      opacity={isPaused ? 0.5 : 1}
    >
      {minutes}:{seconds}
    </Text>
  );
};

// Hook to manage recording state and logic
export const useRecording = ({
  name,
  dob,
  gender,
  templateKey,
  isAmbient,
  onTranscriptionComplete,
  setLoading,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timer, setTimer] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const completeRecordingRef = useRef([]);
  const timerIntervalRef = useRef(null);

  useEffect(() => {
    resetRecordingState();
  }, [name, dob, gender]);

  useEffect(() => {
    if (isRecording && !isPaused) {
      timerIntervalRef.current = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerIntervalRef.current);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [isRecording, isPaused]);

  const resetRecordingState = useCallback(() => {
    setIsRecording(false);
    setIsPaused(false);
    setTimer(0);
    setAudioBlob(null);
    audioChunksRef.current = [];
    completeRecordingRef.current = [];
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream
        ?.getTracks()
        .forEach((track) => track.stop());
    }
    mediaRecorderRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Microphone access is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        completeRecordingRef.current = [
          ...completeRecordingRef.current,
          ...audioChunksRef.current,
        ];
        const blob = new Blob(completeRecordingRef.current, {
          type: "audio/wav",
        });
        setAudioBlob(blob);
        audioChunksRef.current = [];
        setIsRecording(false);
        setIsPaused(false);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setTimer(0);
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Could not access microphone. Please check your permissions.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      if (isRecording && mediaRecorderRef.current) {
        mediaRecorderRef.current.onstop = () => {
          completeRecordingRef.current = [
            ...completeRecordingRef.current,
            ...audioChunksRef.current,
          ];
          const blob = new Blob(completeRecordingRef.current, {
            type: "audio/wav",
          });
          audioChunksRef.current = [];
          setIsRecording(false);
          setIsPaused(false);
          resolve(blob);
        };
        mediaRecorderRef.current.stop();
      } else {
        resolve(audioBlob);
      }
    });
  }, [isRecording, audioBlob]);

  const pauseRecording = useCallback(() => {
    mediaRecorderRef.current?.pause();
    setIsPaused(true);
  }, []);

  const resumeRecording = useCallback(() => {
    mediaRecorderRef.current?.resume();
    setIsPaused(false);
  }, []);

  const resetRecording = useCallback(() => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
    }
    resetRecordingState();
  }, [isRecording, resetRecordingState]);

  return {
    isRecording,
    isPaused,
    timer,
    audioBlob,
    setAudioBlob,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    resetRecordingState,
  };
};

// Lava lamp blob layers for idle button
const LavaBlobs = () => (
  <Box
    position="absolute"
    top={0}
    left={0}
    right={0}
    bottom={0}
    borderRadius="full"
    overflow="hidden"
    pointerEvents="none"
  >
    {/* Base gradient */}
    <Box
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg="linear-gradient(135deg, #BF360C, #E65100)"
    />
    {/* Blob 1 - top left area */}
    <Box
      position="absolute"
      top="-10%"
      left="-10%"
      w="70%"
      h="70%"
      borderRadius="50%"
      bg="radial-gradient(circle, #FF6B35 0%, transparent 70%)"
      animation={`${lavaBlob1} 4s ease-in-out infinite`}
      opacity={0.8}
    />
    {/* Blob 2 - bottom right area */}
    <Box
      position="absolute"
      top="40%"
      left="30%"
      w="60%"
      h="60%"
      borderRadius="50%"
      bg="radial-gradient(circle, #FF8A50 0%, transparent 70%)"
      animation={`${lavaBlob2} 3s ease-in-out infinite`}
      opacity={0.7}
    />
    {/* Blob 3 - center highlight */}
    <Box
      position="absolute"
      top="20%"
      left="40%"
      w="50%"
      h="50%"
      borderRadius="50%"
      bg="radial-gradient(circle, #FFB74D 0%, transparent 20%)"
      animation={`${lavaBlob3} 5.5s ease-in-out infinite`}
      opacity={0.5}
    />
  </Box>
);

// Main record button with states
const RecordButton = ({
  isRecording,
  isPaused,
  onStart,
  onPause,
  onResume,
}) => {
  const { colorMode } = useColorMode();

  const getButtonStyles = () => {
    if (isRecording && !isPaused) {
      // Active recording - solid red
      return {
        bg: "#E53E3E",
        color: "white",
        _hover: { bg: "#C53030" },
      };
    } else if (isPaused) {
      // Paused - amber
      return {
        bg: "#DD6B20",
        color: "white",
        _hover: { bg: "#C05621" },
      };
    } else {
      // Idle - lava lamp effect (handled by LavaBlobs component)
      return {
        bg: "transparent",
        color: "white",
      };
    }
  };

  const styles = getButtonStyles();
  const Icon = isRecording ? (isPaused ? FaPlay : FaPause) : FaMicrophone;
  const label = isRecording ? (isPaused ? "Resume" : "Pause") : "Record";

  return (
    <Tooltip label={label} hasArrow placement="top">
      <Box
        as="button"
        position="relative"
        display="flex"
        alignItems="center"
        justifyContent="center"
        w="32px"
        h="32px"
        borderRadius="full"
        border="none"
        cursor="pointer"
        transition="all 0.2s ease"
        outline="none"
        overflow="hidden"
        {...styles}
        onClick={isRecording ? (isPaused ? onResume : onPause) : onStart}
      >
        {!isRecording && !isPaused && <LavaBlobs />}
        <Box position="relative" zIndex={1}>
          <Icon size={14} />
        </Box>
      </Box>
    </Tooltip>
  );
};

// Small action button for send/cancel
const ActionButton = ({ icon: Icon, label, onClick, variant = "default" }) => {
  const { colorMode } = useColorMode();

  const variants = {
    default: {
      bg: "transparent",
      color: colorMode === "light" ? "gray.500" : "gray.400",
      _hover: {
        bg: colorMode === "light" ? "gray.100" : "gray.700",
        color: colorMode === "light" ? "gray.700" : "gray.200",
      },
    },
    send: {
      bg:
        colorMode === "light"
          ? `${colors.light.primaryButton}15`
          : `${colors.dark.primaryButton}20`,
      color: colors.light.primaryButton,
      _hover: {
        bg:
          colorMode === "light"
            ? `${colors.light.primaryButton}25`
            : `${colors.dark.primaryButton}30`,
      },
    },
    cancel: {
      bg: "transparent",
      color: colorMode === "light" ? "red.400" : "red.300",
      _hover: {
        bg: colorMode === "light" ? "red.50" : "rgba(229, 62, 62, 0.1)",
      },
    },
  };

  return (
    <Tooltip label={label} hasArrow placement="top">
      <Box
        as="button"
        display="flex"
        alignItems="center"
        justifyContent="center"
        w="24px"
        h="24px"
        borderRadius="6px"
        border="none"
        cursor="pointer"
        transition="all 0.15s ease"
        outline="none"
        fontSize="10px"
        {...variants[variant]}
        onClick={onClick}
      >
        <Icon size={10} />
      </Box>
    </Tooltip>
  );
};

// Inline recording controls for header row
const InlineRecordingControls = ({
  isRecording,
  isPaused,
  timer,
  onStart,
  onPause,
  onResume,
  onSend,
  onReset,
  isLoading,
}) => {
  const { colorMode } = useColorMode();

  if (isLoading) {
    return (
      <Flex align="center" justify="center" w="60px">
        <Spinner size="sm" color={colors.light.primaryButton} />
      </Flex>
    );
  }

  return (
    <Flex
      align="center"
      className="inline-recording-controls"
      borderRadius="lg"
      px={2}
      py={1}
      gap={1}
    >
      <RecordButton
        isRecording={isRecording}
        isPaused={isPaused}
        onStart={onStart}
        onPause={onPause}
        onResume={onResume}
      />

      {isRecording && (
        <>
          <InlineWaveform isRecording={isRecording} isPaused={isPaused} />
          <InlineTimer timer={timer} isPaused={isPaused} />

          <Flex
            gap={1}
            ml={1}
            pl={1}
            borderLeft="1px solid"
            borderColor={colorMode === "light" ? "gray.200" : "gray.700"}
          >
            <ActionButton
              icon={FaStop}
              label="Send for transcription"
              onClick={onSend}
              variant="send"
            />
            <ActionButton
              icon={FaTimes}
              label="Cancel"
              onClick={onReset}
              variant="cancel"
            />
          </Flex>
        </>
      )}
    </Flex>
  );
};

export default InlineRecordingControls;
