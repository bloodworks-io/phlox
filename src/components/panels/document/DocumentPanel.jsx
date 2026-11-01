import { Box, Button, Flex, Input, Spinner, Text, VStack, Alert, ButtonGroup, Badge, SimpleGrid, Separator } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { toaster } from "@/components/ui/toaster";
import {
  LuFileUp,
  LuRedo2,
  LuRotateCcw,
  LuTriangleAlert,
} from "react-icons/lu";
import { CheckIcon } from "../../common/icons";
import { SecondaryButton } from "../../common/Buttons";
import { useState } from "react";
import { useTranscription } from "../../../utils/hooks/useTranscription";
import FloatingPanel from "../../common/FloatingPanel";

const DocumentPanel = ({
  isOpen,
  _onClose,
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
  const { t } = useTranslation();
  const [processingError, setProcessingError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

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
      toaster.create({
        title: t("rag.toast.noFileSelected"),
        description: t("document.selectFileFirst"),
        type: "error",
        duration: 3000,
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
              message: error.message || t("document.processFailed"),
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
          t("document.unexpectedError"),
      });
      setIsProcessing(false);
    }
  };

  const retryProcessing = async () => {
    if (!file) {
      setProcessingError({
        message: t("document.retryNoFile"),
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
        message: t("document.retryFailed"),
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
      toaster.create({
        title: t("document.invalidFileType"),
        description: t("document.invalidFileTypeDesc"),
        type: "error",
        duration: 3000,
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
      position="left-of-fab"
      showArrow={true}
      triggerId="fab-document"
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
          bg="folio.accentSoft"
          zIndex={10}
          borderRadius="lg"
          pointerEvents="none"
        >
          <Text fontWeight="bold" color="folio.accent">
            {t("document.dropHere")}
          </Text>
        </Flex>
      )}
      {/* Header */}
      <Flex
        align="center"
        justify="space-between"
        p="3"
        className="panel-header"
        backgroundColor="folio.paper"
        color="folio.ink"
        borderBottomColor="folio.line"
        flexShrink={0}
      >
        <Flex align="center">
          <LuFileUp size="1em" strokeWidth={1.6} style={{ marginRight: "8px" }} />
          <Text fontWeight="bold">{t("document.title")}</Text>
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
          <Alert.Root
            status="error"
            variant="subtle"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            textAlign="center"
            borderRadius="sm"
            className="anim-fade-scale"
            css={{ animationDuration: "0.2s" }}
          >
            <Flex mb={2}>
              <Alert.Indicator mr={2} asChild><LuTriangleAlert strokeWidth={1.6} /></Alert.Indicator>
              <Alert.Title>{t("document.processingError")}</Alert.Title>
            </Flex>
            <Alert.Description maxWidth="lg">
              {processingError.message}
            </Alert.Description>
            <ButtonGroup mt={4} gap={3}>
              <Button
                onClick={retryProcessing}
                variant="folioPrimary"
                disabled={isProcessing}
                size="sm"><LuRedo2 strokeWidth={1.6} />{isProcessing ? <Spinner size="sm" mr={2} /> : null}
                {t("document.resend")}
              </Button>
              <Button onClick={startNewUpload} variant="folioSecondary" size="sm"><LuRotateCcw strokeWidth={1.6} />{t("document.newDocument")}
                              </Button>
            </ButtonGroup>
          </Alert.Root>
        ) : isProcessing || isTranscribing ? (
          <Flex
            justify="center"
            align="center"
            py={8}
            direction="column"
            className="anim-fade-scale"
            css={{ animationDuration: "0.2s" }}
          >
            <Spinner size="xl" mb={4} />
            <Text>{t("document.processing")}</Text>
          </Flex>
        ) : !extractedDocData ? (
          // Upload UI
          (<VStack
            gap={4}
            width="full"
            align="stretch"
            className="anim-fade-slide-up"
            css={{ animationDuration: "0.2s" }}
          >
            <Text textAlign="center" fontSize="sm">
              {t("document.uploadHint")}
            </Text>
            <VStack width="full" align="center">
              <Input
                type="file"
                onChange={handleFileChange}
                display="none"
                id="doc-file-upload"
                accept=".pdf,.doc,.docx,.txt"
              />
              <SecondaryButton
                px="6"
                leftIcon={<LuFileUp strokeWidth={1.6} />}
                onClick={() =>
                  document.getElementById("doc-file-upload").click()
                }
                size="sm"
              >
                {t("document.choose")}
              </SecondaryButton>
              {docFileName && <Text fontSize="sm">{docFileName}</Text>}
            </VStack>
            {file && (
              <Flex justifyContent="center">
                <Button
                  onClick={handleUpload}
                  disabled={!file}
                  variant="folioPrimary"
                  size="sm"
                >
                  {t("document.process")}
                </Button>
              </Flex>
            )}
          </VStack>)
        ) : (
          // Document processed UI with toggle buttons
          (<Box
            className="anim-fade-slide-up"
            css={{ animationDuration: "0.2s" }}
          >            <Flex justify="space-between" align="center" mb={3}>
              <Text fontWeight="bold" fontSize="sm">
                {docFileName}
              </Text>
              <Button onClick={startNewUpload} size="xs" variant="folioSecondary"><LuFileUp strokeWidth={1.6} />{t("forms.new")}
                              </Button>
            </Flex>
            <Separator my={2} />
            <Text fontStyle="italic" fontSize="xs" mb={2}>
              {t("document.toggleHint")}
            </Text>
            <SimpleGrid columns={[1, 2]} gap={2}>
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
                    borderColor="folio.line"
                  >
                    <Flex justify="space-between" align="center">
                      <Text
                        fontWeight="medium"
                        fontSize="xs"
                        truncate
                        maxWidth="50%"
                        title={field.field_name}
                      >
                        {field.field_name}
                      </Text>
                      {!hasContent ? (
                        <Badge bg="folio.warningSoft" color="folio.warning" fontSize="xs">
                          {t("document.empty")}
                        </Badge>
                      ) : (
                        <Button
                          size="xs"
                          onClick={() => toggleDocumentField(fieldKey)}
                          disabled={!hasContent}
                          variant={isReplaced ? "folioSuccess" : "folioSecondary"}
                          height="20px"
                          minWidth="70px"
                          fontSize="xs">{
                            isReplaced ? (
                              <CheckIcon
                                boxSize="2"
                                className="anim-fade-scale"
                                css={{ animationDuration: "0.2s" }}
                              />
                            ) : null
                          }{isReplaced ? t("document.using") : t("document.use")}</Button>
                      )}
                    </Flex>
                  </Box>
                );
              })}
            </SimpleGrid>
          </Box>)
        )}
      </Box>
    </FloatingPanel>
  );
};

export default DocumentPanel;
