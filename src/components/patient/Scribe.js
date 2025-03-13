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
} from "@chakra-ui/react";
import { ChevronDownIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { FaMicrophone, FaFileUpload, FaHistory, FaAtom } from "react-icons/fa";
import { useEffect, useState } from "react";
import VoiceInputTab from "./ScribeTabs/VoiceInputTab";
import DocumentUploadTab from "./ScribeTabs/DocumentUploadTab";
import PreviousVisitTab from "./ScribeTabs/PreviousVisitTab";
import ReasoningTab from "./ScribeTabs/ReasoningTab";

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

    useEffect(() => {
        setTabIndex(0); // Reset to Voice Input tab
    }, [name, dob]); // Dependencies that indicate a patient change

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
                        <Tooltip label="Upload a referral document to transcribe.">
                            <Tab className="tab-style">
                                <HStack>
                                    <FaFileUpload />
                                    <Text>Document Upload</Text>
                                </HStack>
                            </Tab>
                        </Tooltip>
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
                        {patientId && ( // show reasoning tab only if patient has an ID
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
                        <TabPanel className="chat-main">
                            <VoiceInputTab
                                mode={mode}
                                setMode={setMode}
                                recordingProps={recordingProps}
                                transcriptionDuration={transcriptionDuration}
                                processDuration={processDuration}
                                rawTranscription={rawTranscription}
                                onTranscriptionComplete={
                                    handleTranscriptionComplete
                                }
                                isTranscribing={isTranscribing}
                                setLoading={setLoading}
                            />
                        </TabPanel>

                        <TabPanel className="chat-main">
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

                        {previousVisitSummary && (
                            <TabPanel className="chat-main">
                                <PreviousVisitTab
                                    previousVisitSummary={previousVisitSummary}
                                />
                            </TabPanel>
                        )}

                        {patientId && (
                            <TabPanel className="chat-main">
                                <ReasoningTab
                                    patientId={patientId}
                                    reasoning={reasoning}
                                />
                            </TabPanel>
                        )}
                    </TabPanels>
                </Tabs>
            </Collapse>
        </Box>
    );
};

export default Scribe;
