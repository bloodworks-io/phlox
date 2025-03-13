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
} from "@chakra-ui/react";
import {
    FaFileUpload,
    FaRedo,
    FaExclamationTriangle,
    FaRedoAlt,
} from "react-icons/fa";
import { useState } from "react";
import { useTranscription } from "../../../utils/hooks/useTranscription";

const DocumentUploadTab = ({
    handleDocumentComplete,
    name,
    dob,
    gender,
    setLoading,
    template,
}) => {
    const [file, setFile] = useState(null);
    const [fileName, setFileName] = useState("");
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
            setFileName(e.target.files[0].name);
            // Clear any previous error state when a new file is selected
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
                    templateKey: template?.template_key, // Pass template key to backend
                },
                {
                    handleComplete: (data) => {
                        // Update to handle fields from template-based response
                        handleDocumentComplete({
                            fields: data.fields, // Template fields
                            rawTranscription: data.rawTranscription || "",
                            processDuration: data.processDuration,
                        });

                        toast({
                            title: "Document processed",
                            description:
                                "Document has been successfully processed",
                            status: "success",
                            duration: 3000,
                            isClosable: true,
                        });
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
        setFileName("");
        setProcessingError(null);
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

    return (
        <Box className="tab-panel-container">
            {isProcessing || isTranscribing ? (
                <Flex justify="center" align="center" height="100px">
                    <Spinner size="xl" />
                </Flex>
            ) : (
                <VStack spacing={4} width="full">
                    <Text>
                        Upload a referral letter or other document to extract
                        information.
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
                                document.getElementById("file-upload").click()
                            }
                            className="blue-button"
                        >
                            Choose Document
                        </Button>
                        {fileName && <Text fontSize="sm">{fileName}</Text>}
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
                </VStack>
            )}
        </Box>
    );
};

export default DocumentUploadTab;
