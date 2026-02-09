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
} from "@chakra-ui/react";
import { ChevronDownIcon, ChevronRightIcon } from "@chakra-ui/icons";
import {
  FaMicrophone,
  FaFileUpload,
  FaHistory,
  FaAtom,
  FaComments,
  FaKeyboard,
} from "react-icons/fa";
import { useEffect, useState } from "react";
import VoiceInputTab from "./ScribeTabs/VoiceInputTab";
import DocumentUploadTab from "./ScribeTabs/DocumentUploadTab";
import PreviousVisitTab from "./ScribeTabs/PreviousVisitTab";
import ReasoningTab from "./ScribeTabs/ReasoningTab";
import { settingsService } from "../../utils/settings/settingsUtils";
import { isChatEnabled } from "../../utils/helpers/featureFlags";

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
  const [mode, setMode] = useState("record");
  const [isAmbient, setIsAmbient] = useState(true);

  useEffect(() => {
    setTabIndex(0); // Reset to Voice Input tab
  }, [name, dob]); // Dependencies that indicate a patient change

  // Fetch user settings on mount to get the preferred ambient mode
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

  const handleScribeModeChange = async (e) => {
    const newValue = e.target.value === "ambient";
    setIsAmbient(newValue);
    try {
      await settingsService.saveAmbientMode(newValue);
    } catch (error) {
      console.error("Failed to save ambient mode setting:", error);
    }
  };

  const recordingProps = {
    mode,
    onTranscriptionComplete: (data) => {
      const processedData = {
        fields: data.fields,
        rawTranscription: data.rawTranscription,
        transcriptionDuration: data.transcriptionDuration,
        processDuration: data.processDuration,
      };
      handleTranscriptionComplete(processedData);
    },
    name,
    dob,
    gender,
    config,
    prompts,
    setLoading,
    templateKey: template?.template_key,
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

  return (
    <Box p="4" borderRadius="sm" className="panels-bg">
      <Flex align="center" justify="space-between">
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

      <Collapse in={!isTranscriptionCollapsed}>
        <Tabs
          variant="enclosed"
          mt="4"
          index={tabIndex}
          onChange={(index) => setTabIndex(index)}
        >
          <TabList>
            <Tooltip label="Record a patient encounter.">
              <Tab className="tab-style">
                <HStack>
                  <FaMicrophone />
                  <Text>Voice Input</Text>
                </HStack>
              </Tab>
            </Tooltip>
            {isChatEnabled() && (
              <Tooltip label="Upload a referral document to transcribe.">
                <Tab className="tab-style">
                  <HStack>
                    <FaFileUpload />
                    <Text>Document Upload</Text>
                  </HStack>
                </Tab>
              </Tooltip>
            )}
            {previousVisitSummary && (
              <Tooltip label="View a brief summary of the previous visit.">
                <Tab className="tab-style">
                  <HStack>
                    <FaHistory />
                    <Text>Previous Visit</Text>
                  </HStack>
                </Tab>
              </Tooltip>
            )}
            {isChatEnabled() &&
              patientId && ( // show reasoning tab only if patient has an ID and chat is enabled
                <Tooltip label="Run clinical reasoning analysis.">
                  <Tab className="tab-style">
                    <HStack>
                      <FaAtom />
                      <Text>Reasoning</Text>
                    </HStack>
                  </Tab>
                </Tooltip>
              )}
          </TabList>
          <TabPanels>
            <TabPanel className="floating-main">
              <VoiceInputTab
                mode={mode}
                setMode={setMode}
                isAmbient={isAmbient}
                recordingProps={recordingProps}
                transcriptionDuration={transcriptionDuration}
                processDuration={processDuration}
                rawTranscription={rawTranscription}
                onTranscriptionComplete={handleTranscriptionComplete}
                isTranscribing={isTranscribing}
                setLoading={setLoading}
              />
            </TabPanel>

            {isChatEnabled() && (
              <TabPanel className="floating-main">
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

            {previousVisitSummary && (
              <TabPanel className="floating-main">
                <PreviousVisitTab previousVisitSummary={previousVisitSummary} />
              </TabPanel>
            )}

            {isChatEnabled() && patientId && (
              <TabPanel className="floating-main">
                <ReasoningTab patientId={patientId} reasoning={reasoning} />
              </TabPanel>
            )}
          </TabPanels>
        </Tabs>
      </Collapse>
    </Box>
  );
};

export default Scribe;
