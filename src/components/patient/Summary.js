import React, {
    useState,
    useRef,
    forwardRef,
    useImperativeHandle,
} from "react";
import TextareaAutosize from "react-textarea-autosize";
import {
    Box,
    Flex,
    IconButton,
    Text,
    Collapse,
    HStack,
    Select,
    VStack,
    Tooltip,
    Center,
    Spinner,
    useToast,
} from "@chakra-ui/react";
import {
    ChevronRightIcon,
    ChevronDownIcon,
    EditIcon,
    CopyIcon,
    CheckIcon,
} from "@chakra-ui/icons";
import { FaMicrophone, FaStop, FaSave, FaFileAlt } from "react-icons/fa";
import { GreenButton, BlueButton, TertiaryButton } from "../common/Buttons";
import { useTemplateSelection } from "../../utils/templates/templateContext";
import ConfirmLeaveModal from "../modals/ConfirmLeaveModal";

const Summary = forwardRef(
    (
        {
            isSummaryCollapsed,
            toggleSummaryCollapse,
            patient,
            setPatient,
            handleGenerateLetterClick,
            handleSavePatientData,
            setParentIsModified,
            saveLoading,
            setIsModified,
            onCopy,
            recentlyCopied,
            isNewPatient,
            selectTemplate,
            isSearchedPatient,
        },
        ref,
    ) => {
        const {
            currentTemplate,
            templates,
            status: templateStatus,
        } = useTemplateSelection();

        const textareasRefs = useRef({});
        const [isTemplateChangeModalOpen, setIsTemplateChangeModalOpen] =
            useState(false);
        const [pendingTemplateKey, setPendingTemplateKey] = useState(null);
        const [focusedTextarea, setFocusedTextarea] = useState(null);
        const [recordingStates, setRecordingStates] = useState({});
        const [recentlyRecordedTextarea, setRecentlyRecordedTextarea] =
            useState(null);
        const mediaRecorderRef = useRef({});
        const audioChunksRef = useRef({});
        const toast = useToast();

        const startRecording = async (key) => {
            if (
                !navigator.mediaDevices ||
                !navigator.mediaDevices.getUserMedia
            ) {
                console.error("getUserMedia is not supported in this browser.");
                alert("Your browser does not support audio recording.");
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                });
                mediaRecorderRef.current[key] = new MediaRecorder(stream);
                audioChunksRef.current[key] = [];

                mediaRecorderRef.current[key].ondataavailable = (event) => {
                    audioChunksRef.current[key].push(event.data);
                };

                mediaRecorderRef.current[key].start();
                setRecordingStates((prev) => ({ ...prev, [key]: true }));
            } catch (error) {
                console.error("Error starting recording:", error);
                alert(
                    "Failed to start recording. Please check your microphone permissions.",
                );
            }
        };

        const stopRecording = async (key) => {
            if (recordingStates[key] && mediaRecorderRef.current[key]) {
                mediaRecorderRef.current[key].stop();
                setRecordingStates((prev) => ({ ...prev, [key]: false }));

                try {
                    await new Promise((resolve) => {
                        mediaRecorderRef.current[key].onstop = () => resolve();
                    });

                    const audioBlob = new Blob(audioChunksRef.current[key], {
                        type: "audio/wav",
                    });
                    await sendRecording(key, audioBlob);
                } catch (error) {
                    console.error("Error stopping recording:", error);
                    alert("An error occurred while processing the recording.");
                }
            }
        };

        const sendRecording = async (key, audioBlob) => {
            const formData = new FormData();
            formData.append("file", audioBlob, "recording.wav");
            formData.append("fieldKey", key);

            try {
                const response = await fetch("/api/transcribe/dictate", {
                    method: "POST",
                    body: formData,
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                const transcription = data.transcription || "";

                setPatient((prev) => ({
                    ...prev,
                    template_data: {
                        ...prev.template_data,
                        [key]:
                            (prev.template_data?.[key] || "") +
                            " " +
                            transcription,
                    },
                }));
                setIsModified(true);
            } catch (error) {
                console.error("Error transcribing audio:", error);
                alert("Failed to transcribe audio. Please try again.");
            }
        };

        const handleTemplateChange = async (e) => {
            const newTemplateKey = e.target.value;

            if (!isNewPatient && !isSearchedPatient) {
                toast({
                    title: "Template Locked",
                    description:
                        "Template cannot be changed for historical encounters",
                    status: "warning",
                    duration: 3000,
                    isClosable: true,
                });
                return;
            }

            if (
                patient.template_data &&
                Object.keys(patient.template_data).length > 0
            ) {
                setPendingTemplateKey(newTemplateKey);
                setIsTemplateChangeModalOpen(true);
            } else {
                // Update patient state immediately
                setPatient((prev) => ({
                    ...prev,
                    template_key: newTemplateKey,
                }));
                await selectTemplate(newTemplateKey);
            }
        };

        const confirmTemplateChange = () => {
            selectTemplate(pendingTemplateKey);
            setIsTemplateChangeModalOpen(false);
        };

        const handleTemplateDataChange = (fieldKey, value) => {
            setPatient((prev) => ({
                ...prev,
                template_data: {
                    ...prev.template_data,
                    [fieldKey]: value,
                },
            }));
            setIsModified(true);
        };

        const renderField = (field) => {
            return (
                <Box key={field.field_key} width="100%" position="relative">
                    <Flex justify="space-between" align="center" mb="1">
                        <Text fontSize="sm">{field.field_name}:</Text>
                    </Flex>
                    <Box position="relative">
                        <TextareaAutosize
                            placeholder={field.field_name}
                            value={
                                patient.template_data?.[field.field_key] || ""
                            }
                            onChange={(e) => {
                                handleTemplateDataChange(
                                    field.field_key,
                                    e.target.value,
                                );
                            }}
                            onFocus={() => {
                                setFocusedTextarea(field.field_key);
                                setRecentlyRecordedTextarea(field.field_key);
                            }}
                            onBlur={(e) => handleBlur(e, field.field_key)}
                            className="textarea-style"
                            ref={(el) =>
                                (textareasRefs.current[field.field_key] = el)
                            }
                            style={{
                                width: "100%",
                                resize: "none",
                                padding: "8px",
                                borderRadius: "4px",
                                border: "1px solid #e2e8f0",
                                fontSize: "14px",
                                lineHeight: "1.5",
                            }}
                        />
                        {(focusedTextarea === field.field_key ||
                            recentlyRecordedTextarea === field.field_key) &&
                            !recordingStates[field.field_key] && (
                                <IconButton
                                    icon={<FaMicrophone />}
                                    size="sm"
                                    position="absolute"
                                    bottom="2"
                                    right="2"
                                    zIndex="1"
                                    className="switch-mode"
                                    aria-label="Start recording"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() =>
                                        startRecording(field.field_key)
                                    }
                                />
                            )}
                        {recordingStates[field.field_key] && (
                            <IconButton
                                icon={<FaStop />}
                                size="sm"
                                position="absolute"
                                bottom="2"
                                right="2"
                                zIndex="1"
                                colorScheme="red"
                                aria-label="Stop recording"
                                onClick={() => stopRecording(field.field_key)}
                            />
                        )}
                    </Box>
                </Box>
            );
        };

        const handleBlur = (e, key) => {
            if (
                e.relatedTarget?.getAttribute("aria-label") ===
                    "Start recording" ||
                e.relatedTarget?.getAttribute("aria-label") === "Stop recording"
            ) {
                e.preventDefault();
                return;
            }
            setFocusedTextarea(null);
        };

        useImperativeHandle(ref, () => ({
            resizeTextarea: () => {
                Object.values(textareasRefs.current).forEach((textarea) => {
                    if (textarea) {
                        textarea.style.height = "auto";
                        textarea.style.height = `${textarea.scrollHeight}px`;
                    }
                });
            },
        }));

        if (templateStatus === "loading") {
            return (
                <Box p="4" borderRadius="sm" className="panels-bg">
                    <Center mt={4}>
                        <Spinner size="sm" speed="0.65s" />
                        <Text ml={2}>Loading template...</Text>
                    </Center>
                </Box>
            );
        }

        return (
            <>
                <Box p={[2, 3, 4]} borderRadius="sm" className="panels-bg">
                    <Flex align="center" justify="space-between">
                        <Flex align="center">
                            <IconButton
                                icon={
                                    isSummaryCollapsed ? (
                                        <ChevronRightIcon />
                                    ) : (
                                        <ChevronDownIcon />
                                    )
                                }
                                onClick={toggleSummaryCollapse}
                                aria-label="Toggle collapse"
                                variant="outline"
                                size="sm"
                                mr="2"
                                className="collapse-toggle"
                            />
                            <HStack spacing={2}>
                                <EditIcon size="1.2em" />
                                <Text as="h3">Note</Text>
                            </HStack>
                        </Flex>
                        <Tooltip
                            label={
                                isNewPatient
                                    ? "Select Template"
                                    : "Template cannot be changed for historical encounters"
                            }
                            aria-label="Template Selector Tooltip"
                        >
                            <Box>
                                <Flex alignItems="center">
                                    <FaFileAlt
                                        style={{ marginRight: "8px" }}
                                        className="pill-box-icons"
                                    />
                                    <Select
                                        placeholder="Select Template"
                                        value={
                                            currentTemplate?.template_key ||
                                            patient?.template_key ||
                                            ""
                                        }
                                        onChange={handleTemplateChange}
                                        size="sm"
                                        width={["100px", "150px", "200px"]}
                                        className="input-style"
                                        isDisabled={!isNewPatient}
                                    >
                                        {/* Show "Historical Template" only for viewing historical encounters */}
                                        {!isNewPatient &&
                                            !isSearchedPatient &&
                                            patient?.template_key &&
                                            !templates?.some(
                                                (t) =>
                                                    t.template_key ===
                                                    patient.template_key,
                                            ) && (
                                                <option
                                                    value={patient.template_key}
                                                >
                                                    Historical Template
                                                </option>
                                            )}

                                        {templates?.map((t) => (
                                            <option
                                                key={t.template_key}
                                                value={t.template_key}
                                            >
                                                {t.template_name}
                                            </option>
                                        ))}
                                    </Select>
                                </Flex>
                            </Box>
                        </Tooltip>
                    </Flex>

                    <Collapse in={!isSummaryCollapsed} animateOpacity>
                        <Box mt="4" borderRadius="sm">
                            <VStack spacing="5">
                                {currentTemplate?.fields?.map(renderField)}
                            </VStack>
                        </Box>
                        <Flex mt="4" justifyContent="space-between">
                            <Flex>
                                <TertiaryButton
                                    onClick={() =>
                                        handleGenerateLetterClick(null)
                                    }
                                    leftIcon={<EditIcon />}
                                    mr="2"
                                    isDisabled={saveLoading}
                                >
                                    Generate Letter
                                </TertiaryButton>
                            </Flex>
                            <Flex>
                                <BlueButton
                                    onClick={onCopy}
                                    width="190px"
                                    leftIcon={
                                        recentlyCopied ? (
                                            <CheckIcon />
                                        ) : (
                                            <CopyIcon />
                                        )
                                    }
                                    mr="2"
                                >
                                    {recentlyCopied
                                        ? "Copied!"
                                        : "Copy to Clipboard"}
                                </BlueButton>
                                <GreenButton
                                    onClick={handleSavePatientData}
                                    isLoading={saveLoading}
                                    loadingText="Saving"
                                    width="190px"
                                    leftIcon={saveLoading ? null : <FaSave />}
                                >
                                    {saveLoading
                                        ? "Saving..."
                                        : "Save Encounter"}
                                </GreenButton>
                            </Flex>
                        </Flex>
                    </Collapse>
                </Box>
                <ConfirmLeaveModal
                    isOpen={isTemplateChangeModalOpen}
                    onClose={() => setIsTemplateChangeModalOpen(false)}
                    confirmNavigation={confirmTemplateChange}
                />
            </>
        );
    },
);

export default Summary;
