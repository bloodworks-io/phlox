import React from "react";
import { Box, Tooltip, useColorMode, Text } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import {
  FaMicrophone,
  FaPause,
  FaPlay,
  FaTimes,
  FaComments,
  FaKeyboard,
  FaPaperPlane,
  FaFileAlt,
  FaCircle,
} from "react-icons/fa";
import PillBox from "../common/PillBox";
import { colors } from "../../theme/colors";

// Animation keyframes
const pulse = keyframes`
  0%, 100% {
    opacity: 0.3;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.1);
  }
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

// Swirling orb animations for loading state
const swirlOrbit = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const swirlOrbitReverse = keyframes`
  0% { transform: rotate(360deg); }
  100% { transform: rotate(0deg); }
`;

const corePulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.15); opacity: 1; }
`;

const orbPulse = keyframes`
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.2); }
`;

const fadeIn = keyframes`
  0% { opacity: 0; transform: scale(0.8); }
  100% { opacity: 1; transform: scale(1); }
`;

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
    <Box
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg="linear-gradient(135deg, #BF360C, #E65100)"
    />
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

// Internal pulsing glow for recording state
const InternalGlow = () => (
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
    <Box
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      borderRadius="full"
      bg="radial-gradient(circle, rgba(229,62,62,0.4) 0%, rgba(229,62,62,0.1) 50%, transparent 70%)"
      animation={`${pulse} 1.5s ease-in-out infinite`}
    />
  </Box>
);

// Swirling loading orb component
const LoadingOrb = ({ size = 46 }) => {
  const orbSize = 10;
  const orbitRadius = size * 0.32;

  return (
    <Box
      position="relative"
      display="flex"
      alignItems="center"
      justifyContent="center"
      w={`${size}px`}
      h={`${size}px`}
      borderRadius="full"
      overflow="hidden"
      animation={`${fadeIn} 0.3s ease-out forwards`}
    >
      {/* Central glowing core */}
      <Box
        position="absolute"
        borderRadius="full"
        w={`${size * 0.35}px`}
        h={`${size * 0.35}px`}
        bg="radial-gradient(circle, #FF8A50 0%, #FF6B35 50%, transparent 70%)"
        animation={`${corePulse} 1.5s ease-in-out infinite`}
        boxShadow="0 0 15px rgba(255, 107, 53, 0.6)"
      />

      {/* Orbit ring 1 - outer */}
      <Box
        position="absolute"
        w={`${orbitRadius * 2}px`}
        h={`${orbitRadius * 2}px`}
        borderRadius="full"
        animation={`${swirlOrbit} 2s linear infinite`}
      >
        <Box
          position="absolute"
          top="0"
          left="50%"
          transform="translateX(-50%)"
          w={`${orbSize}px`}
          h={`${orbSize}px`}
          borderRadius="full"
          bg="linear-gradient(135deg, #FF6B35, #FF8A50)"
          boxShadow="0 0 8px rgba(255, 107, 53, 0.8)"
          animation={`${orbPulse} 1s ease-in-out infinite`}
        />
      </Box>

      {/* Orbit ring 2 - middle */}
      <Box
        position="absolute"
        w={`${orbitRadius * 1.5}px`}
        h={`${orbitRadius * 1.5}px`}
        borderRadius="full"
        animation={`${swirlOrbitReverse} 1.5s linear infinite`}
      >
        <Box
          position="absolute"
          bottom="0"
          left="50%"
          transform="translateX(-50%)"
          w={`${orbSize * 0.8}px`}
          h={`${orbSize * 0.8}px`}
          borderRadius="full"
          bg="linear-gradient(135deg, #FFB74D, #FF8A50)"
          boxShadow="0 0 6px rgba(255, 183, 77, 0.8)"
          animation={`${orbPulse} 1.2s ease-in-out infinite 0.3s`}
        />
      </Box>

      {/* Orbit ring 3 - inner */}
      <Box
        position="absolute"
        w={`${orbitRadius * 1}px`}
        h={`${orbitRadius * 1}px`}
        borderRadius="full"
        animation={`${swirlOrbit} 1s linear infinite`}
      >
        <Box
          position="absolute"
          top="50%"
          right="0"
          transform="translateY(-50%)"
          w={`${orbSize * 0.6}px`}
          h={`${orbSize * 0.6}px`}
          borderRadius="full"
          bg="linear-gradient(135deg, #FFCC80, #FFB74D)"
          boxShadow="0 0 5px rgba(255, 204, 128, 0.8)"
          animation={`${orbPulse} 0.8s ease-in-out infinite 0.5s`}
        />
      </Box>
    </Box>
  );
};

// Timer display positioned above button
const RadialTimer = ({ timer, isPaused }) => {
  const minutes = Math.floor(timer / 60);
  const seconds = String(timer % 60).padStart(2, "0");

  // Position above the record button
  const buttonBottom = 45;

  return (
    <Box
      position="fixed"
      bottom={`${buttonBottom + 70}px`}
      left="50%"
      transform="translateX(-50%)"
      pointerEvents="none"
      bg="rgba(0,0,0,0.7)"
      px={3}
      py={1}
      borderRadius="full"
      zIndex="1051"
    >
      <Text
        fontSize="md"
        fontWeight="medium"
        letterSpacing="0.5px"
        color="white"
        opacity={isPaused ? 0.5 : 1}
        sx={{ fontFamily: '"Roboto", sans-serif' }}
      >
        {minutes}:{seconds}
      </Text>
    </Box>
  );
};

// Main record button with states
const RecordButton = ({
  isRecording,
  isPaused,
  onStart,
  onPause,
  onResume,
  size = 56,
}) => {
  const { colorMode } = useColorMode();
  const [isHovered, setIsHovered] = React.useState(false);

  const getButtonStyles = () => {
    if (isRecording && !isPaused) {
      return {
        bg: "#E53E3E",
        color: "white",
        boxShadow: "0 0 0 0 rgba(229, 62, 62, 0.4)",
      };
    } else if (isPaused) {
      return {
        bg: "#DD6B20",
        color: "white",
        boxShadow: "none",
      };
    } else {
      return {
        bg: "transparent",
        color: "white",
        boxShadow: "none",
      };
    }
  };

  const styles = getButtonStyles();

  // Determine what icon to show
  const getIcon = () => {
    if (isRecording && !isPaused) {
      // When recording, show pause on hover, otherwise show circle
      return isHovered ? <FaPause size={20} /> : <FaCircle size={20} />;
    } else if (isPaused) {
      return <FaPlay size={20} />;
    } else {
      return <FaMicrophone size={20} />;
    }
  };

  const getLabel = () => {
    if (isRecording && !isPaused) {
      return isHovered ? "Pause" : "Recording...";
    } else if (isPaused) {
      return "Resume";
    } else {
      return "Record";
    }
  };

  const handleClick = () => {
    if (isRecording) {
      if (isPaused) {
        onResume();
      } else {
        onPause();
      }
    } else {
      onStart();
    }
  };

  return (
    <Tooltip label={getLabel()} hasArrow placement="top">
      <Box
        as="button"
        position="relative"
        display="flex"
        alignItems="center"
        justifyContent="center"
        w={`${size}px`}
        h={`${size}px`}
        borderRadius="full"
        border="none"
        cursor="pointer"
        transition="all 0.2s ease"
        outline="none"
        overflow="hidden"
        boxShadow="xl"
        {...styles}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Idle state: lava blobs */}
        {!isRecording && !isPaused && <LavaBlobs />}

        {/* Recording state: internal pulsing glow */}
        {isRecording && !isPaused && <InternalGlow />}

        {/* Inner highlight border */}
        <Box
          position="absolute"
          top="2px"
          left="2px"
          right="2px"
          bottom="2px"
          borderRadius="full"
          border="1px solid rgba(255,255,255,0.3)"
          pointerEvents="none"
        />

        {/* Icon */}
        <Box position="relative" zIndex={1}>
          {getIcon()}
        </Box>
      </Box>
    </Tooltip>
  );
};

// Left button: Mode toggle (idle) / Reset (recording)
const ModeResetButton = ({ isRecording, isAmbient, onModeToggle, onReset }) => {
  const { colorMode } = useColorMode();
  const [isHovered, setIsHovered] = React.useState(false);

  if (isRecording) {
    // Reset button state
    return (
      <Tooltip label="Reset" hasArrow placement="top">
        <Box
          as="button"
          display="flex"
          alignItems="center"
          justifyContent="center"
          w="40px"
          h="40px"
          borderRadius="full"
          border="1px solid #ECC94B"
          cursor="pointer"
          transition="all 0.2s ease"
          outline="none"
          bg={isHovered ? "#ECC94B" : "transparent"}
          color={isHovered ? "white" : "#ECC94B"}
          boxShadow="md"
          _hover={{
            transform: "scale(1.05)",
          }}
          onClick={onReset}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <FaTimes size={16} />
        </Box>
      </Tooltip>
    );
  }

  // Mode toggle state
  const Icon = isAmbient ? FaComments : FaKeyboard;
  const label = isAmbient
    ? "Ambient mode - click for Dictate"
    : "Dictate mode - click for Ambient";

  return (
    <Tooltip label={label} hasArrow placement="top">
      <Box
        as="button"
        display="flex"
        alignItems="center"
        justifyContent="center"
        w="30px"
        h="30px"
        borderRadius="full"
        border="none"
        bg="transparent"
        cursor="pointer"
        transition="all 0.2s ease"
        outline="none"
        className="pill-box-icons"
        mr={0}
        boxShadow="none"
        _hover={{
          bg: colors.dark.surface,
          transform: "scale(1.05)",
        }}
        onClick={onModeToggle}
      >
        <Icon size={16} />
      </Box>
    </Tooltip>
  );
};

// Right button: Transcript (idle) / Send (recording)
const TranscriptSendButton = ({
  isRecording,
  onOpenTranscription,
  onSend,
  isTranscriptionOpen,
  hasRawTranscription,
}) => {
  const { colorMode } = useColorMode();
  const [isHovered, setIsHovered] = React.useState(false);

  if (isRecording) {
    // Send button state
    return (
      <Tooltip label="Stop and send" hasArrow placement="top">
        <Box
          as="button"
          display="flex"
          alignItems="center"
          justifyContent="center"
          w="40px"
          h="40px"
          borderRadius="full"
          border="1px solid #48BB78"
          cursor="pointer"
          transition="all 0.2s ease"
          outline="none"
          bg={isHovered ? "#48BB78" : "transparent"}
          color={isHovered ? "white" : "#48BB78"}
          boxShadow="md"
          _hover={{
            transform: "scale(1.05)",
          }}
          onClick={onSend}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <FaPaperPlane size={14} />
        </Box>
      </Tooltip>
    );
  }

  // Transcript button state
  const isDisabled = !hasRawTranscription;
  const label = isDisabled ? "No transcript available" : "Transcript";

  return (
    <Tooltip label={label} hasArrow placement="top">
      <Box
        as="button"
        display="flex"
        alignItems="center"
        justifyContent="center"
        w="30px"
        h="30px"
        borderRadius="full"
        className="pill-box-icons"
        mr={0}
        cursor={isDisabled ? "not-allowed" : "pointer"}
        transition="all 0.2s ease"
        outline="none"
        opacity={isDisabled ? 0.4 : 1}
        bg={isTranscriptionOpen ? colors.dark.surface : "transparent"}
        _hover={
          isDisabled
            ? {}
            : { bg: colors.dark.surface, transform: "scale(1.05)" }
        }
        pointerEvents={isDisabled ? "none" : "auto"}
        onClick={onOpenTranscription}
      >
        <FaFileAlt size={14} />
      </Box>
    </Tooltip>
  );
};

// Main pill box container
const ScribePillBox = ({
  // Recording state
  isRecording,
  isPaused,
  timer,
  onStart,
  onPause,
  onResume,
  onSend,
  onReset,
  isLoading,
  // Mode toggle
  isAmbient,
  onModeToggle,
  // Panel handlers
  onOpenTranscription,
  // Panel states
  isTranscriptionOpen,
  // Other
  hasRawTranscription,
}) => {
  if (isLoading) {
    return (
      <PillBox
        bottom="20px"
        left="50%"
        transform="translateX(-50%)"
        className="pill-box-scribe"
        px={2}
        py={2}
        gap={0}
      >
        <LoadingOrb size={46} />
      </PillBox>
    );
  }

  return (
    <>
      {/* Main pill box */}
      <PillBox
        bottom="20px"
        className="pill-box-scribe"
        left="50%"
        transform="translateX(-50%)"
      >
        {/* Left: Mode toggle / Reset */}
        <ModeResetButton
          isRecording={isRecording}
          isAmbient={isAmbient}
          onModeToggle={onModeToggle}
          onReset={onReset}
        />

        {/* Center: Record button */}
        <RecordButton
          isRecording={isRecording}
          isPaused={isPaused}
          onStart={onStart}
          onPause={onPause}
          onResume={onResume}
          size={46}
        />

        {/* Right: Transcript / Send */}
        <TranscriptSendButton
          isRecording={isRecording}
          onOpenTranscription={onOpenTranscription}
          onSend={onSend}
          isTranscriptionOpen={isTranscriptionOpen}
          hasRawTranscription={hasRawTranscription}
        />
      </PillBox>

      {/* Timer - positioned above pill box */}
      {/* Temporarily disabled
      {isRecording && <RadialTimer timer={timer} isPaused={isPaused} />}
      */}
    </>
  );
};

export default ScribePillBox;
