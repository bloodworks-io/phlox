import {
    useEffect,
    useRef,
    forwardRef,
    useImperativeHandle,
    useState,
} from "react";
import {
    Box,
    Flex,
    IconButton,
    Text,
    Collapse,
    HStack,
    VStack,
    Textarea,
    Button,
    Spinner,
    useClipboard,
    Tooltip,
} from "@chakra-ui/react";
import {
    ChevronRightIcon,
    ChevronDownIcon,
    CopyIcon,
    CheckIcon,
    RepeatIcon,
    EditIcon,
    CloseIcon,
} from "@chakra-ui/icons";
import { FaEnvelope, FaSave } from "react-icons/fa";
import { letterApi } from "../../utils/api/letterApi";
import { settingsApi } from "../../utils/api/settingsApi";

const RefinementInterface = ({
    refinementInput,
    setRefinementInput,
    handleRefinement,
    loading,
    setIsRefining,
    setIsModified,
    handleSaveLetter,
}) => (
    <Box
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        width="90%"
        maxWidth="500px"
        zIndex={2}
        className="chat-panel"
        borderRadius="xl"
        boxShadow="lg"
    >
        {loading && (
            <Flex
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                zIndex={3}
                justify="center"
                align="center"
                bg="rgba(255, 255, 255, 0.4)"
                borderRadius="xl"
            >
                <Spinner size="xl" />
            </Flex>
        )}
        <Flex
            align="center"
            justify="space-between"
            p="3"
            borderBottom="1px"
            borderColor="gray.200"
        >
            <Flex align="center">
                <EditIcon mr={2} />
                <Text fontSize="sm" fontWeight="medium">
                    Refine Letter
                </Text>
            </Flex>
            <IconButton
                icon={<CloseIcon boxSize="12px" />}
                onClick={() => setIsRefining(false)}
                aria-label="Close refinement"
                variant="ghost"
                size="sm"
                className="collapse-toggle"
            />
        </Flex>

        <Box p="3">
            <Flex wrap="wrap" gap={2} mb="3">
                {[
                    "More formal",
                    "More concise",
                    "Add detail",
                    "Improve clarity",
                ].map((suggestion) => (
                    <Button
                        key={suggestion}
                        size="xs"
                        onClick={() => setRefinementInput(suggestion)}
                        className="chat-suggestions"
                    >
                        {suggestion}
                    </Button>
                ))}
            </Flex>

            <Textarea
                placeholder="How would you like to improve the letter?"
                value={refinementInput}
                onChange={(e) => setRefinementInput(e.target.value)}
                size="sm"
                rows={3}
                mb="3"
                className="chat-input"
                fontSize="sm"
                resize="none"
            />

            <Flex justify="center">
                <Button
                    onClick={handleRefinement}
                    isLoading={loading}
                    loadingText="Refining..."
                    size="sm"
                    className="refinement-submit-button"
                    leftIcon={<EditIcon />}
                >
                    Refine
                </Button>
            </Flex>
        </Box>
    </Box>
);

const Letter = forwardRef(
    (
        {
            isLetterCollapsed,
            toggleLetterCollapse,
            finalCorrespondence,
            setFinalCorrespondence,
            handleSaveLetter,
            loading: letterLoading,
            handleGenerateLetterClick,
            handleRefineLetter,
            setIsModified,
            toast,
            patient,
            setLoading: setGeneralLoading,
        },
        ref,
    ) => {
        const textareasRefs = useRef({});
        const [recentlyCopied, setRecentlyCopied] = useState(false);
        const [saveState, setSaveState] = useState("idle");
        const { onCopy } = useClipboard(
            finalCorrespondence || "No letter attached to encounter",
        );
        const saveTimerRef = useRef(null);
        const [additionalInstructions, setAdditionalInstructions] =
            useState("");
        const [letterTemplates, setLetterTemplates] = useState([]);
        const [defaultTemplateId, setDefaultTemplateId] = useState(null);
        const [selectedTemplate, setSelectedTemplate] = useState(null);
        const [isRefining, setIsRefining] = useState(false);
        const [refinementInput, setRefinementInput] = useState("");
        const [letterContext, setLetterContext] = useState([]);
        const [options, setOptions] = useState(null);

        useEffect(() => {
            const fetchOptions = async () => {
                try {
                    const response = await settingsApi.fetchOptions();
                    setOptions(response);
                } catch (error) {
                    console.error("Failed to fetch options:", error);
                }
            };
            fetchOptions();
        }, []);

        useEffect(() => {
            letterApi
                .fetchLetterTemplates()
                .then((response) => {
                    setLetterTemplates(response.templates);
                    if (response.default_template_id) {
                        setDefaultTemplateId(response.default_template_id);

                        // Reset to default template when patient changes or component mounts
                        const defaultTpl = response.templates.find(
                            (t) => t.id === response.default_template_id,
                        );
                        if (defaultTpl) {
                            setSelectedTemplate(defaultTpl);
                            // Set initial instructions from default template
                            setAdditionalInstructions(
                                defaultTpl.instructions || "",
                            );
                        }
                    }
                })
                .catch((err) =>
                    console.error("Error fetching letter templates:", err),
                );
        }, [patient?.id]);

        const handleCopy = () => {
            onCopy();
            setRecentlyCopied(true);
            setTimeout(() => setRecentlyCopied(false), 2000);
        };

        const handleSave = async () => {
            setSaveState("saving");
            try {
                await handleSaveLetter();
                setSaveState("saved");
                setTimeout(() => setSaveState("idle"), 2000);
            } catch (error) {
                console.error("Error saving letter:", error);
                setSaveState("idle");
            }
        };

        useEffect(() => {
            return () => {
                if (saveTimerRef.current) {
                    clearTimeout(saveTimerRef.current);
                }
            };
        }, []);

        const getSaveButtonProps = () => {
            switch (saveState) {
                case "saving":
                    return {
                        leftIcon: <Spinner size="sm" />,
                        children: "Saving...",
                    };
                case "saved":
                    return {
                        leftIcon: <CheckIcon />,
                        children: "Saved!",
                    };
                default:
                    return {
                        leftIcon: <FaSave />,
                        children: "Save Letter",
                    };
            }
        };

        useImperativeHandle(ref, () => ({
            autoResizeTextarea: () => {
                autoResizeTextarea();
            },
        }));

        const autoResizeTextarea = () => {
            const textarea = textareasRefs.current.letter;
            if (textarea) {
                textarea.style.height = "auto";
                textarea.style.height = textarea.scrollHeight + "px";
            }
        };

        useEffect(() => {
            if (!isLetterCollapsed) {
                setTimeout(() => {
                    autoResizeTextarea();
                }, 100);
            }
        }, [isLetterCollapsed]);

        useEffect(() => {
            if (finalCorrespondence) autoResizeTextarea();
        }, [finalCorrespondence]);

        const handleGenerateClick = async () => {
            let instructions;
            if (selectedTemplate === "custom") {
                instructions = additionalInstructions;
            } else if (selectedTemplate && selectedTemplate.instructions) {
                instructions = selectedTemplate.instructions;
            } else if (!selectedTemplate && defaultTemplateId) {
                const defaultTpl = letterTemplates.find(
                    (t) => t.id === defaultTemplateId,
                );
                instructions = defaultTpl
                    ? defaultTpl.instructions
                    : additionalInstructions;
            } else {
                instructions = additionalInstructions;
            }

            try {
                const response = await letterApi.generateLetter({
                    patientName: patient.name,
                    gender: patient.gender,
                    template_data: patient.template_data,
                    additional_instruction: instructions,
                });

                setLetterContext([
                    {
                        role: "assistant",
                        content: response.letter,
                    },
                ]);
                setFinalCorrespondence(response.letter);
            } catch (error) {
                console.error("Letter generation error:", error);
                toast({
                    title: "Error",
                    description: "Failed to generate letter",
                    status: "error",
                    duration: 3000,
                    isClosable: true,
                });
            }
        };

        const handleRefinement = async () => {
            await handleRefineLetter({
                patient,
                additionalInstructions,
                refinementInput,
                options,
                onSuccess: () => {
                    setRefinementInput("");
                    setIsRefining(false);
                },
            });
        };

        return (
            <Box p="4" borderRadius="sm" className="panels-bg">
                <Flex align="center" justify="space-between">
                    <Flex align="center">
                        <IconButton
                            icon={
                                isLetterCollapsed ? (
                                    <ChevronRightIcon />
                                ) : (
                                    <ChevronDownIcon />
                                )
                            }
                            onClick={toggleLetterCollapse}
                            aria-label="Toggle collapse"
                            variant="outline"
                            size="sm"
                            mr="2"
                            className="collapse-toggle"
                        />
                        <HStack spacing={2}>
                            <FaEnvelope size="1.2em" />
                            <Text as="h3">Letter</Text>
                        </HStack>
                    </Flex>
                </Flex>
                <Collapse in={!isLetterCollapsed} animateOpacity>
                    <Box mt="4" borderRadius="sm">
                        <VStack spacing="5">
                            <Box width="100%" position="relative">
                                {letterLoading && (
                                    <Flex
                                        position="absolute"
                                        top={0}
                                        left={0}
                                        right={0}
                                        bottom={0}
                                        zIndex={1}
                                        justify="center"
                                        align="center"
                                        borderRadius="sm"
                                    >
                                        <Spinner size="xl" />
                                    </Flex>
                                )}
                                <Box
                                    position="relative"
                                    className="textarea-container"
                                >
                                    <Textarea
                                        placeholder="Write your letter here..."
                                        value={
                                            finalCorrespondence ||
                                            "No letter attached to encounter"
                                        }
                                        onChange={(e) => {
                                            setFinalCorrespondence(
                                                e.target.value,
                                            );
                                            setIsModified(true);
                                            autoResizeTextarea();
                                        }}
                                        rows={10}
                                        style={{
                                            minHeight: "150px",
                                            overflowY: "hidden",
                                            resize: "none",
                                            color: letterLoading
                                                ? "rgba(0, 0, 0, 0.4)"
                                                : "inherit",
                                            transition:
                                                "color 0.2s ease-in-out",
                                            filter: letterLoading
                                                ? "blur(0.4px)"
                                                : "none",
                                            paddingBottom: "50px",
                                        }}
                                        className="textarea-style"
                                        ref={(el) =>
                                            (textareasRefs.current.letter = el)
                                        }
                                    />
                                    <Tooltip
                                        label="Refine letter"
                                        placement="left"
                                        isDisabled={letterLoading}
                                    >
                                        <IconButton
                                            icon={<EditIcon />}
                                            position="absolute"
                                            bottom={4}
                                            width="40px"
                                            height="40px"
                                            right={4}
                                            sx={{
                                                opacity: 1,
                                                zIndex: 2,
                                                transition: "transform 0.2s",
                                                aspectRatio: "1/1",
                                                pointerEvents: letterLoading
                                                    ? "none"
                                                    : "auto",
                                                "&:hover": !letterLoading && {
                                                    transform: "scale(1.1)",
                                                },
                                            }}
                                            className="blue-button refinement-fab"
                                            onClick={() => setIsRefining(true)}
                                            aria-label="Refine letter"
                                            isDisabled={letterLoading}
                                        />
                                    </Tooltip>
                                </Box>
                                {isRefining && (
                                    <RefinementInterface
                                        refinementInput={refinementInput}
                                        setRefinementInput={setRefinementInput}
                                        handleRefinement={handleRefinement}
                                        loading={letterLoading}
                                        setIsRefining={setIsRefining}
                                    />
                                )}
                            </Box>
                        </VStack>
                    </Box>
                    <Box mb="4">
                        <Text mt="2" mb="2" fontSize="sm" fontWeight="bold">
                            Letter Template:
                        </Text>
                        <HStack spacing="2">
                            {letterTemplates.map((template) => (
                                <Button
                                    key={template.id}
                                    size="sm"
                                    variant={
                                        selectedTemplate &&
                                        selectedTemplate.id === template.id
                                            ? "solid"
                                            : "outline"
                                    }
                                    onClick={() => {
                                        setSelectedTemplate(template);
                                        setAdditionalInstructions(
                                            template.instructions || "",
                                        );
                                    }}
                                    className="template-select-button"
                                >
                                    {template.name}
                                </Button>
                            ))}
                            <Button
                                size="sm"
                                variant={
                                    selectedTemplate === "custom"
                                        ? "solid"
                                        : "outline"
                                }
                                onClick={() => setSelectedTemplate("custom")}
                                className="template-select-button"
                            >
                                Custom
                            </Button>
                        </HStack>
                    </Box>
                    {selectedTemplate === "custom" && (
                        <Box mt="4">
                            <Text fontSize="sm" mb="2">
                                Custom Instructions:
                            </Text>
                            <Textarea
                                placeholder="Enter custom instructions for letter generation..."
                                size="sm"
                                rows={2}
                                value={additionalInstructions}
                                onChange={(e) =>
                                    setAdditionalInstructions(e.target.value)
                                }
                                className="chat-input"
                                sx={{
                                    paddingY: "2",
                                    paddingX: "4",
                                    minHeight: "40px",
                                    resize: "none",
                                }}
                            />
                        </Box>
                    )}
                    <Flex mt="4" justifyContent="space-between">
                        <Button
                            onClick={() =>
                                handleGenerateLetterClick(
                                    additionalInstructions,
                                )
                            }
                            className="tertiary-button"
                            leftIcon={<RepeatIcon />}
                            isDisabled={letterLoading || saveState !== "idle"}
                        >
                            Regenerate Letter
                        </Button>
                        <Flex>
                            <Button
                                onClick={handleCopy}
                                className="blue-button"
                                leftIcon={
                                    recentlyCopied ? (
                                        <CheckIcon />
                                    ) : (
                                        <CopyIcon />
                                    )
                                }
                                mr="2"
                                width="150px"
                                isDisabled={letterLoading}
                            >
                                {recentlyCopied ? "Copied!" : "Copy Letter"}
                            </Button>
                            <Button
                                onClick={handleSave}
                                className="green-button"
                                width="150px"
                                isDisabled={
                                    letterLoading || saveState !== "idle"
                                }
                                {...getSaveButtonProps()}
                            />
                        </Flex>
                    </Flex>
                </Collapse>
            </Box>
        );
    },
);

export default Letter;
