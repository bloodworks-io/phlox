import { Box, VStack, useDisclosure, Spinner, Center } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useClipboard } from "../utils/hooks/useClipboard";
import { toaster } from "@/components/ui/toaster";
const toast = toaster.create;
import { useState, useEffect, useRef, useMemo } from "react";
import type {
    ComponentType,
    Dispatch,
    FormEvent,
    SetStateAction,
} from "react";
import { useNavigate, useLocation } from "react-router";
import PatientInfoBar from "../components/patient/PatientInfoBar";
import NewNoteStartCard from "../components/patient/NewNoteStartCard";
import { useScribe } from "../components/patient/Scribe";
import SummaryBase from "../components/patient/Summary";
import Chat from "../components/panels/chat/Chat";
import LetterBase from "../components/panels/letter/Letter";
import ReasoningPanelBase from "../components/panels/reasoning/ReasoningPanel";
import AgentPanel from "../components/panels/agent/AgentPanel";
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
import ConfirmDialog from "../components/common/ConfirmDialog";
import ScribeConsentModal from "../components/modals/ScribeConsentModal";
import { useCollapse } from "../utils/hooks/useCollapse";
import { useLetterOrchestration } from "../utils/hooks/useLetterOrchestration";
import { useActivePanel } from "../utils/hooks/useActivePanel";
import { useTranscriptionCapture } from "../utils/hooks/useTranscriptionCapture";
import { useModificationFlags } from "../utils/hooks/useModificationFlags";
import { useSearchFlow } from "../utils/hooks/useSearchFlow";
import { useScribeConsent } from "../utils/hooks/useScribeConsent";
import { useWrapUp } from "../utils/hooks/useWrapUp";
import { areRequiredDemographicsMet } from "../utils/helpers/validationHelpers";
import { useScribeMode } from "../utils/hooks/useScribeMode";
import { usePatientSwitching } from "../utils/hooks/usePatientSwitching";
import { useTranscriptionApply } from "../utils/hooks/useTranscriptionApply";
import { useLiveAgentPanel } from "../utils/hooks/useLiveAgentPanel";
import type {
    Patient,
    ReasoningOutput,
} from "../utils/patient/types";

// loosen props until each is converted to .tsx
const Summary = SummaryBase as unknown as ComponentType<any>;
const Letter = LetterBase as unknown as ComponentType<any>;
const ReasoningPanel = ReasoningPanelBase as unknown as ComponentType<any>;

interface PatientDetailsProps {
    patient: Patient | null;
    setPatient: Dispatch<SetStateAction<Patient | null>>;
    selectedDate: string;
    refreshSidebar: () => void;
    setIsModified: (value: boolean) => void;
    onResetLetter?: () => void;
    onOpenNewNoteModal?: () => void;
}

const PatientDetails = ({
    patient: initialPatient,
    setPatient: setInitialPatient,
    selectedDate,
    refreshSidebar,
    setIsModified: setParentIsModified,
    onResetLetter,
    onOpenNewNoteModal,
}: PatientDetailsProps) => {
    const location = useLocation();
    const { t } = useTranslation();
    const isNewPatient = location.pathname === "/new-note";
    const { viaModal, cameFromSearch } = (location.state ?? {}) as {
        viaModal?: boolean;
        cameFromSearch?: boolean;
    };
    const summaryRef = useRef(null);
    const [, setLoading] = useState(false);
    const navigate = useNavigate();
    const [saveLoading, setSaveLoading] = useState(false);
    const {
        open: isDemographicsOpen,
        onOpen: onOpenDemographics,
        onClose: onCloseDemographics,
    } = useDisclosure();

    const {
        hasTranscriptionOccurred,
        initialTranscriptionContent,
        capture: captureTranscription,
        reset: resetTranscription,
    } = useTranscriptionCapture();

    const { isLetterModified, setIsLetterModified, isSummaryModified, setIsSummaryModified } =
        useModificationFlags(initialPatient?.id, setParentIsModified);

    const [hasViewedPreviousVisit, setHasViewedPreviousVisit] = useState(false);

    // Custom hooks
    const {
        patient,
        setPatient,
        savePatient,
        savePatientCore,
        loadCandidate,
    } = usePatientEditor(initialPatient);

    const summary = useCollapse(false);

    const searchFlow = useSearchFlow({
        isNewPatient,
        viaModal,
        cameFromSearch,
        pathname: location.pathname,
        summarySetIsCollapsed: summary.setIsCollapsed,
    });

    const { currentTemplate, templates, selectTemplate } = usePatientTemplate({
        patient,
        setPatient,
        isNewPatient,
        isSearchedPatient: searchFlow.isSearchedPatient,
        initialPatient,
        isSearchLoading: searchFlow.isSearchLoading,
    });

    useEffect(() => {
        if (!searchFlow.searchResult) return;
        const candidate = searchFlow.searchResult;
        const preservedTemplateData = candidate.template_data || {};

        setPatient((prev) => ({
            ...prev,
            ...candidate,
            template_data: { ...preservedTemplateData },
            isNewEncounter: true,
        }));

        if (candidate.template_key) {

            selectTemplate(candidate.template_key, { includeDeleted: true });
        }

        searchFlow.clearSearchResult();
    }, [searchFlow.searchResult, setPatient, selectTemplate, searchFlow]);

    const {
        extractedDocData,
        replacedFields,
        docFileName,
        setDocFileName,
        handleDocumentComplete,
        toggleDocumentField,
        resetDocumentState,
    } = useDocumentExtraction({ patient, setPatient, setIsModified: setIsSummaryModified });

    const requiredDemographicsMet = areRequiredDemographicsMet(patient);

    const { open, toggle, close, closeAll, isOpen } = useActivePanel();

    const letter = useLetterOrchestration({
        patient,
        setIsModified: setIsLetterModified,
        onResetLetter,
        openLetter: () => open("letter"),
    });

    // Wrap Up must be composed before the live agent: its open handler is
    // the agent's onRequestWrapUp callback.
    const wrapUp = useWrapUp({
        patient,
        savePatientCore,
        resetTranscription,
        setIsSummaryModified,
        resetSearchFlow: searchFlow.reset,
        onOpenNewNoteModal,
        refreshSidebar,
        selectedDate,
        toast,
        hasTranscriptionOccurred,
        initialTranscriptionContent,
    });

    const { handleTranscriptionComplete } = useTranscriptionApply({
        patient,
        setPatient,
        hasTranscriptionOccurred,
        captureTranscription,
        setIsSummaryModified,
        setLoading,
        setIsSummaryCollapsed: summary.setIsCollapsed,
        summaryRef,
    });

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

    const liveAgent = useLiveAgentPanel({
        patient,
        setPatient,
        currentTemplate,
        onRequestWrapUp: () => wrapUp.openWrapUp(),
        onLetterSaved: () => setIsLetterModified(false),
        onNoteContentChanged: () => setIsSummaryModified(true),
        letterContent: letter.finalCorrespondence,
        setLetterContent: letter.setFinalCorrespondence,
        letterOpen: isOpen("letter"),
        openPanel: open,
    });

    const {
        scribeMode,
        isLiveExpanded,
        isModeMenuOpen,
        toggleLiveExpand,
        handleModeSelect,
        handleLiveStop,
        handleLiveResume,
        handleRecordStart,
        handleTranscriptOpenChange,
        handleModeMenuOpenChange,
    } = useScribeMode({
        scribeControls,
        liveAgent,
        openPanel: open,
        closePanel: close,
    });

    const { leaveModal, handleConfirmCandidate, cancelCandidateSwitch, confirmCandidateNavigation } =
        usePatientSwitching({
            searchFlow,
            loadCandidate,
            selectedDate,
            isSummaryModified,
            isLetterModified,
            setIsSummaryModified,
        });

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
    );

    useEffect(() => {
        // Reset component states when patient changes.
        // (chat is self-reset by Chat.jsx via internal effect on patientData?.id)
        summary.setIsCollapsed(false);
        closeAll();
        resetDocumentState();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- summary/closeAll/resetDocumentState come from hooks that return fresh object literals each render; this effect intentionally fires only on patient/template/isNewPatient changes
    }, [patient?.id, currentTemplate, isNewPatient]);

    useEffect(() => {
        toaster.remove();
    }, []);

    const handleSavePatientData = async (e: FormEvent) => {
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
                    resetTranscription();
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
                resetTranscription();
            }
        } finally {
            setSaveLoading(false);
        }
    };

    const handleDemographicsSave = async (updatedPatient: Patient) => {
        setInitialPatient(updatedPatient);
        if (!updatedPatient.id) return;
        await patientApi.savePatientData(
            { patientData: updatedPatient },
            toast,
            refreshSidebar,
        );
    };

    // Functions for the Floating Action Menu
    const handleOpenLetter = () => toggle("letter");
    const handleOpenChat = () => toggle("chat");
    const handleOpenReasoning = () => toggle("reasoning");
    const handleOpenDocument = () => toggle("document");

    // Must sit below scribeMode: consent grant resumes through it,
    // so the armed capture mode (incl. live agent) is honoured, and agent
    // mode is consent-gated like ambient since it records the consultation.
    const scribeConsent = useScribeConsent({
        urNumber: patient?.ur_number,
        recordsConsultation: scribeMode !== "dictate",
        requiresConsentConfig: scribeControls.requireConsent,
        requiredDemographicsMet,
        startRecording: handleRecordStart,
        onRequireDemographics: onOpenDemographics,
    });

    // Wrap Up: the modal finalises the live session before the encounter
    // is saved (confirm stops the session).
    const handleWrapUpClick = () => {
        wrapUp.openWrapUp();
    };

    const handleWrapUpConfirm = async (curatedJobs) => {
        if (liveAgent.isLiveActive) {
            await liveAgent.stopLive();
        }
        await wrapUp.confirmWrapUp(curatedJobs);
    };
    const handleOpenPreviousVisit = () => {
        if (!isOpen("previous-visit")) {
            setHasViewedPreviousVisit(true);
        }
        toggle("previous-visit");
    };

    // Handle when reasoning is generated - update patient state for red dot indicator
    const handleReasoningGenerated = (newReasoning: ReasoningOutput) => {
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

    if (searchFlow.showStartCard) {
        return (
            <NewNoteStartCard
                onFind={searchFlow.handleSearch}
                onConfirmCandidate={handleConfirmCandidate}
                onNewPatient={() => {
                    searchFlow.dismissStartCard();
                    onOpenDemographics();
                }}
                isSearchLoading={searchFlow.isSearchLoading}
            />
        );
    }

    return (
        <Box
            px={[2, 4, 5]}
            pt={[1, 2, 3]}
            pb={[1, 2, 3]}
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
                    handleGenerateLetterClick={letter.handleGenerateLetterClick}
                    handleSavePatientData={handleSavePatientData}
                    onWrapUp={handleWrapUpClick}
                    saveLoading={saveLoading}
                    wrapUpLoading={wrapUp.wrapUpLoading}
                    setIsModified={setIsSummaryModified}
                    selectTemplate={selectTemplate}
                    isNewPatient={isNewPatient}
                    isSearchedPatient={searchFlow.isSearchedPatient}
                    onCopy={handleCopy}
                    recentlyCopied={recentlyCopied}
                    isEncounterSaved={Boolean(patient?.id)}
                    liveUpdatedFields={liveAgent.fieldFlash}
                />

                <WrapUpModal
                    key={String(wrapUp.isWrapUpOpen)}
                    isOpen={wrapUp.isWrapUpOpen}
                    onClose={wrapUp.closeWrapUp}
                    onConfirm={handleWrapUpConfirm}
                    planText={patient?.template_data?.plan || ""}
                    submitting={wrapUp.wrapUpLoading}
                    stagedJobs={liveAgent.stagedJobs}
                    onExtracted={liveAgent.pushExtractedJobs}
                />

                <DemographicsModal
                    isOpen={isDemographicsOpen}
                    onClose={onCloseDemographics}
                    patient={patient}
                    setPatient={setPatient}
                    onSave={handleDemographicsSave}
                />

                <ScribeConsentModal
                    isOpen={scribeConsent.isConsentOpen}
                    onClose={scribeConsent.onCloseConsent}
                    onConsent={scribeConsent.handleConsentGranted}
                    onDecline={scribeConsent.handleConsentDeclined}
                    hasDeclined={scribeConsent.hasDeclined}
                    declinedDate={
                        scribeConsent.consent?.scribe_consent_declined_at
                    }
                    patientName={patient?.name}
                />

                <Letter
                    isOpen={isOpen("letter")}
                    onClose={() => close("letter")}
                    finalCorrespondence={letter.finalCorrespondence}
                    handleSaveLetter={letter.handleLetterSave}
                    setFinalCorrespondence={letter.setFinalCorrespondence}
                    handleRefineLetter={letter.handleRefineLetter}
                    loading={letter.loading}
                    handleGenerateLetterClick={letter.handleGenerateLetterClick}
                    setIsModified={letter.setIsModified}
                    patient={patient}
                    setLoading={setLoading}
                />

                <Chat
                    isOpen={isOpen("chat")}
                    onClose={() => close("chat")}
                    patientData={patient}
                    currentTemplate={currentTemplate}
                    rawTranscription={patient.raw_transcription}
                />

                <ReasoningPanel
                    isOpen={isOpen("reasoning")}
                    noteId={patient?.id}
                    initialReasoning={patient?.reasoning_output}
                    onReasoningGenerated={handleReasoningGenerated}
                />
            </VStack>
            {/* Unsaved-work confirmation for the in-page patient switch */}
            <ConfirmDialog
                isOpen={leaveModal.open}
                onClose={cancelCandidateSwitch}
                onConfirm={confirmCandidateNavigation}
                title={t("navigation.confirmTitle")}
                body={t("navigation.leaveWarning")}
                confirmLabel={t("navigation.leave")}
                cancelLabel={undefined}
            />
            {/* Scribe Pill Box - centered at bottom */}
            <ScribePillBox
                isRecording={scribeControls.isRecording}
                isPaused={scribeControls.isPaused}
                onStart={handleRecordStart}
                onPause={scribeControls.pauseRecording}
                onResume={scribeControls.resumeRecording}
                onSend={scribeControls.stopAndSendRecording}
                onReset={scribeControls.resetRecording}
                isLoading={scribeControls.isLoading}
                mode={scribeMode}
                isModeMenuOpen={isModeMenuOpen}
                onModeMenuOpenChange={handleModeMenuOpenChange}
                onModeSelect={handleModeSelect}
                isLive={liveAgent.isLiveActive}
                isLiveBusy={
                    liveAgent.status === "connecting" ||
                    liveAgent.status === "stopping"
                }
                onLiveStop={handleLiveStop}
                onLiveResume={handleLiveResume}
                liveStatus={liveAgent.status}
                liveArtifactsCount={liveAgent.artifacts.length}
                isLivePanelExpanded={isLiveExpanded}
                onLiveExpand={toggleLiveExpand}
                onLiveRetry={liveAgent.retryLive}
                onLiveDismissReview={liveAgent.dismissReview}
                transcriptPanel={
                    <TranscriptionPanel
                        rawTranscription={patient.raw_transcription}
                        transcriptionDuration={patient.transcription_duration}
                        processDuration={patient.process_duration}
                        onReprocess={handleTranscriptionComplete}
                        isTranscribing={undefined}
                        isAmbient={scribeControls.isAmbient}
                        name={patient.name}
                        gender={patient.gender}
                        dob={patient.dob}
                        templateKey={currentTemplate?.template_key}
                        noteId={patient?.id}
                    />
                }
                onTranscriptOpenChange={handleTranscriptOpenChange}
                isTranscriptionOpen={isOpen("transcription")}
                hasRawTranscription={!!patient.raw_transcription}
                onAudioDrop={scribeControls.handleAudioDrop}
                canRecord={scribeConsent.canRecord}
                onBlockedRecord={scribeConsent.handleBlockedRecord}
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
                hasPreviousVisit={Boolean(
                    patient?.previous_visit_summary ||
                        patient?.previous_visit_template_data ||
                        patient?.previous_visit_summary_pending,
                )}
                showPreviousVisitDot={showPreviousVisitDot}
                isEncounterSaved={Boolean(patient?.id)}
            />
            {/* Document Panel */}
            <DocumentPanel
                isOpen={isOpen("document")}
                _onClose={undefined}
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
                _onClose={undefined}
                previousVisitSummary={patient.previous_visit_summary}
                previousVisitSummaryPending={
                    patient.previous_visit_summary_pending
                }
                previousVisitTemplateData={patient.previous_visit_template_data}
                previousVisitTemplateKey={patient.previous_visit_template_key}
                previousVisitEncounterDate={
                    patient.previous_visit_encounter_date
                }
                templates={templates}
            />
            {/* Live agent — corner card, expands in place */}
            <AgentPanel
                status={liveAgent.status}
                agentState={liveAgent.agentState}
                transcripts={liveAgent.transcripts}
                statuses={liveAgent.statuses}
                artifacts={liveAgent.artifacts}
                lastError={liveAgent.lastError}
                isExpanded={isLiveExpanded}
                onToggleExpand={toggleLiveExpand}
                onOpenLetter={liveAgent.onOpenLetter}
                onRetry={liveAgent.retryLive}
                onDismissReview={liveAgent.dismissReview}
            />
        </Box>
    );
};

export default PatientDetails;
