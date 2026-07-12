/*
 MIGRATION NOTE: The following Chakra UI hooks have been removed.
 Please replace them with the suggested alternatives:

//   - useClipboard: Use react-use: useCopyToClipboard

 See: https://chakra-ui.com/docs/get-started/migration#hooks
*/
import { Box, VStack, useDisclosure, Spinner, Center } from "@chakra-ui/react";
import { useClipboard } from "../utils/hooks/useClipboard";
import { toaster } from "@/components/ui/toaster";
const toast = toaster.create;
import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router";
import PatientInfoBar from "../components/patient/PatientInfoBar";
import NewNoteStartCard from "../components/patient/NewNoteStartCard";
import { useScribe } from "../components/patient/Scribe";
import Summary from "../components/patient/Summary";
import Chat from "../components/panels/chat/Chat";
import Letter from "../components/panels/letter/Letter";
import ReasoningPanel from "../components/panels/reasoning/ReasoningPanel";
import ScribePillBox from "../components/patient/ScribePillBox";
import FloatingActionMenu from "../components/common/FloatingActionMenu";
import TranscriptionPanel from "../components/panels/transcription/TranscriptionPanel";
import DocumentPanel from "../components/panels/document/DocumentPanel";
import PreviousVisitPanel from "../components/panels/previous-visit/PreviousVisitPanel";
import { usePatientEditor } from "../utils/hooks/usePatientEditor";
import { usePatientTemplate } from "../utils/hooks/usePatientTemplate";
import { useDocumentExtraction } from "../utils/hooks/useDocumentExtraction";
import { patientApi } from "../utils/api/patientApi";
import WrapUpModal from "../components/modals/WrapUpModal";
import DemographicsModal from "../components/modals/DemographicsModal";
import ScribeConsentModal from "../components/modals/ScribeConsentModal";
import { useCollapse } from "../utils/hooks/useCollapse";
import { useChat } from "../utils/hooks/useChat";
import { useLetter } from "../utils/hooks/useLetter";
import { useActivePanel } from "../utils/hooks/useActivePanel";
import { handleProcessingComplete } from "../utils/helpers/processingHelpers";
import { areRequiredDemographicsMet } from "../utils/helpers/validationHelpers";
import { DEFAULT_TOAST_CONFIG } from "../utils/constants";

const PatientDetails = ({
    patient: initialPatient,
    setPatient: setInitialPatient,
    selectedDate,
    refreshSidebar,
    setIsModified: setParentIsModified,
    onResetLetter,
    onStartNewNote,
}) => {
    const location = useLocation();
    const isNewPatient = location.pathname === "/new-note";
    const { viaModal, cameFromSearch } = location.state || {};
    const summaryRef = useRef(null);
    const [loading, setLoading] = useState(false);
    const [isSearchLoading, setIsSearchLoading] = useState(false);
    const [isSearchedPatient, setIsSearchedPatient] = useState(
        Boolean(cameFromSearch),
    );
    const [searchResult, setSearchResult] = useState(null);
    const [startCardDismissed, setStartCardDismissed] = useState(
        Boolean(viaModal),
    );
    const showStartCard =
        isNewPatient && !isSearchedPatient && !startCardDismissed;
    const navigate = useNavigate();
    const [saveLoading, setSaveLoading] = useState(false);
    const [wrapUpLoading, setWrapUpLoading] = useState(false);
    const [isWrapUpOpen, setIsWrapUpOpen] = useState(false);
    const {
        open: isDemographicsOpen,
        onOpen: onOpenDemographics,
        onClose: onCloseDemographics,
    } = useDisclosure();
    const {
        open: isConsentOpen,
        onOpen: onOpenConsent,
        onClose: onCloseConsent,
    } = useDisclosure();
    const [scribeConsent, setScribeConsent] = useState({
        scribe_consent_at: null,
        scribe_consent_declined_at: null,
    });
    const [isLetterModified, setIsLetterModified] = useState(false);
    const [isSummaryModified, setIsSummaryModified] = useState(false);
    const previousTranscriptionRef = useRef(null);

    const [initialTranscriptionContent, setInitialTranscriptionContent] =
        useState({});
    const [hasTranscriptionOccurred, setHasTranscriptionOccurred] =
        useState(false);

    const [hasViewedPreviousVisit, setHasViewedPreviousVisit] = useState(false);

    // Custom hooks
    const {
        patient,
        setPatient,
        setIsModified,
        savePatient,
        savePatientCore,
        searchPatient,
    } = usePatientEditor(initialPatient);

    const { currentTemplate, templates, selectTemplate } = usePatientTemplate({
        patient,
        setPatient,
        isNewPatient,
        isSearchedPatient,
        initialPatient,
        isSearchLoading,
    });

    const {
        extractedDocData,
        replacedFields,
        docFileName,
        setDocFileName,
        handleDocumentComplete,
        toggleDocumentField,
        resetDocumentState,
    } = useDocumentExtraction({ patient, setPatient, setIsModified, toast });

    const requiredDemographicsMet = areRequiredDemographicsMet(patient);

    const { open, toggle, close, closeAll, isOpen } = useActivePanel();

    // Scribe hook for recording controls
    const scribeControls = useScribe({
        name: patient?.name,
        dob: patient?.dob,
        gender: patient?.gender,
        template: currentTemplate,
        noteId: patient?.id,
        handleTranscriptionComplete: (data) =>
            handleTranscriptionComplete(data),
        setLoading,
        onSendStart: () => close("transcription"),
    });

    const hasConsented = Boolean(scribeConsent?.scribe_consent_at);
    const hasDeclined =
        Boolean(scribeConsent?.scribe_consent_declined_at) && !hasConsented;
    const requireConsent =
        scribeControls.isAmbient && scribeControls.requireConsent;
    const canRecord =
        requiredDemographicsMet && !(requireConsent && !hasConsented);

    useEffect(() => {
        const ur = patient?.ur_number;
        if (!ur) {
            setScribeConsent({
                scribe_consent_at: null,
                scribe_consent_declined_at: null,
            });
            return;
        }
        let active = true;
        setScribeConsent({
            scribe_consent_at: null,
            scribe_consent_declined_at: null,
        });
        patientApi
            .fetchScribeConsent(ur)
            .then((data) => {
                if (active) setScribeConsent(data);
            })
            .catch((error) =>
                console.error("Error fetching scribe consent:", error),
            );
        return () => {
            active = false;
        };
    }, [patient?.ur_number]);

    const handleBlockedRecord = () => {
        if (!requiredDemographicsMet) {
            onOpenDemographics();
            return;
        }
        onOpenConsent();
    };

    const handleConsentGranted = async () => {
        const ur = patient?.ur_number;
        if (!ur) return;
        try {
            const data = await patientApi.saveScribeConsent(ur, true);
            setScribeConsent(data);
            onCloseConsent();
            await scribeControls.startRecording();
        } catch (error) {
            toaster.create({
                title: "Could not record consent",
                description: error.message,
                type: "error",
                ...DEFAULT_TOAST_CONFIG,
            });
        }
    };

    const handleConsentDeclined = async () => {
        const ur = patient?.ur_number;
        if (!ur) return;
        try {
            const data = await patientApi.saveScribeConsent(ur, false);
            setScribeConsent(data);
            onCloseConsent();
        } catch (error) {
            toaster.create({
                title: "Could not record decision",
                description: error.message,
                type: "error",
                ...DEFAULT_TOAST_CONFIG,
            });
        }
    };

    const summary = useCollapse(false);
    const letterHook = useLetter(setIsModified);
    const chat = useChat();

    useEffect(() => {
        if (cameFromSearch) summary.setIsCollapsed(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
        if (viaModal) return;
        if (!isNewPatient) {
            setIsSearchedPatient(false);
            console.log(
                "Resetting isSearchedPatient - viewing historical patient",
            );
        }
        setStartCardDismissed(false);
    }, [location.pathname]);

    useEffect(() => {
        if (viaModal) return;
        if (isNewPatient && !patient?.id) {
            setIsSearchedPatient(false);
            setStartCardDismissed(false);
            console.log("Resetting isSearchedPatient - new patient");
        }
    }, [isNewPatient, patient?.id]);

    const textToCopy =
        patient && currentTemplate?.fields
            ? currentTemplate.fields
                  .map(
                      (field) =>
                          `${field.field_name}:\n${
                              patient.template_data?.[field.field_key] || ""
                          }`,
                  )
                  .join("\n\n")
            : "";

    const { onCopy: handleCopy, hasCopied: recentlyCopied } = useClipboard(
        textToCopy,
        { format: "text/plain" },
    );

    useEffect(() => {
        // Reset component states when patient changes
        summary.setIsCollapsed(false);
        closeAll();
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
        toaster.remove();
    }, [toast]);

    const handleTranscriptionComplete = (data, triggerResize = false) => {
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
                template_data: (_value) => {
                    console.log("Setting template_data with:", data.fields);
                    setPatient((prev) => ({
                        ...prev,
                        template_data: {
                            ...prev.template_data,
                            ...data.fields,
                        },
                    }));
                },
                rawTranscription: (_value) =>
                    setPatient((prev) => ({
                        ...prev,
                        raw_transcription: data.rawTranscription,
                    })),
                transcriptionDuration: (_value) =>
                    setPatient((prev) => ({
                        ...prev,
                        transcription_duration: data.transcriptionDuration,
                    })),
                processDuration: (_value) =>
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

    const handleGenerateLetterClick = async (additionalInstructions) => {
        if (!patient) return;

        open("letter");

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
            if (location.pathname === "/new-note") {
                const savedPatient = await savePatient(
                    refreshSidebar,
                    selectedDate,
                    toast,
                    hasTranscriptionOccurred
                        ? initialTranscriptionContent
                        : null,
                );
                if (savedPatient?.id) {
                    setIsSummaryModified(false);
                    setInitialTranscriptionContent({});
                    setHasTranscriptionOccurred(false);
                    navigate(`/note/${savedPatient.id}`);
                }
            } else {
                await savePatient(
                    refreshSidebar,
                    selectedDate,
                    toast,
                    hasTranscriptionOccurred
                        ? initialTranscriptionContent
                        : null,
                );
                setIsSummaryModified(false);
                setInitialTranscriptionContent({});
                setHasTranscriptionOccurred(false);
            }
        } finally {
            setSaveLoading(false);
        }
    };

    const handleOpenWrapUp = () => {
        const missingFields = [];
        if (!patient?.name) missingFields.push("Name");
        if (!patient?.dob) missingFields.push("Date of Birth");
        if (!patient?.ur_number) missingFields.push("UR Number");
        if (!patient?.gender) missingFields.push("Gender");

        if (missingFields.length > 0) {
            toaster.create({
                title: "Missing Required Fields",
                description: `Please fill in the following required fields: ${missingFields.join(", ")}`,
                type: "error",
                duration: 3000,
            });
            return;
        }
        setIsWrapUpOpen(true);
    };

    const handleWrapUpConfirm = async (curatedJobs) => {
        setWrapUpLoading(true);
        try {
            const saved = await savePatientCore(
                refreshSidebar,
                selectedDate,
                toast,
                hasTranscriptionOccurred ? initialTranscriptionContent : null,
            );
            if (!saved) {
                return;
            }
            const noteId = saved.id ?? patient.id;

            try {
                await patientApi.updateJobsList(noteId, curatedJobs);
            } catch (jobsErr) {
                console.error("Failed to write curated jobs:", jobsErr);
                toaster.create({
                    title: "Jobs not saved",
                    description:
                        "The note was saved, but the curated jobs couldn't be written. Please try again.",
                    type: "warning",
                    duration: 5000,
                });
                return;
            }
            setIsSummaryModified(false);
            setInitialTranscriptionContent({});
            setHasTranscriptionOccurred(false);
            setIsWrapUpOpen(false);
            setIsSearchedPatient(false);
            setStartCardDismissed(false);
            await onStartNewNote();
            navigate("/new-note");
        } catch (error) {
            console.error("Error during wrap up:", error);
            // savePatientCore surfaces its own toast on save failure; keep modal open.
        } finally {
            setWrapUpLoading(false);
        }
    };

    const handleLetterSave = async () => {
        await letterHook.saveLetter(patient.id);
        setIsLetterModified(false);
    };

    const handleDemographicsSave = async (updatedPatient) => {
        setInitialPatient(updatedPatient);
        if (!updatedPatient.id) return;
        await patientApi.savePatientData(
            { patientData: updatedPatient },
            toast,
            refreshSidebar,
        );
    };

    const handleSearch = async (urNumber) => {
        const query = (urNumber || "").trim();
        if (!query) {
            toaster.create({
                title: "Enter a UR number",
                description:
                    "Type a UR number, then click search to find an existing patient.",
                type: "warning",
                ...DEFAULT_TOAST_CONFIG,
            });
            return;
        }

        setIsSearchLoading(true);
        try {
            const result = await searchPatient(query, selectedDate);
            if (result) {
                setSearchResult(result);
                setIsSearchedPatient(true);
                summary.setIsCollapsed(false);
                console.log(
                    "Setting isSearchedPatient to true - search successful",
                );
            } else {
                toaster.create({
                    title: "No patient found",
                    description: `No patient matches UR number "${query}". Fill in their details to create a new record.`,
                    type: "info",
                    ...DEFAULT_TOAST_CONFIG,
                });
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

    // Functions for the Floating Action Menu
    const handleOpenLetter = () => toggle("letter");
    const handleOpenChat = () => toggle("chat");
    const handleOpenReasoning = () => toggle("reasoning");
    const handleOpenTranscription = () => toggle("transcription");
    const handleOpenDocument = () => toggle("document");
    const handleOpenPreviousVisit = () => {
        if (!isOpen("previous-visit")) {
            setHasViewedPreviousVisit(true);
        }
        toggle("previous-visit");
    };

    // Handle when reasoning is generated - update patient state for red dot indicator
    const handleReasoningGenerated = (newReasoning) => {
        setPatient((prev) => ({
            ...prev,
            reasoning_output: newReasoning,
        }));
    };

    // Check if reasoning has critical items
    const hasCriticalReasoning = useMemo(() => {
        if (!patient?.reasoning_output) return false;
        const r = patient.reasoning_output;
        const allItems = [
            ...(r.differentials || []),
            ...(r.investigations || []),
            ...(r.clinical_considerations || []),
        ];
        return allItems.some((item) => item.critical === true);
    }, [patient?.reasoning_output]);

    // Show red dot for previous visit if summary exists and hasn't been viewed
    const showPreviousVisitDot =
        Boolean(patient?.previous_visit_summary) && !hasViewedPreviousVisit;

    if (!patient) {
        return (
            <Center h="100dvh">
                <Spinner size="xl" />
            </Center>
        );
    }

    if (showStartCard) {
        return (
            <NewNoteStartCard
                onFind={handleSearch}
                onNewPatient={() => {
                    setStartCardDismissed(true);
                    onOpenDemographics();
                }}
                isSearchLoading={isSearchLoading}
            />
        );
    }

    return (
        <Box
            px={[2, 4, 5]}
            pt={[1, 2, 3]}
            pb="100px"
            borderRadius="sm"
            w="100%"
        >
            <VStack gap={[3, 4, 5]} align="stretch">
                <PatientInfoBar patient={patient} onEdit={onOpenDemographics} />

                <Summary
                    ref={summaryRef}
                    isSummaryCollapsed={summary.isCollapsed}
                    patient={patient}
                    setPatient={setPatient}
                    handleGenerateLetterClick={handleGenerateLetterClick}
                    handleSavePatientData={handleSavePatientData}
                    onWrapUp={handleOpenWrapUp}
                    saveLoading={saveLoading}
                    wrapUpLoading={wrapUpLoading}
                    setIsModified={setIsSummaryModified}
                    template={currentTemplate}
                    selectTemplate={selectTemplate}
                    isNewPatient={isNewPatient}
                    isSearchedPatient={isSearchedPatient}
                    onCopy={handleCopy}
                    recentlyCopied={recentlyCopied}
                    isEncounterSaved={Boolean(patient?.id)}
                />

                <WrapUpModal
                    isOpen={isWrapUpOpen}
                    onClose={() => setIsWrapUpOpen(false)}
                    onConfirm={handleWrapUpConfirm}
                    planText={patient?.template_data?.plan || ""}
                    submitting={wrapUpLoading}
                />

                <DemographicsModal
                    isOpen={isDemographicsOpen}
                    onClose={onCloseDemographics}
                    patient={patient}
                    setPatient={setPatient}
                    onSave={handleDemographicsSave}
                />

                <ScribeConsentModal
                    isOpen={isConsentOpen}
                    onClose={onCloseConsent}
                    onConsent={handleConsentGranted}
                    onDecline={handleConsentDeclined}
                    hasDeclined={hasDeclined}
                    declinedDate={scribeConsent?.scribe_consent_declined_at}
                    patientName={patient?.name}
                />

                <Letter
                    isOpen={isOpen("letter")}
                    onClose={() => close("letter")}
                    finalCorrespondence={letterHook.finalCorrespondence}
                    handleSaveLetter={handleLetterSave}
                    setFinalCorrespondence={(value) => {
                        letterHook.setFinalCorrespondence(value);
                        setIsLetterModified(true);
                    }}
                    handleRefineLetter={(params) =>
                        letterHook.refineLetter(params)
                    }
                    loading={letterHook.loading}
                    handleGenerateLetterClick={handleGenerateLetterClick}
                    setIsModified={setIsLetterModified}
                    patient={patient}
                    setLoading={setLoading}
                />

                <Chat
                    isOpen={isOpen("chat")}
                    onClose={() => close("chat")}
                    chatLoading={chat.loading}
                    messages={chat.messages}
                    setMessages={chat.setMessages}
                    userInput={chat.userInput}
                    setUserInput={chat.setUserInput}
                    handleChat={(userInput) => {
                        open("chat");
                        return chat.sendMessage(
                            userInput,
                            patient,
                            currentTemplate,
                            patient.raw_transcription,
                        );
                    }}
                    showSuggestions={chat.showSuggestions}
                    setShowSuggestions={chat.setShowSuggestions}
                    rawTranscription={patient.raw_transcription}
                    currentTemplate={currentTemplate}
                    patientData={patient}
                />

                <ReasoningPanel
                    isOpen={isOpen("reasoning")}
                    onClose={() => close("reasoning")}
                    noteId={patient?.id}
                    initialReasoning={patient?.reasoning_output}
                    onReasoningGenerated={handleReasoningGenerated}
                />
            </VStack>
            {/* Scribe Pill Box - centered at bottom */}
            <ScribePillBox
                isRecording={scribeControls.isRecording}
                isPaused={scribeControls.isPaused}
                onStart={scribeControls.startRecording}
                onPause={scribeControls.pauseRecording}
                onResume={scribeControls.resumeRecording}
                onSend={scribeControls.stopAndSendRecording}
                onReset={scribeControls.resetRecording}
                isLoading={scribeControls.isLoading}
                isAmbient={scribeControls.isAmbient}
                onModeToggle={scribeControls.toggleAmbientMode}
                onOpenTranscription={handleOpenTranscription}
                isTranscriptionOpen={isOpen("transcription")}
                hasRawTranscription={!!patient.raw_transcription}
                onAudioDrop={scribeControls.handleAudioDrop}
                canRecord={canRecord}
                onBlockedRecord={handleBlockedRecord}
                sendError={scribeControls.sendError}
                onRetry={scribeControls.retrySend}
                onDownload={scribeControls.downloadLastRecording}
                onDismiss={scribeControls.dismissSendError}
            />
            {/* Floating Action Menu - always expanded on right side */}
            <FloatingActionMenu
                onOpenChat={handleOpenChat}
                onOpenLetter={handleOpenLetter}
                onOpenReasoning={handleOpenReasoning}
                onOpenDocument={handleOpenDocument}
                onOpenPreviousVisit={handleOpenPreviousVisit}
                isChatOpen={isOpen("chat")}
                isLetterOpen={isOpen("letter")}
                isReasoningOpen={isOpen("reasoning")}
                isDocumentOpen={isOpen("document")}
                isPreviousVisitOpen={isOpen("previous-visit")}
                hasCriticalReasoning={hasCriticalReasoning}
                hasPreviousVisitSummary={Boolean(
                    patient?.previous_visit_summary,
                )}
                showPreviousVisitDot={showPreviousVisitDot}
                isEncounterSaved={Boolean(patient?.id)}
            />
            {/* Transcription Panel */}
            <TranscriptionPanel
                isOpen={isOpen("transcription")}
                onClose={() => close("transcription")}
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
                noteId={patient?.id}
            />
            {/* Document Panel */}
            <DocumentPanel
                isOpen={isOpen("document")}
                onClose={() => close("document")}
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
                isOpen={isOpen("previous-visit")}
                onClose={() => close("previous-visit")}
                previousVisitSummary={patient.previous_visit_summary}
                previousVisitTemplateData={patient.previous_visit_template_data}
                previousVisitTemplateKey={patient.previous_visit_template_key}
                previousVisitEncounterDate={
                    patient.previous_visit_encounter_date
                }
                templates={templates}
            />
        </Box>
    );
};

export default PatientDetails;
