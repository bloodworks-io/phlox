import React, { useState, useRef, useEffect } from "react";
import {
  IconButton,
  Box,
  Tooltip,
  useToast,
  Flex,
  Text,
  useTheme,
  useColorMode,
  Spinner,
} from "@chakra-ui/react";
import { FaMicrophone, FaStop } from "react-icons/fa";
import { universalFetch } from "../../../utils/helpers/apiHelpers";
import { buildApiUrl } from "../../../utils/helpers/apiConfig";
import { letterApi } from "../../../utils/api/letterApi";

const WaveformVisualizer = React.memo(({ isRecording, isPaused, timer }) => {
  const theme = useTheme();
  const { colorMode } = useColorMode();
  const barCount = 8; // Smaller for widget

  const [bars] = useState(() =>
    [...Array(barCount)].map(() => ({
      frequency: 1 + Math.random(),
      delay: Math.random() * -2,
    })),
  );

  if (!isRecording && !isPaused) return null;

  // Format the timer
  const minutes = Math.floor(timer / 60);
  const seconds = String(timer % 60).padStart(2, "0");
  const formattedTime = `${minutes}:${seconds}`;

  return (
    <Flex
      h="40px"
      align="center"
      justify="center"
      position="absolute"
      top="50%"
      left="50%"
      transform="translate(-50%, -50%)"
      zIndex="2"
      bg="rgba(255, 255, 255, 0.9)"
      borderRadius="md"
      px={4}
      py={2}
      boxShadow="md"
    >
      {bars.map((bar, i) => (
        <Box
          key={i}
          zIndex="1"
          w="3px"
          mx="1.5px"
          borderRadius="full"
          bg={
            theme.colors[colorMode === "light" ? "light" : "dark"].primaryButton
          }
          opacity={isPaused ? "0.5" : "1"}
          animation={
            isRecording && !isPaused
              ? `barAnimation ${bar.frequency}s infinite ease-in-out`
              : "none"
          }
          sx={{
            "@keyframes barAnimation": {
              "0%, 100%": { height: "8px" },
              "50%": { height: "24px" },
            },
          }}
          style={{
            animationDelay: `${bar.delay}s`,
            height: isPaused ? "8px" : undefined,
            transition: "all 0.3s ease-out",
            animationPlayState: isPaused ? "paused" : "running",
          }}
        />
      ))}

      <Text
        ml={3}
        fontSize="md"
        fontWeight="bold"
        color={
          theme.colors[colorMode === "light" ? "light" : "dark"].primaryButton
        }
      >
        {formattedTime}
      </Text>
    </Flex>
  );
});

const DictationWidget = ({
  patient,
  setFinalCorrespondence,
  letterTemplates,
  setIsRefining,
  setLoading,
  isDisabled,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timer, setTimer] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        title: "Error",
        description: "Audio recording is not supported in this browser.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setTimer(0);

      timerIntervalRef.current = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Error",
        description:
          "Failed to start recording. Please check microphone permissions.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/wav",
        });
        await processRecording(audioBlob);
      };
    }
  };

  const processRecording = async (audioBlob) => {
    setIsProcessing(true);
    if (setLoading) setLoading(true);

    try {
      // 1. Transcribe
      const formData = new FormData();
      formData.append("file", audioBlob, "dictation.wav");

      const transcribeUrl = await buildApiUrl("/api/transcribe/dictate");
      const transcribeResponse = await universalFetch(transcribeUrl, {
        method: "POST",
        body: formData,
      });

      if (!transcribeResponse.ok) {
        throw new Error("Transcription failed");
      }

      const transcribeData = await transcribeResponse.json();
      const transcription = transcribeData.transcription;

      if (!transcription) {
        throw new Error("No transcription received");
      }

      // 2. Find Dictation Template
      const dictationTemplate = letterTemplates?.find(
        (t) => t.name === "Dictation",
      );
      const instructions =
        dictationTemplate?.instructions ||
        "I'm going to dictate the rough outline of a letter to you. I would like you to keep the essence of the structure of the dictated letter, but adjust the punctuation and wording where required to make it a polished letter.";

      // 3. Generate Letter
      // We pass the transcription as part of template_data so it appears in the clinic note
      const templateData = {
        ...(patient?.template_data || {}), // Include existing data
        Dictation: transcription,
      };

      const letterResponse = await letterApi.generateLetter({
        patientName: patient?.name || "Unknown",
        gender: patient?.gender || "Unknown",
        dob: patient?.dob || "Unknown",
        template_data: templateData,
        additional_instruction: instructions,
        context: [], // Add any other context if needed
      });

      if (letterResponse && letterResponse.letter) {
        setFinalCorrespondence(letterResponse.letter);
        toast({
          title: "Success",
          description: "Letter generated from dictation",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } else {
        throw new Error("Failed to generate letter content");
      }
    } catch (error) {
      console.error("Error processing dictation:", error);
      toast({
        title: "Error",
        description: "Failed to process dictation",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsProcessing(false);
      if (setLoading) setLoading(false);
    }
  };

  return (
    <>
      <WaveformVisualizer
        isRecording={isRecording}
        isPaused={false}
        timer={timer}
      />
      <Tooltip
        label={isRecording ? "Stop Dictation" : "Start Dictation"}
        placement="left"
        isDisabled={isDisabled || isProcessing}
      >
        <IconButton
          icon={
            isProcessing ? (
              <Spinner size="sm" />
            ) : isRecording ? (
              <FaStop />
            ) : (
              <FaMicrophone />
            )
          }
          onClick={isRecording ? stopRecording : startRecording}
          isDisabled={isDisabled || isProcessing}
          colorScheme={isRecording ? "red" : "gray"}
          aria-label="Dictate"
          position="absolute"
          bottom={4}
          right="60px" // Positioned to the left of the refinement button (which is at right: 4 = 16px)
          width="40px"
          height="40px"
          borderRadius="full"
          zIndex={2}
          className="dictation-fab"
          sx={{
            transition: "transform 0.2s",
            "&:hover": !isDisabled &&
              !isProcessing && {
                transform: "scale(1.1)",
              },
          }}
        />
      </Tooltip>
    </>
  );
};

export default DictationWidget;
