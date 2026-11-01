import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
      bg="folio.paper"
      border="1px solid"
      borderColor="folio.line"
      borderRadius="folioControl"
      px={4}
      py={2}
      boxShadow="overlay"
      className="anim-fade"
    >
      {bars.map((bar, i) => (
        <Box
          key={i}
          zIndex="1"
          w="3px"
          mx="1.5px"
          borderRadius="full"
          backgroundColor={isRecording ? "folio.danger" : "folio.warning"}
          opacity={isPaused ? "0.5" : "1"}
          height={`${8 + Math.round((bar.frequency - 1) * 16)}px`}
        />
      ))}
      <Text
        ml={3}
        fontSize="md"
        fontWeight="bold"
        fontFamily="body"
        color={isRecording ? "folio.danger" : "folio.warning"}
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
  const { t } = useTranslation();
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
        title: t("toast.error"),
        description: t("dictation.unsupported"),
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
        title: t("toast.error"),
        description: t("dictation.startFailed"),
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
        (tpl) => tpl.name === "Dictation",
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
          title: t("toast.success"),
          description: t("dictation.generated"),
          type: "success",
          duration: 3000,
        });
      } else {
        throw new Error("Failed to generate letter content");
      }
    } catch (error) {
      console.error("Error processing dictation:", error);
      toaster.create({
        title: t("toast.error"),
        description: t("dictation.processFailed"),
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
        content={isRecording ? t("dictation.stop") : t("dictation.start")}
        disabled={isDisabled || isProcessing}
        positioning={{
          placement: "left"
        }}
      >
        <IconButton
          onClick={isRecording ? stopRecording : startRecording}
           disabled={isDisabled || isProcessing}
           aria-label={t("scribe.mode.dictate")}
           position="absolute"
           bottom={4}
           // Positioned to the left of the refinement button (which is at right: 4 = 16px)
           right="60px"
           width="40px"
           height="40px"
           borderRadius="full"
           zIndex={2}
           className="dictation-fab"
           backgroundColor={isRecording ? "folio.danger" : "folio.accent"}
           color={isRecording ? "folio.dangerInk" : "folio.accentInk"}
           borderWidth="1px"
           borderColor={isRecording ? "folio.danger" : "folio.accent"}
           transition="color 160ms ease, background-color 160ms ease, border-color 160ms ease"
           _hover={{
             backgroundColor: isRecording
               ? "folio.danger/90"
               : "folio.accent/90",
           }}
           _focusVisible={{
             outline: "2px solid",
             outlineColor: "folio.focus",
             outlineOffset: "2px",
           }}
         >{isProcessing ? (
            <Spinner size="sm" color="folio.brandInk" />

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
