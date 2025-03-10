import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Input,
    Stack,
    Text,
    VStack,
    useToast,
} from "@chakra-ui/react";
import { FaFileUpload } from "react-icons/fa";
import { useState } from "react";
import { useTranscription } from "../../../utils/hooks/useTranscription";

const DocumentUploadTab = ({
    handleDocumentComplete,
    name,
    dob,
    gender,
    setLoading,
}) => {
    const [file, setFile] = useState(null);
    const [fileName, setFileName] = useState("");
    const toast = useToast();

    const { processDocument, isTranscribing } = useTranscription(
        null,
        setLoading,
    );

    const handleFileChange = (e) => {
        if (e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setFileName(e.target.files[0].name);
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

        try {
            const result = await processDocument(
                file,
                { name, dob, gender },
                {
                    handleComplete: (data) => {
                        handleDocumentComplete({
                            primaryHistory: data.primaryHistory,
                            additionalHistory: data.additionalHistory,
                            investigations: data.investigations,
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
                    },
                    handleError: (error) => {
                        toast({
                            title: "Processing failed",
                            description:
                                error.message || "Failed to process document",
                            status: "error",
                            duration: 5000,
                            isClosable: true,
                        });
                    },
                },
            );

            return result;
        } catch (error) {
            console.error("Error processing document:", error);
        }
    };

    return (
        <Box className="tab-panel-container">
            <VStack spacing={4} width="full">
                <Text>
                    Upload a referral letter or other document to extract
                    information.
                </Text>

                <FormControl>
                    <FormLabel>Select Document</FormLabel>
                    <Stack direction="row" alignItems="center">
                        <Input
                            type="file"
                            onChange={handleFileChange}
                            display="none"
                            id="file-upload"
                            accept=".pdf,.doc,.docx,.txt"
                        />
                        <Button
                            leftIcon={<FaFileUpload />}
                            onClick={() =>
                                document.getElementById("file-upload").click()
                            }
                            w="fit-content"
                        >
                            Choose File
                        </Button>
                        <Text>{fileName || "No file selected"}</Text>
                    </Stack>
                </FormControl>

                <Button
                    colorScheme="blue"
                    isLoading={isTranscribing}
                    onClick={handleUpload}
                    isDisabled={!file}
                >
                    Process Document
                </Button>
            </VStack>
        </Box>
    );
};

export default DocumentUploadTab;
