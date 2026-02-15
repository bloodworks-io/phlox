import {
  Box,
  VStack,
  useClipboard,
  useToast,
  Spinner,
  Center,
} from "@chakra-ui/react";
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  useTemplate,
  useTemplateSelection,
} from "../utils/templates/templateContext";
import PatientInfoBar from "../components/patient/PatientInfoBar";
import Scribe, { useScribe } from "../components/patient/Scribe";
import Summary from "../components/patient/Summary";
import Chat from "../components/panels/chat/Chat";
import Letter from "../components/panels/letter/Letter";
import ReasoningPanel from "../components/panels/reasoning/ReasoningPanel";
import ScribePillBox from "../components/patient/ScribePillBox";
import FloatingActionMenu from "../components/common/FloatingActionMenu";
import TranscriptionPanel from "../components/panels/transcription/TranscriptionPanel";
import DocumentPanel from "../components/panels/document/DocumentPanel";
import PreviousVisitPanel from "../components/panels/previous-visit/PreviousVisitPanel";
import { usePatient } from "../utils/hooks/usePatient";
import { useCollapse } from "../utils/hooks/useCollapse";
import { useChat } from "../utils/hooks/useChat";
import { useLetter } from "../utils/hooks/useLetter";
import { useReasoning } from "../utils/hooks/useReasoning";
import { handleProcessingComplete } from "../utils/helpers/processingHelpers";
import { useToastMessage } from "../utils/hooks/UseToastMessage";

const PatientDetails = ({
  patient: initialPatient,
  setPatient: setInitialPatient,
  selectedDate,
  refreshSidebar,
  setIsModified: setParentIsModified,
  onResetLetter,
}) => {
  const location = useLocation();
  const isNewPatient = location.pathname === "/new-patient";
  const toast = useToast();
  const summaryRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isSearchedPatient, setIsSearchedPatient] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const hasDefaultTemplateBeenSet = useRef(false);
  const navigate = useNavigate();
  const [saveLoading, setSaveLoading] = useState(false);
  const [isLetterModified, setIsLetterModified] = useState(false);
  const [isSummaryModified, setIsSummaryModified] = useState(false);
  const previousTranscriptionRef = useRef(null);
  const [docFileName, setDocFileName] = useState("");

  const [originalContent, setOriginalContent] = useState({});
  const [replacedFields, setReplacedFields] = useState({});
  const [extractedDocData, setExtractedDocData] = useState(null);

  const [initialTranscriptionContent, setInitialTranscriptionContent] =
    useState({});
  const [hasTranscriptionOccurred, setHasTranscriptionOccurred] =
    useState(false);

  // Panel states for new FAB actions
  const [isTranscriptionPanelOpen, setIsTranscriptionPanelOpen] =
    useState(false);
  const [isDocumentPanelOpen, setIsDocumentPanelOpen] = useState(false);
  const [isPreviousVisitPanelOpen, setIsPreviousVisitPanelOpen] =
    useState(false);

  const { showWarningToast } = useToastMessage();

  // Use template context
  const {
    currentTemplate,
    isTemplateChanging,
    defaultTemplate,
    templates,
    status: templateStatus,
    error: templateError,
    selectTemplate,
  } = useTemplateSelection();

  // Custom hooks
  const {
    patient,
    setPatient,
    setIsModified,
    savePatient,
    searchPatient,
    loadPatientDetails,
  } = usePatient(initialPatient, setInitialPatient);

  // Scribe hook for recording controls
  const scribeControls = useScribe({
    name: patient?.name,
    dob: patient?.dob,
    gender: patient?.gender,
    template: currentTemplate,
    handleTranscriptionComplete: (data) => handleTranscriptionComplete(data),
    setLoading,
  });

  const handleChatToggle = (isOpen) => {
    if (isOpen) {
      // If chat is opening, close other panels
      if (!letter.isCollapsed) letter.setIsCollapsed(true);
      if (reasoning.isReasoningOpen) reasoning.closeReasoning();
      closeAllFloatingPanels();
    }
  };

  const handleLetterToggle = (isOpen) => {
    if (isOpen) {
      // If letter is opening, close other panels
      if (chat.chatExpanded) chat.setChatExpanded(false);
      if (reasoning.isReasoningOpen) reasoning.closeReasoning();
      closeAllFloatingPanels();
    }
  };

  const handleReasoningToggle = (isOpen) => {
    if (isOpen) {
      // If reasoning is opening, close other panels
      if (chat.chatExpanded) chat.setChatExpanded(false);
      if (!letter.isCollapsed) letter.setIsCollapsed(true);
      closeAllFloatingPanels();
    }
    if (isOpen) {
      reasoning.openReasoning();
    } else {
      reasoning.closeReasoning();
    }
  };

  // Close all floating panels (transcription, document, previous visit)
  const closeAllFloatingPanels = () => {
    setIsTranscriptionPanelOpen(false);
    setIsDocumentPanelOpen(false);
    setIsPreviousVisitPanelOpen(false);
  };

  const summary = useCollapse(false);
  const letterHook = useLetter(setIsModified);
  const letter = useCollapse(true);
  const chat = useChat();
  const reasoning = useReasoning();
  const { refreshTemplates } = useTemplate();

  // Refresh templates for new patients
  useEffect(() => {
    refreshTemplates();
  }, [refreshTemplates]);

  // Handle template errors
  useEffect(() => {
    if (templateError) {
      toast({
        title: "Template Error",
        description: templateError,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  }, [templateError, toast]);

  // Effect to handle search results
  useEffect(() => {
    if (searchResult) {
      const preservedTemplateData = searchResult.template_data || {};

      setPatient((prev) => ({
        ...prev,
        ...searchResult,
        template_data: {
          ...preservedTemplateData,
        },
        isNewEncounter: true,
      }));

      if (searchResult.template_key) {
        selectTemplate(searchResult.template_key);
      }

      setIsSearchedPatient(true);
      setSearchResult(null);
    }
  }, [searchResult, setPatient, selectTemplate]);

  useEffect(() => {
    if (!isNewPatient) {
      setIsSearchedPatient(false);
      console.log("Resetting isSearchedPatient - viewing historical patient");
    }
  }, [location.pathname]);

  useEffect(() => {
    if (isNewPatient && !patient?.id) {
      setIsSearchedPatient(false);
      console.log("Resetting isSearchedPatient - new patient");
    }
  }, [isNewPatient, patient?.id]);

  // Handle template consistency for already saved (historical) encounters
  useEffect(() => {
    if (!currentTemplate || !patient || isTemplateChanging) return;

    const shouldLockTemplate = !isNewPatient && !patient.isNewEncounter;

    if (
      shouldLockTemplate &&
      currentTemplate.template_key !== patient.template_key
    ) {
      selectTemplate(patient.template_key, "Maintaining historical template");
    }
  }, [
    currentTemplate,
    patient,
    isNewPatient,
    selectTemplate,
    isTemplateChanging,
  ]);

  // Set default template for new patients
  useEffect(() => {
    const initializeNewPatient = async () => {
      if (isNewPatient && defaultTemplate && !patient?.template_key) {
        if (!hasDefaultTemplateBeenSet.current && !patient?.template_key) {
          hasDefaultTemplateBeenSet.current = true;
          try {
            await selectTemplate(defaultTemplate.template_key);
            setPatient((prev) => ({
              ...prev,
              template_key: defaultTemplate.template_key,
            }));
          } catch (error) {
            console.error("Failed to set default template:", error);
            toast({
              title: "Error",
              description: "Failed to set default template",
              status: "error",
              duration: 3000,
              isClosable: true,
            });
          }
        }
      }
    };
    initializeNewPatient();
  }, [
    isNewPatient,
    defaultTemplate,
    patient,
    selectTemplate,
    setPatient,
    toast,
  ]);

  // Handle template data for historical patients
  useEffect(() => {
    if (
      !isNewPatient &&
      initialPatient &&
      currentTemplate &&
      !isSearchLoading
    ) {
      const newTemplateData = {};
      currentTemplate.fields.forEach((field) => {
        newTemplateData[field.field_key] =
          initialPatient.template_data?.[field.field_key] || "";
      });

      setPatient((prev) => ({
        ...prev,
        template_data: newTemplateData,
        isHistorical: true,
      }));
    }
  }, [
    isNewPatient,
    initialPatient,
    currentTemplate,
    setPatient,
    isSearchLoading,
  ]);

  const { onCopy: handleCopy, hasCopied: recentlyCopied } = useClipboard(
    patient && currentTemplate?.fields
      ? currentTemplate.fields
          .map(
            (field) =>
              `${field.field_name}:\n${
                patient.template_data?.[field.field_key] || ""
              }`,
          )
          .join("\n\n")
      : "",
  );

  useEffect(() => {
    // Reset component states when patient changes
    summary.setIsCollapsed(false);
    letter.setIsCollapsed(true);
    chat.setChatExpanded(false);
    closeAllFloatingPanels();
    chat.clearChat();
    resetDocumentState();
  }, [patient?.id, currentTemplate, isNewPatient]);

  useEffect(() => {
    if (patient?.id) {
      letterHook.loadLetter(patient.id, toast);
    }
  }, [patient?.id]);

  useEffect(() => {
    if (onResetLetter) {
      onResetLetter(letterHook.resetLetter);
    }
  }, [onResetLetter, letterHook.resetLetter]);

  useEffect(() => {
    setParentIsModified(isLetterModified || isSummaryModified);
  }, [isLetterModified, isSummaryModified, setParentIsModified]);

  useEffect(() => {
    toast.closeAll();
  }, [toast]);

  const handleTranscriptionComplete = (data, triggerResize = false) => {
    const isReprocessing = !!patient?.raw_transcription;
    const isRestoration = data.isRestoration === true;
    previousTranscriptionRef.current = patient?.raw_transcription;
    console.log("Transcription complete!");

    if (
      !hasTranscriptionOccurred &&
      data.fields &&
      Object.keys(data.fields).length > 0 &&
      !isRestoration
    ) {
      console.log(
        "Storing initial transcription content for adaptive refinement:",
        data.fields,
      );
      setInitialTranscriptionContent({ ...data.fields });
      setHasTranscriptionOccurred(true);
    }

    handleProcessingComplete(data, {
      setLoading,
      setters: {
        template_data: (value) => {
          console.log("Setting template_data with:", data.fields);
          setPatient((prev) => ({
            ...prev,
            template_data: {
              ...prev.template_data,
              ...data.fields,
            },
          }));
        },
        rawTranscription: (value) =>
          setPatient((prev) => ({
            ...prev,
            raw_transcription: data.rawTranscription,
          })),
        transcriptionDuration: (value) =>
          setPatient((prev) => ({
            ...prev,
            transcription_duration: data.transcriptionDuration,
          })),
        processDuration: (value) =>
          setPatient((prev) => ({
            ...prev,
            process_duration: data.processDuration,
          })),
      },
      setIsSourceCollapsed: () => {},
      setIsSummaryCollapsed: () => summary.setIsCollapsed(false),
      triggerResize,
      summaryRef,
    });
  };

  const handleDocumentComplete = (data) => {
    if (!data.fieldByField) {
      if (!extractedDocData) {
        setOriginalContent({ ...patient.template_data });
      }

      setExtractedDocData(data);

      toast({
        title: "Document processed",
        description: "Use the toggle buttons to update fields",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } else {
      const fieldKey = Object.keys(data.fields)[0];

      setReplacedFields((prev) => ({
        ...prev,
        [fieldKey]: !prev[fieldKey],
      }));

      setPatient((prev) => ({
        ...prev,
        template_data: {
          ...prev.template_data,
          ...data.fields,
        },
      }));

      setIsModified(true);
    }
  };

  const toggleDocumentField = (fieldKey) => {
    if (!extractedDocData) return;

    const hasExtractedContent = Boolean(
      extractedDocData.fields[fieldKey]?.trim(),
    );
    if (!hasExtractedContent) {
      toast({
        title: "No content available",
        description:
          "This field doesn't have any content in the uploaded document",
        status: "info",
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    const isCurrentlyReplaced = replacedFields[fieldKey];

    let fieldContent;
    if (isCurrentlyReplaced) {
      fieldContent = originalContent[fieldKey] || "";
    } else {
      fieldContent = extractedDocData.fields[fieldKey] || "";
    }

    handleDocumentComplete({
      fields: { [fieldKey]: fieldContent },
      fieldByField: true,
    });
  };

  const resetDocumentState = () => {
    setExtractedDocData(null);
    setReplacedFields({});
    setOriginalContent({});
    setDocFileName("");
  };

  const handleGenerateLetterClick = async (additionalInstructions) => {
    if (!patient) return;

    letter.setIsCollapsed(false);
    chat.setChatExpanded(false);
    closeAllFloatingPanels();

    await letterHook.generateLetter(
      patient,
      additionalInstructions,
      toast,
      letterHook.setFinalCorrespondence,
    );
  };

  const handleSavePatientData = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    try {
      if (location.pathname === "/new-patient") {
        const savedPatient = await savePatient(
          refreshSidebar,
          selectedDate,
          toast,
          hasTranscriptionOccurred ? initialTranscriptionContent : null,
        );
        if (savedPatient?.id) {
          setIsSummaryModified(false);
          setInitialTranscriptionContent({});
          setHasTranscriptionOccurred(false);
          navigate(`/patient/${savedPatient.id}`);
        }
      } else {
        await savePatient(
          refreshSidebar,
          selectedDate,
          toast,
          hasTranscriptionOccurred ? initialTranscriptionContent : null,
        );
        setIsSummaryModified(false);
        setInitialTranscriptionContent({});
        setHasTranscriptionOccurred(false);
      }
    } finally {
      setSaveLoading(false);
    }
  };

  const handleLetterChange = (newValue) => {
    letterHook.setFinalCorrespondence(newValue);
    setIsModified(true);
    setParentIsModified(true);
  };

  const handleLetterSave = async () => {
    await letterHook.saveLetter(patient.id);
    setIsLetterModified(false);
  };

  const handleSearch = async (urNumber) => {
    setIsSearchLoading(true);
    try {
      const result = await searchPatient(urNumber, selectedDate);
      if (result) {
        setSearchResult(result);
        setIsSearchedPatient(true);
        summary.setIsCollapsed(false);
        console.log("Setting isSearchedPatient to true - search successful");
      }
    } finally {
      setIsSearchLoading(false);
    }
  };

  useEffect(() => {
    setIsLetterModified(false);
    setIsSummaryModified(false);
    setParentIsModified(false);
  }, [initialPatient?.id, setParentIsModified]);

  useEffect(() => {
    const handleHistoricalTemplate = async () => {
      if (!isNewPatient && !isSearchedPatient) {
        console.log("Viewing historical encounter - keeping original template");
        return;
      }

      if (
        patient?.template_key &&
        defaultTemplate?.template_key &&
        patient?.template_key !== defaultTemplate?.template_key &&
        templates?.length > 0 &&
        (isNewPatient || isSearchedPatient)
      ) {
        const activeTemplate = templates.find(
          (t) => t.template_key === patient.template_key,
        );

        if (!activeTemplate) {
          console.warn("Pre-fill template is not active. Finding fallback...");
          const baseKey = patient.template_key.split("_")[0];
          const latestVersion = templates
            .filter((t) => t.template_key.startsWith(baseKey))
            .sort((a, b) => b.template_key.localeCompare(a.template_key))[0];

          const fallback = latestVersion || defaultTemplate || templates[0];

          if (fallback) {
            console.log(
              `Upgrading pre-fill template to: ${fallback.template_key}`,
            );

            setPatient((prev) => ({
              ...prev,
              template_key: fallback.template_key,
              template_data: {
                ...prev.template_data,
              },
            }));

            await selectTemplate(fallback.template_key);

            if (
              fallback.template_key !== patient.template_key &&
              isSearchedPatient
            ) {
              showWarningToast(
                `Using ${fallback.template_name} template for this new encounter.`,
              );
            }
          }
        }
      }
    };

    handleHistoricalTemplate();
  }, [
    isNewPatient,
    isSearchedPatient,
    patient?.template_key,
    defaultTemplate?.template_key,
    templates,
    defaultTemplate,
    selectTemplate,
    setPatient,
    showWarningToast,
  ]);

  // Functions for the Floating Action Menu
  const handleOpenLetter = () => {
    if (!letter.isCollapsed) {
      // Letter is open, close it
      letter.setIsCollapsed(true);
    } else {
      // Letter is closed, open it and close others
      closeAllFloatingPanels();
      letter.setIsCollapsed(false);
      chat.setChatExpanded(false);
      reasoning.closeReasoning();
    }
  };

  const handleOpenChat = () => {
    if (chat.chatExpanded) {
      // Chat is open, close it
      chat.setChatExpanded(false);
    } else {
      // Chat is closed, open it and close others
      closeAllFloatingPanels();
      chat.setChatExpanded(true);
      letter.setIsCollapsed(true);
      reasoning.closeReasoning();
    }
  };

  const handleOpenReasoning = () => {
    if (reasoning.isReasoningOpen) {
      // Reasoning is open, close it
      reasoning.closeReasoning();
    } else {
      // Reasoning is closed, open it and close others
      closeAllFloatingPanels();
      reasoning.openReasoning();
      chat.setChatExpanded(false);
      letter.setIsCollapsed(true);
    }
  };

  const handleOpenTranscription = () => {
    if (isTranscriptionPanelOpen) {
      // Transcription is open, close it
      setIsTranscriptionPanelOpen(false);
    } else {
      // Transcription is closed, open it and close others
      setIsTranscriptionPanelOpen(true);
      setIsDocumentPanelOpen(false);
      setIsPreviousVisitPanelOpen(false);
      letter.setIsCollapsed(true);
      chat.setChatExpanded(false);
      reasoning.closeReasoning();
    }
  };

  const handleOpenDocument = () => {
    if (isDocumentPanelOpen) {
      // Document is open, close it
      setIsDocumentPanelOpen(false);
    } else {
      // Document is closed, open it and close others
      setIsTranscriptionPanelOpen(false);
      setIsDocumentPanelOpen(true);
      setIsPreviousVisitPanelOpen(false);
      letter.setIsCollapsed(true);
      chat.setChatExpanded(false);
      reasoning.closeReasoning();
    }
  };

  const handleOpenPreviousVisit = () => {
    if (isPreviousVisitPanelOpen) {
      // Previous Visit is open, close it
      setIsPreviousVisitPanelOpen(false);
    } else {
      // Previous Visit is closed, open it and close others
      setIsTranscriptionPanelOpen(false);
      setIsDocumentPanelOpen(false);
      setIsPreviousVisitPanelOpen(true);
      letter.setIsCollapsed(true);
      chat.setChatExpanded(false);
      reasoning.closeReasoning();
    }
  };

  if (!patient) {
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  return (
    <Box p={[2, 4, 5]} borderRadius="sm" w="100%" pb="100px">
      <VStack spacing={[3, 4, 5]} align="stretch">
        <PatientInfoBar
          patient={patient}
          setPatient={setPatient}
          handleSearch={handleSearch}
          template={currentTemplate}
          templates={templates}
          isNewPatient={isNewPatient}
          isSearchedPatient={isSearchedPatient}
        />

        <Summary
          ref={summaryRef}
          isSummaryCollapsed={summary.isCollapsed}
          toggleSummaryCollapse={summary.toggle}
          patient={patient}
          setPatient={setPatient}
          handleGenerateLetterClick={handleGenerateLetterClick}
          handleSavePatientData={handleSavePatientData}
          saveLoading={saveLoading}
          setIsModified={setIsSummaryModified}
          setParentIsModified={setIsSummaryModified}
          template={currentTemplate}
          selectTemplate={selectTemplate}
          isNewPatient={isNewPatient}
          isSearchedPatient={isSearchedPatient}
          onCopy={handleCopy}
          recentlyCopied={recentlyCopied}
        />

        <Letter
          isOpen={!letter.isCollapsed}
          onClose={() => letter.setIsCollapsed(true)}
          toggleLetterCollapse={letter.toggle}
          finalCorrespondence={letterHook.finalCorrespondence}
          handleSaveLetter={handleLetterSave}
          setFinalCorrespondence={(value) => {
            letterHook.setFinalCorrespondence(value);
            setIsLetterModified(true);
          }}
          handleRefineLetter={(params) => letterHook.refineLetter(params)}
          loading={letterHook.loading}
          handleGenerateLetterClick={handleGenerateLetterClick}
          setIsModified={setIsLetterModified}
          toast={toast}
          patient={patient}
          setLoading={setLoading}
          onLetterToggle={handleLetterToggle}
        />

        <Chat
          isOpen={chat.chatExpanded}
          setChatExpanded={chat.setChatExpanded}
          onClose={() => chat.setChatExpanded(false)}
          chatLoading={chat.loading}
          messages={chat.messages}
          setMessages={chat.setMessages}
          userInput={chat.userInput}
          setUserInput={chat.setUserInput}
          handleChat={(userInput) =>
            chat.sendMessage(
              userInput,
              patient,
              currentTemplate,
              patient.raw_transcription,
            )
          }
          showSuggestions={chat.showSuggestions}
          setShowSuggestions={chat.setShowSuggestions}
          rawTranscription={patient.raw_transcription}
          currentTemplate={currentTemplate}
          patientData={patient}
          onChatToggle={handleChatToggle}
        />

        <ReasoningPanel
          isOpen={reasoning.isReasoningOpen}
          onClose={reasoning.closeReasoning}
          patientId={patient?.id}
          initialReasoning={patient?.reasoning}
        />
      </VStack>

      {/* Scribe Pill Box - centered at bottom */}
      <ScribePillBox
        isRecording={scribeControls.isRecording}
        isPaused={scribeControls.isPaused}
        timer={scribeControls.timer}
        onStart={scribeControls.startRecording}
        onPause={scribeControls.pauseRecording}
        onResume={scribeControls.resumeRecording}
        onSend={scribeControls.stopAndSendRecording}
        onReset={scribeControls.resetRecording}
        isLoading={scribeControls.isLoading}
        isAmbient={scribeControls.isAmbient}
        onModeToggle={scribeControls.toggleAmbientMode}
        onOpenTranscription={handleOpenTranscription}
        isTranscriptionOpen={isTranscriptionPanelOpen}
        hasRawTranscription={!!patient.raw_transcription}
      />

      {/* Floating Action Menu - always expanded on right side */}
      <FloatingActionMenu
        onOpenChat={handleOpenChat}
        onOpenLetter={handleOpenLetter}
        onOpenReasoning={handleOpenReasoning}
        onOpenDocument={handleOpenDocument}
        onOpenPreviousVisit={handleOpenPreviousVisit}
        isChatOpen={chat.chatExpanded}
        isLetterOpen={!letter.isCollapsed}
        isReasoningOpen={reasoning.isReasoningOpen}
        isDocumentOpen={isDocumentPanelOpen}
        isPreviousVisitOpen={isPreviousVisitPanelOpen}
      />

      {/* Transcription Panel */}
      <TranscriptionPanel
        isOpen={isTranscriptionPanelOpen}
        onClose={() => setIsTranscriptionPanelOpen(false)}
        rawTranscription={patient.raw_transcription}
        transcriptionDuration={patient.transcription_duration}
        processDuration={patient.process_duration}
        isTranscribing={loading}
        onReprocess={handleTranscriptionComplete}
        isAmbient={scribeControls.isAmbient}
        name={patient.name}
        gender={patient.gender}
        dob={patient.dob}
        templateKey={currentTemplate?.template_key}
      />

      {/* Document Panel */}
      <DocumentPanel
        isOpen={isDocumentPanelOpen}
        onClose={() => setIsDocumentPanelOpen(false)}
        handleDocumentComplete={handleDocumentComplete}
        toggleDocumentField={toggleDocumentField}
        replacedFields={replacedFields}
        extractedDocData={extractedDocData}
        resetDocumentState={resetDocumentState}
        name={patient.name}
        dob={patient.dob}
        gender={patient.gender}
        setLoading={setLoading}
        template={currentTemplate}
        docFileName={docFileName}
        setDocFileName={setDocFileName}
      />

      {/* Previous Visit Panel */}
      <PreviousVisitPanel
        isOpen={isPreviousVisitPanelOpen}
        onClose={() => setIsPreviousVisitPanelOpen(false)}
        previousVisitSummary={patient.previous_visit_summary}
      />
    </Box>
  );
};

export default PatientDetails;
