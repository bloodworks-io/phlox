import {
  Box,
  Flex,
  IconButton,
  Text,
  Collapse,
  HStack,
  Tabs,
  TabList,
  TabPanels,
  TabPanel,
  Tab,
  Tooltip,
  Select,
  Spinner,
} from "@chakra-ui/react";
import { ChevronDownIcon, ChevronRightIcon } from "@chakra-ui/icons";
import {
  FaMicrophone,
  FaFileUpload,
  FaComments,
  FaKeyboard,
  FaSync,
  FaClock,
  FaCogs,
} from "react-icons/fa";
import { useEffect, useState, useRef } from "react";
import InlineRecordingControls, {
  useRecording,
} from "./ScribeTabs/InlineRecordingControls";
import DocumentUploadTab from "./ScribeTabs/DocumentUploadTab";
import { useTranscription } from "../../utils/hooks/useTranscription";
import { settingsService } from "../../utils/settings/settingsUtils";
import { isChatEnabled } from "../../utils/helpers/featureFlags";

const TranscriptionView = ({
  rawTranscription,
  transcriptionDuration,
  processDuration,
  isTranscribing,
  onReprocess,
  isAmbient,
  name,
  gender,
  dob,
  templateKey,
}) => {
  const { reprocessTranscription } = useTranscription(onReprocess, () => {});

  const handleReprocess = async () => {
    if (!rawTranscription) return;
    try {
      await reprocessTranscription(
        rawTranscription,
        { name, gender, dob, templateKey },
        transcriptionDuration,
        isAmbient,
      );
    } catch (error) {
      console.error("Failed to reprocess transcription:", error);
    }
  };

  if (!rawTranscription) return null;

  return (
    <Box
      position="relative"
      mt={2}
      height="100%"
      display="flex"
      flexDirection="column"
    >
      <Box
        p={2}
        pr={10}
        borderRadius="md"
        borderWidth="1px"
        flex="1"
        overflowY="auto"
        className="transcription-view"
        css={{
          "&::-webkit-scrollbar": { width: "6px" },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": {
            background: "#CBD5E0",
            borderRadius: "24px",
          },
        }}
      >
        <Text whiteSpace="pre-wrap" fontSize="sm">
          {rawTranscription}
        </Text>
      </Box>

      {/* Reprocess button - overlay bottom right */}
      <Tooltip label="Reprocess transcription" hasArrow placement="top">
        <IconButton
          icon={isTranscribing ? <Spinner size="xs" /> : <FaSync size="14px" />}
          onClick={handleReprocess}
          isDisabled={isTranscribing}
          aria-label="Reprocess"
          size="md"
          position="absolute"
          bottom="25px"
          right="4px"
          variant="ghost"
          opacity={0.6}
          _hover={{ opacity: 1 }}
        />
      </Tooltip>

      {transcriptionDuration && (
        <HStack
          fontSize="xs"
          color="gray.500"
          spacing={3}
          justify="flex-end"
          mt={1}
        >
          <Tooltip label="Time taken to transcribe the audio">
            <HStack>
              <Box as={FaClock} size="10px" />
              <Text>{transcriptionDuration}s</Text>
            </HStack>
          </Tooltip>
          <Tooltip label="Time taken to process and analyze">
            <HStack>
              <Box as={FaCogs} size="10px" />
              <Text>{processDuration}s</Text>
            </HStack>
          </Tooltip>
        </HStack>
      )}
    </Box>
  );
};

const Scribe = ({
  isTranscriptionCollapsed,
  toggleTranscriptionCollapse,
  handleTranscriptionComplete,
  handleDocumentComplete,
  transcriptionDuration,
  processDuration,
  name,
  dob,
  gender,
  config,
  prompts,
  setLoading,
  previousVisitSummary,
  template,
  patientId,
  reasoning,
  rawTranscription,
  isTranscribing,
  toggleDocumentField,
  replacedFields,
  extractedDocData,
  resetDocumentState,
  docFileName,
  setDocFileName,
}) => {
  const [tabIndex, setTabIndex] = useState(0);
  const [isAmbient, setIsAmbient] = useState(true);

  // Recording state and controls
  const recording = useRecording({
    name,
    dob,
    gender,
    templateKey: template?.template_key,
    isAmbient,
    onTranscriptionComplete: handleTranscriptionComplete,
    setLoading,
  });

  // Transcription API
  const { transcribeAudio, isTranscribing: apiTranscribing } = useTranscription(
    (data) => {
      handleTranscriptionComplete({
        fields: data.fields,
        rawTranscription: data.rawTranscription,
        transcriptionDuration: data.transcriptionDuration,
        processDuration: data.processDuration,
      });
    },
    setLoading,
  );

  // File input ref for drag-and-drop
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Fetch user settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        await settingsService.fetchUserSettings((data) => {
          if (data && typeof data.scribe_is_ambient === "boolean") {
            setIsAmbient(data.scribe_is_ambient);
          }
        });
      } catch (error) {
        console.error("Error fetching user settings:", error);
      }
    };
    fetchSettings();
  }, []);

  // Reset tab when patient changes
  useEffect(() => {
    setTabIndex(0);
  }, [name, dob]);

  const handleScribeModeChange = async (e) => {
    const newValue = e.target.value === "ambient";
    setIsAmbient(newValue);
    try {
      await settingsService.saveAmbientMode(newValue);
    } catch (error) {
      console.error("Failed to save ambient mode setting:", error);
    }
  };

  // Send recording for transcription
  const handleSendRecording = async () => {
    const audioBlob = await recording.stopRecording();
    if (!audioBlob) return;

    try {
      await transcribeAudio(
        audioBlob,
        { name, gender, dob, templateKey: template?.template_key },
        isAmbient,
      );
    } catch (error) {
      console.error("Transcription failed:", error);
    }
  };

  // Handle audio file drop
  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith("audio/")) {
      // Not an audio file, ignore
      return;
    }

    try {
      await transcribeAudio(
        file,
        { name, gender, dob, templateKey: template?.template_key },
        isAmbient,
      );
    } catch (error) {
      console.error("Audio file transcription failed:", error);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    // Check if dragging an audio file
    if (e.dataTransfer?.types?.includes("Files")) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const documentProps = {
    handleDocumentComplete: (data) => {
      handleDocumentComplete(data);
    },
    name,
    dob,
    gender,
    setLoading,
    template,
    docFileName,
    setDocFileName,
    toggleDocumentField,
    replacedFields,
    extractedDocData,
    resetDocumentState,
  };

  const isLoading = isTranscribing || apiTranscribing;

  return (
    <Box p="4" borderRadius="sm" className="panels-bg">
      {/* Header Row - always visible */}
      <Flex
        align="center"
        justify="space-between"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        borderRadius={isDragOver ? "md" : undefined}
        border={isDragOver ? "2px dashed" : undefined}
        borderColor={isDragOver ? "primaryButton" : undefined}
        bg={isDragOver ? "rgba(255,107,53,0.1)" : undefined}
        transition="all 0.2s"
      >
        <Flex align="center">
          <IconButton
            icon={
              isTranscriptionCollapsed ? (
                <ChevronRightIcon />
              ) : (
                <ChevronDownIcon />
              )
            }
            onClick={toggleTranscriptionCollapse}
            aria-label="Toggle collapse"
            variant="outline"
            size="sm"
            mr="2"
            className="collapse-toggle"
          />
          <HStack spacing={2}>
            <FaMicrophone size="1.2em" />
            <Text as="h3">AI Scribe</Text>
          </HStack>
        </Flex>

        {/* Center - Recording controls */}
        <Flex align="center" flex="1" justify="center">
          <InlineRecordingControls
            isRecording={recording.isRecording}
            isPaused={recording.isPaused}
            timer={recording.timer}
            onStart={recording.startRecording}
            onPause={recording.pauseRecording}
            onResume={recording.resumeRecording}
            onSend={handleSendRecording}
            onReset={recording.resetRecording}
            isLoading={isLoading}
          />
        </Flex>

        {/* Right - Ambient/Dictate selector */}
        <Tooltip
          label={
            isAmbient
              ? "Ambient: listen during the visit and generate the note from the conversation."
              : "Dictate: after the visit, dictate your summary and we'll turn it into a note."
          }
          aria-label="Scribe mode tooltip"
        >
          <Box>
            <Flex alignItems="center">
              {isAmbient ? (
                <FaComments
                  style={{ marginRight: "8px" }}
                  className="pill-box-icons"
                />
              ) : (
                <FaKeyboard
                  style={{ marginRight: "8px" }}
                  className="pill-box-icons"
                />
              )}
              <Select
                value={isAmbient ? "ambient" : "dictate"}
                onChange={handleScribeModeChange}
                size="sm"
                width={["110px", "140px", "160px"]}
                className="input-style"
              >
                <option value="ambient">Ambient</option>
                <option value="dictate">Dictate</option>
              </Select>
            </Flex>
          </Box>
        </Tooltip>
      </Flex>

      {/* Collapsible content - tabs with transcription and document */}
      <Collapse in={!isTranscriptionCollapsed}>
        <Tabs
          variant="enclosed"
          mt="3"
          index={tabIndex}
          onChange={(index) => setTabIndex(index)}
          size="sm"
        >
          <TabList>
            {rawTranscription && (
              <Tab className="tab-style">
                <HStack>
                  <FaMicrophone />
                  <Text>Transcription</Text>
                </HStack>
              </Tab>
            )}
            {isChatEnabled() && (
              <Tab className="tab-style">
                <HStack>
                  <FaFileUpload />
                  <Text>Document</Text>
                </HStack>
              </Tab>
            )}
          </TabList>
          <TabPanels>
            {rawTranscription && (
              <TabPanel
                className="floating-main"
                p={2}
                minH="200px"
                display="flex"
                flexDirection="column"
              >
                <TranscriptionView
                  rawTranscription={rawTranscription}
                  transcriptionDuration={transcriptionDuration}
                  processDuration={processDuration}
                  isTranscribing={isLoading}
                  onReprocess={handleTranscriptionComplete}
                  isAmbient={isAmbient}
                  name={name}
                  gender={gender}
                  dob={dob}
                  templateKey={template?.template_key}
                />
              </TabPanel>
            )}

            {isChatEnabled() && (
              <TabPanel className="floating-main" p={2} minH="200px">
                <DocumentUploadTab
                  handleDocumentComplete={handleDocumentComplete}
                  name={name}
                  dob={dob}
                  gender={gender}
                  setLoading={setLoading}
                  template={template}
                  {...documentProps}
                />
              </TabPanel>
            )}
          </TabPanels>
        </Tabs>
      </Collapse>

      {/* Hidden file input for audio drag-and-drop */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        style={{ display: "none" }}
      />
    </Box>
  );
};

export default Scribe;
