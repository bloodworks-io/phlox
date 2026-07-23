import React, { useState, useRef, useEffect } from "react";
import { colors } from "../../../theme/colors";
import { IconButton, Box, Flex, Text, Spinner } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { Tooltip } from '@/components/ui/tooltip';
import { FaMicrophone, FaStop } from "react-icons/fa";
import { transcriptionApi } from "../../../utils/api/transcriptionApi";
import { letterApi } from "../../../utils/api/letterApi";
import { AudioRecorder } from "../../../utils/audioRecorder";

const WaveformVisualizer = React.memo(({ isRecording, isPaused, timer }) => {
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
            colors.light.primaryButton
          }
          opacity={isPaused ? "0.5" : "1"}
          animation={
            isRecording && !isPaused
              ? `barAnimation ${bar.frequency}s infinite ease-in-out`
              : "none"
          }
          css={{
            '& @keyframes barAnimation': {
              "0%, 100%": { height: "8px" },
              "50%": { height: "24px" },
            }
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
          colors.light.primaryButton
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
  _setIsRefining,
  setLoading,
  isDisabled,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timer, setTimer] = useState(0);
  const audioRecorderRef = useRef(null);
  const timerIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioRecorderRef.current) {
        audioRecorderRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toaster.create({
        title: "Error",
        description: "Audio recording is not supported in this browser.",
        type: "error",
        duration: 3000,
      });
      return;
    }

    try {
      const recorder = new AudioRecorder();
      await recorder.start();
      audioRecorderRef.current = recorder;
      setIsRecording(true);
      setTimer(0);

      timerIntervalRef.current = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
      toaster.create({
        title: "Error",
        description:
          "Failed to start recording. Please check microphone permissions.",
        type: "error",
        duration: 3000,
      });
    }
  };

  const stopRecording = async () => {
    if (audioRecorderRef.current && isRecording) {
      const recorder = audioRecorderRef.current;
      audioRecorderRef.current = null;
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
      const wavBlob = await recorder.stop();
      await processRecording(wavBlob);
    }
  };

  const processRecording = async (wavBlob) => {
    setIsProcessing(true);
    if (setLoading) setLoading(true);

    try {
      // 1. Transcribe
      const formData = new FormData();
      formData.append("file", wavBlob, "dictation.wav");

      const transcribeData =
          await transcriptionApi.transcribeDictation(formData);
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
        toaster.create({
          title: "Success",
          description: "Letter generated from dictation",
          type: "success",
          duration: 3000,
        });
      } else {
        throw new Error("Failed to generate letter content");
      }
    } catch (error) {
      console.error("Error processing dictation:", error);
      toaster.create({
        title: "Error",
        description: "Failed to process dictation",
        type: "error",
        duration: 3000,
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
        content={isRecording ? "Stop Dictation" : "Start Dictation"}
        disabled={isDisabled || isProcessing}
        positioning={{
          placement: "left"
        }}
      >
        <IconButton
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isDisabled || isProcessing}
          colorPalette={isRecording ? "red" : "gray"}
          aria-label="Dictate"
          position="absolute"
          bottom={4}
          // Positioned to the left of the refinement button (which is at right: 4 = 16px)
          right="60px"
          width="40px"
          height="40px"
          borderRadius="full"
          zIndex={2}
          className="dictation-fab"
          css={{
            transition: "transform 0.2s",

            "&:hover": !isDisabled &&
              !isProcessing && {
                transform: "scale(1.1)",
              }
          }}>{isProcessing ? (
            <Spinner size="sm" />
          ) : isRecording ? (
            <FaStop />
          ) : (
            <FaMicrophone />
          )}</IconButton>
      </Tooltip>
    </>
  );
};

export default DictationWidget;
