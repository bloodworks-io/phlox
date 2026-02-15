import {
  Box,
  Button,
  Flex,
  Input,
  Spinner,
  Text,
  VStack,
  useToast,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  ButtonGroup,
  Divider,
  Badge,
  Tooltip,
  SimpleGrid,
  useColorMode,
} from "@chakra-ui/react";
import {
  FaFileUpload,
  FaRedo,
  FaExclamationTriangle,
  FaRedoAlt,
} from "react-icons/fa";
import { CheckIcon } from "@chakra-ui/icons";
import { GreyButton } from "../../common/Buttons";
import { useState } from "react";
import { useTranscription } from "../../../utils/hooks/useTranscription";
import FloatingPanel from "../../common/FloatingPanel";

const DocumentPanel = ({
  isOpen,
  onClose,
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
  const [isDragOver, setIsDragOver] = useState(false);
  const toast = useToast();
  const { colorMode } = useColorMode();

  const { processDocument, isTranscribing } = useTranscription(
    null,
    setLoading,
  );

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setDocFileName(e.target.files[0].name);
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
        { name, dob, gender, templateKey: template?.template_key },
        {
          handleComplete: (data) => {
            handleDocumentComplete(data);
            setIsProcessing(false);
          },
          handleError: (error) => {
            setProcessingError({
              message: error.message || "Failed to process document",
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
        message: "No document available to retry. Please upload a file again.",
      });
      return;
    }

    setIsProcessing(true);
    setProcessingError(null);
    resetDocumentState();

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
    resetDocumentState();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const droppedFile = files[0];
    const validTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    if (
      !validTypes.includes(droppedFile.type) &&
      !droppedFile.name.match(/\.(pdf|doc|docx|txt)$/i)
    ) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, Word document, or text file.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setFile(droppedFile);
    setDocFileName(droppedFile.name);
    setProcessingError(null);
  };

  return (
    <FloatingPanel
      isOpen={isOpen}
      className="floating-panel"
      position="left-of-fab"
      showArrow={true}
      width="90%"
      maxWidth="600px"
    >
      {/* Drag overlay */}
      {isDragOver && (
        <Flex
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          align="center"
          justify="center"
          bg="rgba(255,107,53,0.1)"
          zIndex={10}
          borderRadius="lg"
          pointerEvents="none"
        >
          <Text fontWeight="bold" color="primaryButton">
            Drop document here
          </Text>
        </Flex>
      )}

      {/* Header */}
      <Flex
        align="center"
        justify="space-between"
        p="4"
        className="panel-header"
        flexShrink={0}
      >
        <Flex align="center">
          <FaFileUpload size="1em" style={{ marginRight: "8px" }} />
          <Text fontWeight="bold">Document Upload</Text>
        </Flex>
      </Flex>

      {/* Content */}
      <Box
        p={4}
        maxH="400px"
        overflowY="auto"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Processing error state */}
        {processingError ? (
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
                size="sm"
              >
                {isProcessing ? <Spinner size="sm" mr={2} /> : null}
                Resend
              </Button>
              <Button
                leftIcon={<FaRedo />}
                onClick={startNewUpload}
                className="orange-button"
                size="sm"
              >
                New Document
              </Button>
            </ButtonGroup>
          </Alert>
        ) : isProcessing || isTranscribing ? (
          <Flex justify="center" align="center" py={8} direction="column">
            <Spinner size="xl" mb={4} />
            <Text>Processing document...</Text>
          </Flex>
        ) : !extractedDocData ? (
          // Upload UI
          <VStack spacing={4} width="full" align="stretch">
            <Text textAlign="center" fontSize="sm">
              Upload a referral letter or other document to extract information.
            </Text>
            <VStack width="full" align="center">
              <Input
                type="file"
                onChange={handleFileChange}
                display="none"
                id="doc-file-upload"
                accept=".pdf,.doc,.docx,.txt"
              />
              <GreyButton
                px="6"
                leftIcon={<FaFileUpload />}
                onClick={() =>
                  document.getElementById("doc-file-upload").click()
                }
                size="sm"
              >
                Choose Document
              </GreyButton>
              {docFileName && <Text fontSize="sm">{docFileName}</Text>}
            </VStack>
            {file && (
              <Flex justifyContent="center">
                <Button
                  onClick={handleUpload}
                  isDisabled={!file}
                  className="green-button"
                  size="sm"
                >
                  Process Document
                </Button>
              </Flex>
            )}
          </VStack>
        ) : (
          // Document processed UI with toggle buttons
          <>
            <Flex justify="space-between" align="center" mb={3}>
              <Text fontWeight="bold" fontSize="sm">
                {docFileName}
              </Text>
              <Button
                leftIcon={<FaFileUpload />}
                onClick={startNewUpload}
                size="xs"
                className="orange-button"
              >
                New
              </Button>
            </Flex>
            <Divider my={2} />
            <Text fontStyle="italic" fontSize="xs" mb={2}>
              Click buttons to toggle document content
            </Text>
            <SimpleGrid columns={[1, 2]} spacing={2}>
              {template?.fields?.map((field) => {
                const fieldKey = field.field_key;
                const hasContent = Boolean(
                  extractedDocData?.fields[fieldKey]?.trim(),
                );
                const isReplaced = replacedFields[fieldKey];

                return (
                  <Box
                    key={fieldKey}
                    p={2}
                    borderWidth="1px"
                    borderRadius="sm"
                    borderColor={
                      colorMode === "light" ? "gray.200" : "gray.700"
                    }
                  >
                    <Flex justify="space-between" align="center">
                      <Text
                        fontWeight="medium"
                        fontSize="xs"
                        isTruncated
                        maxWidth="50%"
                        title={field.field_name}
                      >
                        {field.field_name}
                      </Text>
                      {!hasContent ? (
                        <Badge colorScheme="yellow" fontSize="xs">
                          Empty
                        </Badge>
                      ) : (
                        <Button
                          size="xs"
                          onClick={() => toggleDocumentField(fieldKey)}
                          isDisabled={!hasContent}
                          className={
                            isReplaced ? "green-button" : "grey-button"
                          }
                          variant={isReplaced ? "solid" : "outline"}
                          leftIcon={
                            isReplaced ? <CheckIcon boxSize="2" /> : null
                          }
                          height="20px !important"
                          minWidth="70px"
                          fontSize="xs"
                        >
                          {isReplaced ? "Using" : "Use"}
                        </Button>
                      )}
                    </Flex>
                  </Box>
                );
              })}
            </SimpleGrid>
          </>
        )}
      </Box>
    </FloatingPanel>
  );
};

export default DocumentPanel;
