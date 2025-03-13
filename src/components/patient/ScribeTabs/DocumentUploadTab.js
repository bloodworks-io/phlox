import {
    Box,
    Button,
    Flex,
    Input,
    Spinner,
    Text,
    VStack,
    HStack,
    useToast,
    Alert,
    AlertIcon,
    AlertTitle,
    AlertDescription,
    ButtonGroup,
    Divider,
    Badge,
    IconButton,
    Tooltip,
} from "@chakra-ui/react";
import {
    FaFileUpload,
    FaRedo,
    FaExclamationTriangle,
    FaRedoAlt,
    FaArrowRight,
    FaArrowLeft,
} from "react-icons/fa";
import { useState } from "react";
import { useTranscription } from "../../../utils/hooks/useTranscription";

const DocumentUploadTab = ({
    handleDocumentComplete,
    toggleDocumentField,
    replacedFields,
    extractedDocData,
    resetDocumentState,
    name,
    dob,
    gender,
    setLoading,
    template,
    docFileName,
    setDocFileName,
}) => {
    const [file, setFile] = useState(null);

    const [processingError, setProcessingError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const toast = useToast();

    const { processDocument, isTranscribing } = useTranscription(
        null,
        setLoading,
    );

    const handleFileChange = (e) => {
        if (e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setDocFileName(e.target.files[0].name); // Use parent state
            setProcessingError(null);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            toast({
                title: "No file selected",
                description: "Please select a file to upload",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
            return;
        }

        setIsProcessing(true);
        setProcessingError(null);

        try {
            const result = await processDocument(
                file,
                {
                    name,
                    dob,
                    gender,
                    templateKey: template?.template_key,
                },
                {
                    handleComplete: (data) => {
                        // Pass the data up to parent - don't manage state locally
                        handleDocumentComplete(data);
                        setIsProcessing(false);
                    },
                    handleError: (error) => {
                        setProcessingError({
                            message:
                                error.message || "Failed to process document",
                        });
                        setIsProcessing(false);
                    },
                },
            );

            return result;
        } catch (error) {
            console.error("Error processing document:", error);
            setProcessingError({
                message:
                    error.message ||
                    "An unexpected error occurred while processing the document",
            });
            setIsProcessing(false);
        }
    };

    const retryProcessing = async () => {
        if (!file) {
            setProcessingError({
                message:
                    "No document available to retry. Please upload a file again.",
            });
            return;
        }

        setIsProcessing(true);
        setProcessingError(null);
        resetDocumentState(); // Reset in parent

        try {
            await handleUpload();
        } catch (error) {
            console.error("Error retrying document processing:", error);
            setProcessingError({
                message:
                    "Processing retry failed. The server might be experiencing issues.",
            });
            setIsProcessing(false);
        }
    };

    const startNewUpload = () => {
        setFile(null);
        setDocFileName("");
        setProcessingError(null);
        resetDocumentState(); // Reset in parent
    };

    // If there's a processing error, show the error UI
    if (processingError) {
        return (
            <Box width="100%">
                <Alert
                    status="error"
                    variant="subtle"
                    flexDirection="column"
                    alignItems="center"
                    justifyContent="center"
                    textAlign="center"
                    borderRadius="sm"
                >
                    <Flex mb={2}>
                        <AlertIcon as={FaExclamationTriangle} mr={2} />
                        <AlertTitle>Processing Error</AlertTitle>
                    </Flex>
                    <AlertDescription maxWidth="lg">
                        {processingError.message}
                    </AlertDescription>
                    <ButtonGroup mt={4} spacing={3}>
                        <Button
                            leftIcon={<FaRedoAlt />}
                            onClick={retryProcessing}
                            className="green-button"
                            isDisabled={isProcessing}
                        >
                            {isProcessing ? <Spinner size="sm" mr={2} /> : null}
                            Resend Document
                        </Button>
                        <Button
                            leftIcon={<FaRedo />}
                            onClick={startNewUpload}
                            className="blue-button"
                        >
                            Upload New Document
                        </Button>
                    </ButtonGroup>
                </Alert>
            </Box>
        );
    }

    // Upload UI with optional field toggles
    return (
        <Box className="tab-panel-container">
            {isProcessing || isTranscribing ? (
                <Flex
                    justify="center"
                    align="center"
                    height="100px"
                    direction="column"
                >
                    <Spinner size="xl" mb={4} />
                    <Text>Processing document...</Text>
                </Flex>
            ) : (
                <VStack spacing={4} width="full" align="stretch">
                    {!extractedDocData ? (
                        // Initial upload UI
                        <>
                            <Text>
                                Upload a referral letter or other document to
                                extract information.
                            </Text>

                            <VStack width="full" align="center">
                                <Input
                                    type="file"
                                    onChange={handleFileChange}
                                    display="none"
                                    id="file-upload"
                                    accept=".pdf,.doc,.docx,.txt"
                                    className="input-style"
                                />
                                <Button
                                    px="10"
                                    leftIcon={<FaFileUpload />}
                                    onClick={() =>
                                        document
                                            .getElementById("file-upload")
                                            .click()
                                    }
                                    className="blue-button"
                                >
                                    Choose Document
                                </Button>
                                {docFileName && (
                                    <Text fontSize="sm">{docFileName}</Text>
                                )}
                            </VStack>

                            {file && (
                                <Button
                                    colorScheme="blue"
                                    onClick={handleUpload}
                                    isDisabled={!file}
                                    className="green-button"
                                >
                                    Process Document
                                </Button>
                            )}
                        </>
                    ) : (
                        // Document processed UI with toggle buttons
                        <>
                            <Flex justify="space-between" align="center">
                                <Text fontWeight="bold">
                                    Document: {docFileName}
                                </Text>
                                <Button
                                    leftIcon={<FaFileUpload />}
                                    onClick={startNewUpload}
                                    size="sm"
                                    className="blue-button"
                                >
                                    Upload New Document
                                </Button>
                            </Flex>

                            <Divider />

                            <Text fontStyle="italic" fontSize="sm" mb={2}>
                                Click the arrow buttons to toggle between
                                document content and original text
                            </Text>

                            <VStack spacing={2} align="stretch">
                                {template?.fields?.map((field) => {
                                    const fieldKey = field.field_key;
                                    const hasContent = Boolean(
                                        extractedDocData?.fields[
                                            fieldKey
                                        ]?.trim(),
                                    );
                                    const isReplaced = replacedFields[fieldKey];

                                    return (
                                        <Flex
                                            key={fieldKey}
                                            p={2}
                                            borderWidth="1px"
                                            borderRadius="md"
                                            justify="space-between"
                                            align="center"
                                            bg={
                                                isReplaced && hasContent
                                                    ? "green.50"
                                                    : "white"
                                            }
                                        >
                                            <HStack>
                                                <Text fontWeight="medium">
                                                    {field.field_name}
                                                </Text>
                                                {!hasContent && (
                                                    <Badge
                                                        colorScheme="yellow"
                                                        fontSize="xs"
                                                    >
                                                        No content found
                                                    </Badge>
                                                )}
                                                {isReplaced && hasContent && (
                                                    <Badge
                                                        colorScheme="green"
                                                        fontSize="xs"
                                                    >
                                                        Using document content
                                                    </Badge>
                                                )}
                                            </HStack>

                                            <Tooltip
                                                label={
                                                    isReplaced
                                                        ? "Restore original content"
                                                        : hasContent
                                                          ? "Use document content"
                                                          : "No content available in document"
                                                }
                                            >
                                                <IconButton
                                                    icon={
                                                        isReplaced ? (
                                                            <FaArrowLeft />
                                                        ) : (
                                                            <FaArrowRight />
                                                        )
                                                    }
                                                    onClick={() =>
                                                        toggleDocumentField(
                                                            fieldKey,
                                                        )
                                                    }
                                                    aria-label="Toggle field content"
                                                    isDisabled={!hasContent}
                                                    colorScheme={
                                                        isReplaced
                                                            ? "blue"
                                                            : "green"
                                                    }
                                                    size="sm"
                                                />
                                            </Tooltip>
                                        </Flex>
                                    );
                                })}
                            </VStack>
                        </>
                    )}
                </VStack>
            )}
        </Box>
    );
};

export default DocumentUploadTab;
