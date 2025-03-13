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
import Scribe from "../components/patient/Scribe";
import Summary from "../components/patient/Summary";
import Chat from "../components/patient/Chat";
import Letter from "../components/patient/Letter";
import { usePatient } from "../utils/hooks/usePatient";
import { useCollapse } from "../utils/hooks/useCollapse";
import { useChat } from "../utils/hooks/useChat";
import { useLetter } from "../utils/hooks/useLetter";
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
    const [mode, setMode] = useState("record");
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

    const transcription = useCollapse(false);
    const summary = useCollapse(false);
    const letterHook = useLetter(setIsModified);
    const letter = useCollapse(true);
    const chat = useChat();
    const { refreshTemplates } = useTemplate();

    // Refresh templates for new patients
    useEffect(() => {
        if (isNewPatient) {
            refreshTemplates();
        }
    }, [isNewPatient, refreshTemplates]);
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
            // Pre-fill a new encounter with previous patient's info
            const preservedTemplateData = searchResult.template_data || {};

            setPatient((prev) => ({
                ...prev,
                ...searchResult,
                template_data: {
                    ...preservedTemplateData, // Pre-fill with previous template data
                },
                isNewEncounter: true, // Mark this as a new encounter
            }));

            // Pre-select their previous template, but don't lock it
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
            console.log(
                "Resetting isSearchedPatient - viewing historical patient",
            );
        }
    }, [location.pathname]);

    // Reset when creating new patient
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
            selectTemplate(
                patient.template_key,
                "Maintaining historical template",
            );
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
                // This runs when:
                // - It's a completely new patient (not from search)
                // - We have a default template
                // - No template has been set yet
                if (
                    !hasDefaultTemplateBeenSet.current &&
                    !patient?.template_key
                ) {
                    hasDefaultTemplateBeenSet.current = true; // Set the flag immediately
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
            // This runs when:
            // - Viewing a historical encounter
            // - We have the initial patient data
            // - Current template is loaded
            // - Not currently searching
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
        if (isNewPatient) {
            // For new patients, show transcription and hide others
            transcription.setIsCollapsed(false);
            summary.setIsCollapsed(false);
            letter.setIsCollapsed(true);
            chat.setChatExpanded(false);
        } else {
            // For existing patients, keep current behavior
            transcription.setIsCollapsed(true);
            summary.setIsCollapsed(false);
            letter.setIsCollapsed(true);
            chat.setChatExpanded(false);
        }
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
        // Track if this is a new transcription, reprocessing, or restoration
        const isReprocessing = !!patient?.raw_transcription;
        const isRestoration = data.isRestoration === true;
        // Store current transcription state before updating
        previousTranscriptionRef.current = patient?.raw_transcription;

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
            // Only collapse transcription in specific scenarios
            setIsSourceCollapsed: () => {
                // For restoration or reprocessing, never collapse
                if (isRestoration || isReprocessing) {
                    transcription.setIsCollapsed(false);
                }
                // For new transcription with content, collapse to show summary
                else if (data.rawTranscription) {
                    transcription.setIsCollapsed(true);
                }
                // For clearing transcription, keep it open
                else {
                    transcription.setIsCollapsed(false);
                }
            },
            setIsSummaryCollapsed: () => summary.setIsCollapsed(false),
            triggerResize,
            summaryRef,
        });
    };

    const handleDocumentComplete = (data) => {
        // When initial document processing completes, save original content and extracted data
        if (!data.fieldByField) {
            // Save original content if this is the first time processing
            if (!extractedDocData) {
                // Take a snapshot of current field values
                setOriginalContent({ ...patient.template_data });
            }

            // Store extracted data for future toggle operations
            setExtractedDocData(data);

            // Don't immediately update patient data - wait for field toggles
            toast({
                title: "Document processed",
                description: "Use the toggle buttons to update fields",
                status: "success",
                duration: 3000,
                isClosable: true,
            });
        } else {
            // This is a field toggle operation
            const fieldKey = Object.keys(data.fields)[0]; // Get the field being toggled

            // Update replaced fields tracking
            setReplacedFields((prev) => ({
                ...prev,
                [fieldKey]: !prev[fieldKey],
            }));

            // Update the patient data
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

        // Check if field has content in extracted data
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

        // Check if field is currently using document content
        const isCurrentlyReplaced = replacedFields[fieldKey];

        // Determine content to use (original or document)
        let fieldContent;
        if (isCurrentlyReplaced) {
            // Restore original content
            fieldContent = originalContent[fieldKey] || "";
        } else {
            // Use extracted content
            fieldContent = extractedDocData.fields[fieldKey] || "";
        }

        // Update patient data with single field
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
        transcription.setIsCollapsed(true);
        summary.setIsCollapsed(true);
        chat.setChatExpanded(false);

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
                );
                if (savedPatient?.id) {
                    setIsSummaryModified(false);
                    navigate(`/patient/${savedPatient.id}`);
                }
            } else {
                await savePatient(refreshSidebar, selectedDate, toast);
                setIsSummaryModified(false);
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
            // Pass the selectedDate to the search function
            const result = await searchPatient(urNumber, selectedDate);
            if (result) {
                setSearchResult(result);
                setIsSearchedPatient(true); // Set to true only when search is successful
                summary.setIsCollapsed(false);
                console.log(
                    "Setting isSearchedPatient to true - search successful",
                );
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
            // Early return if viewing historical encounter
            if (!isNewPatient && !isSearchedPatient) {
                console.log(
                    "Viewing historical encounter - keeping original template",
                );
                return;
            }

            // Log template keys at the start for debugging
            console.log("handleHistoricalTemplate - Start. ", {
                isNewPatient,
                isSearchedPatient,
                patientTemplateKey: patient?.template_key,
                defaultTemplateKey: defaultTemplate?.template_key,
            });

            // Proceed only for new encounters or pre-filled searches AND if patient template is NOT the default
            if (
                patient?.template_key &&
                defaultTemplate?.template_key && // Ensure defaultTemplate is also loaded
                patient?.template_key !== defaultTemplate?.template_key && // Crucial check: compare keys
                templates?.length > 0 &&
                (isNewPatient || isSearchedPatient)
            ) {
                console.log(
                    "Template keys are different - proceeding with check/upgrade.",
                );
                const activeTemplate = templates.find(
                    (t) => t.template_key === patient.template_key,
                );

                if (!activeTemplate) {
                    console.warn(
                        "Pre-fill template is not active. Finding fallback...",
                    );
                    const baseKey = patient.template_key.split("_")[0];
                    const latestVersion = templates
                        .filter((t) => t.template_key.startsWith(baseKey))
                        .sort((a, b) =>
                            b.template_key.localeCompare(a.template_key),
                        )[0];

                    const fallback =
                        latestVersion || defaultTemplate || templates[0];

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

                        // Only show warning for new encounters using pre-fill where an upgrade happened
                        if (
                            fallback.template_key !== patient.template_key &&
                            isSearchedPatient
                        ) {
                            // Check if fallback is actually different
                            showWarningToast(
                                `Using ${fallback.template_name} template for this new encounter.`,
                            );
                        }
                    }
                }
            } else {
                console.log(
                    "No template upgrade needed or viewing historical encounter.",
                );
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

    if (!patient) {
        return (
            <Center h="100vh">
                <Spinner size="xl" />
            </Center>
        );
    }

    return (
        <Box p={[2, 4, 5]} borderRadius="sm" w="100%">
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

                <Scribe
                    isTranscriptionCollapsed={transcription.isCollapsed}
                    toggleTranscriptionCollapse={transcription.toggle}
                    mode={mode}
                    toggleMode={() =>
                        setMode((prev) =>
                            prev === "record" ? "upload" : "record",
                        )
                    }
                    handleTranscriptionComplete={handleTranscriptionComplete}
                    transcriptionDuration={patient.transcription_duration}
                    processDuration={patient.process_duration}
                    name={patient.name}
                    dob={patient.dob}
                    gender={patient.gender}
                    template={currentTemplate}
                    setLoading={setLoading}
                    previousVisitSummary={patient.previous_visit_summary}
                    template={currentTemplate}
                    patientId={patient.id}
                    reasoning={patient.reasoning_output || null}
                    rawTranscription={patient.raw_transcription}
                    isTranscribing={loading}
                    handleDocumentComplete={handleDocumentComplete}
                    toggleDocumentField={toggleDocumentField}
                    replacedFields={replacedFields}
                    extractedDocData={extractedDocData}
                    resetDocumentState={resetDocumentState}
                    docFileName={docFileName}
                    setDocFileName={setDocFileName}
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
                    isLetterCollapsed={letter.isCollapsed}
                    toggleLetterCollapse={letter.toggle}
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
                    toast={toast}
                    patient={patient}
                    setLoading={setLoading}
                />

                <Chat
                    chatExpanded={chat.chatExpanded}
                    setChatExpanded={chat.setChatExpanded}
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
                />
            </VStack>
        </Box>
    );
};

export default PatientDetails;
