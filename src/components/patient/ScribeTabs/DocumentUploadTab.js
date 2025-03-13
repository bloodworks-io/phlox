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
    SimpleGrid,
    Spacer,
} from "@chakra-ui/react";
import {
    FaFileUpload,
    FaRedo,
    FaExclamationTriangle,
    FaRedoAlt,
    FaArrowRight,
    FaArrowLeft,
} from "react-icons/fa";
import { CheckIcon } from "@chakra-ui/icons";
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
                            <Text textAlign="center">
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
                                <Flex justifyContent="center">
                                    <Button
                                        colorScheme="blue"
                                        onClick={handleUpload}
                                        isDisabled={!file}
                                        className="green-button"
                                        width="auto"
                                        px={6}
                                    >
                                        Process Document
                                    </Button>
                                </Flex>
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

                            <Divider my={3} />

                            <Text fontStyle="italic" fontSize="sm" mb={3}>
                                Click buttons to toggle document content
                            </Text>

                            <SimpleGrid columns={[1, 2, 3, 4]} spacing={3}>
                                {template?.fields?.map((field) => {
                                    const fieldKey = field.field_key;
                                    const hasContent = Boolean(
                                        extractedDocData?.fields[
                                            fieldKey
                                        ]?.trim(),
                                    );
                                    const isReplaced = replacedFields[fieldKey];

                                    return (
                                        <Box
                                            key={fieldKey}
                                            p={2}
                                            borderWidth="1px"
                                            borderRadius="sm"
                                        >
                                            <Flex
                                                justify="space-between"
                                                align="center"
                                            >
                                                <Text
                                                    fontWeight="medium"
                                                    fontSize="sm"
                                                    isTruncated
                                                    maxWidth="50%"
                                                    title={field.field_name}
                                                >
                                                    {field.field_name}
                                                </Text>

                                                {!hasContent ? (
                                                    <Badge
                                                        colorScheme="yellow"
                                                        fontSize="xs"
                                                    >
                                                        No content
                                                    </Badge>
                                                ) : (
                                                    <Button
                                                        size="xs"
                                                        onClick={() =>
                                                            toggleDocumentField(
                                                                fieldKey,
                                                            )
                                                        }
                                                        isDisabled={!hasContent}
                                                        borderRadius="sm !important"
                                                        className={
                                                            isReplaced
                                                                ? "green-button"
                                                                : "template-select-button"
                                                        }
                                                        variant={
                                                            isReplaced
                                                                ? "solid"
                                                                : "outline"
                                                        }
                                                        leftIcon={
                                                            isReplaced ? (
                                                                <CheckIcon boxSize="3" />
                                                            ) : null
                                                        }
                                                        height="24px !important"
                                                        minWidth="80px"
                                                    >
                                                        {isReplaced
                                                            ? "Using doc"
                                                            : "Use doc"}
                                                    </Button>
                                                )}
                                            </Flex>
                                        </Box>
                                    );
                                })}
                            </SimpleGrid>
                        </>
                    )}
                </VStack>
            )}
        </Box>
    );
};

export default DocumentUploadTab;
