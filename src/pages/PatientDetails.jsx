import { Box, VStack, useDisclosure, Spinner, Center } from "@chakra-ui/react";
import { useClipboard } from "../utils/hooks/useClipboard";
import { toaster } from "@/components/ui/toaster";
const toast = toaster.create;
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router";
import PatientInfoBar from "../components/patient/PatientInfoBar";
import NewNoteStartCard from "../components/patient/NewNoteStartCard";
import { useScribe } from "../components/patient/Scribe";
import Summary from "../components/patient/Summary";
import Letter from "../components/panels/letter/Letter";
import ScribePillBox from "../components/patient/ScribePillBox";
import WrapUpModal from "../components/modals/WrapUpModal";
import TranscriptionPanel from "../components/panels/transcription/TranscriptionPanel";
import DocumentPanel from "../components/panels/document/DocumentPanel";
import FloatingActionMenu from "../components/common/FloatingActionMenu";
import { usePatientTemplate } from "../utils/hooks/usePatientTemplate";
import { usePatientEditor } from "../utils/hooks/usePatientEditor";
import { useDocumentExtraction } from "../utils/hooks/useDocumentExtraction";
import { patientApi } from "../utils/api/patientApi";
import DemographicsModal from "../components/modals/DemographicsModal";
import ScribeConsentModal from "../components/modals/ScribeConsentModal";
import { useCollapse } from "../utils/hooks/useCollapse";
import { useLetterOrchestration } from "../utils/hooks/useLetterOrchestration";
import { useActivePanel } from "../utils/hooks/useActivePanel";
import { useModificationFlags } from "../utils/hooks/useModificationFlags";
import { useSearchFlow } from "../utils/hooks/useSearchFlow";
import { useScribeConsent } from "../utils/hooks/useScribeConsent";
import { useWrapUp } from "../utils/hooks/useWrapUp";
import { areRequiredDemographicsMet } from "../utils/helpers/validationHelpers";
import { handleProcessingComplete } from "../utils/helpers/processingHelpers";

const PatientDetails = ({
    patient: initialPatient,
    setPatient: setInitialPatient,
    selectedDate,
    refreshSidebar,
    setIsModified: setParentIsModified,
    onResetLetter,
    onOpenNewNoteModal,
}) => {
    const location = useLocation();
    const isNewPatient = location.pathname === "/new-note";
    const { viaModal, cameFromSearch } = location.state || {};
    const summaryRef = useRef(null);
    const [, setLoading] = useState(false);
    const navigate = useNavigate();
    const [saveLoading, setSaveLoading] = useState(false);
    const {
        open: isDemographicsOpen,
        onOpen: onOpenDemographics,
        onClose: onCloseDemographics,
    } = useDisclosure();

    const previousTranscriptionRef = useRef(null);

    const { setIsLetterModified, setIsSummaryModified } = useModificationFlags(
        initialPatient?.id,
        setParentIsModified,
    );

    // Custom hooks
    const { patient, setPatient, savePatient, savePatientCore, loadCandidate } =
        usePatientEditor(initialPatient);

    const summary = useCollapse(false);

    const searchFlow = useSearchFlow({
        isNewPatient,
        viaModal,
        cameFromSearch,
        pathname: location.pathname,
        summarySetIsCollapsed: summary.setIsCollapsed,
    });

    const { currentTemplate, selectTemplate } = usePatientTemplate({
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
            selectTemplate(candidate.template_key);
        }

        searchFlow.clearSearchResult();
    }, [searchFlow.searchResult, setPatient, selectTemplate, searchFlow]);
    const requiredDemographicsMet = areRequiredDemographicsMet(patient);

    const {
        extractedDocData,
        replacedFields,
        docFileName,
        setDocFileName,
        handleDocumentComplete,
        toggleDocumentField,
        resetDocumentState,
    } = useDocumentExtraction({ patient, setPatient, setIsModified: setIsSummaryModified });

    const { open, toggle, close, closeAll, isOpen } = useActivePanel();

    const letter = useLetterOrchestration({
        patient,
        setIsModified: setIsLetterModified,
        onResetLetter,
        openLetter: () => open("letter"),
        toast,
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

    const scribeConsent = useScribeConsent({
        urNumber: patient?.ur_number,
        isAmbient: scribeControls.isAmbient,
        requiresConsentConfig: scribeControls.requireConsent,
        requiredDemographicsMet,
        startRecording: scribeControls.startRecording,
        onRequireDemographics: onOpenDemographics,
    });

    const wrapUp = useWrapUp({
        patient,
        savePatientCore,
        setIsSummaryModified,
        resetSearchFlow: searchFlow.reset,
        onOpenNewNoteModal,
        refreshSidebar,
        selectedDate,
        toast,
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
        { format: "text/plain" },
    );

    useEffect(() => {
        // Reset component states when patient changes.
        summary.setIsCollapsed(false);
        closeAll();
        resetDocumentState();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- summary/closeAll come from hooks that return fresh object literals each render; this effect intentionally fires only on patient/template/isNewPatient changes
    }, [patient?.id, currentTemplate, isNewPatient]);

    useEffect(() => {
        toaster.remove();
    }, []);

    const handleTranscriptionComplete = (data, triggerResize = false) => {
        previousTranscriptionRef.current = patient?.raw_transcription;

        handleProcessingComplete(data, {
            setLoading,
            setters: {
                template_data: (_value) => {
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

    const handleSavePatientData = async (e) => {
        e.preventDefault();
        setSaveLoading(true);
        try {
            if (location.pathname === "/new-note") {
                const savedPatient = await savePatient(
                    refreshSidebar,
                    selectedDate,
                    toast,
                );
                if (savedPatient?.id) {
                    setIsSummaryModified(false);
                    navigate(`/note/${savedPatient.id}`);
                }
            } else {
                await savePatient(refreshSidebar, selectedDate, toast);
                setIsSummaryModified(false);
            }
        } finally {
            setSaveLoading(false);
        }
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

    const handleConfirmCandidate = (candidate) =>
        searchFlow.handleConfirmCandidate(
            candidate,
            selectedDate,
            loadCandidate,
        );

    // Functions for the Floating Action Menu
    const handleOpenLetter = () => toggle("letter");
    const handleOpenTranscription = () => toggle("transcription");
    const handleOpenDocument = () => toggle("document");

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
                    saveLoading={saveLoading}
                    onWrapUp={wrapUp.openWrapUp}
                    wrapUpLoading={wrapUp.wrapUpLoading}
                    setIsModified={setIsSummaryModified}
                    selectTemplate={selectTemplate}
                    isNewPatient={isNewPatient}
                    isSearchedPatient={searchFlow.isSearchedPatient}
                    onCopy={handleCopy}
                    recentlyCopied={recentlyCopied}
                    isEncounterSaved={Boolean(patient?.id)}
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

                <WrapUpModal
                    key={String(wrapUp.isWrapUpOpen)}
                    isOpen={wrapUp.isWrapUpOpen}
                    onClose={wrapUp.closeWrapUp}
                    onConfirm={wrapUp.confirmWrapUp}
                    planText={patient?.template_data?.plan || ""}
                    submitting={wrapUp.wrapUpLoading}
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
                canRecord={scribeConsent.canRecord}
                onBlockedRecord={scribeConsent.handleBlockedRecord}
                sendError={scribeControls.sendError}
                onRetry={scribeControls.retrySend}
                onDownload={scribeControls.downloadLastRecording}
                onDismiss={scribeControls.dismissSendError}
            />
            {/* Floating Action Menu - always expanded on right side */}
            <FloatingActionMenu
                onOpenLetter={handleOpenLetter}
                onOpenDocument={handleOpenDocument}
                isLetterOpen={isOpen("letter")}
                isDocumentOpen={isOpen("document")}
                isEncounterSaved={Boolean(patient?.id)}
            />
            {/* Transcription Panel */}
            <TranscriptionPanel
                isOpen={isOpen("transcription")}
                onClose={() => close("transcription")}
                rawTranscription={patient.raw_transcription}
                transcriptionDuration={patient.transcription_duration}
                processDuration={patient.process_duration}
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
        </Box>
    );
};

export default PatientDetails;
