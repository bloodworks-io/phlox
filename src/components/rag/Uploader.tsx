// Component for uploading and vectorizing documents into the RAG database.
import React, { useState } from "react";
import { Field, Box, Text, Flex, HStack, VStack, Input, Button, IconButton, Collapsible, Tabs } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { ChevronDownIcon, ChevronRightIcon, AddIcon } from "../common/icons";
import { MdFileUpload } from "react-icons/md";
import { FaCloudUploadAlt } from "react-icons/fa";
import { ragApi } from "../../utils/api/ragApi";
import { extractPdfMetadata } from "../../utils/helpers/pdfExtractHelpers";
import BulkUploader from "./BulkUploader";
import { useTranslation } from "react-i18next";
import type {
    DocumentCollection,
    PdfMetadataResult,
} from "./types";

interface UploaderProps {
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
    setCollections: React.Dispatch<React.SetStateAction<DocumentCollection[]>>;
}

const Uploader = ({ isCollapsed, setIsCollapsed, setCollections }: UploaderProps) => {
    const { t } = useTranslation();
    const [pdfFile, setPdfFile] = useState<File | null>(null);

    const [, setSuggestedCollection] = useState("");
    const [customCollectionName, setCustomCollectionName] = useState("");
    const [documentSource, setDocumentSource] = useState("");
    const [focusArea, setFocusArea] = useState("");
    const [title, setTitle] = useState("");
    const [filename, setFilename] = useState("");
    const [pdfData, setPdfData] = useState<PdfMetadataResult | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    const handlePdfUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setPdfFile(file);
        setFilename(file.name);
    };
    const handleExtractPdfInfo = async () => {
        setIsExtracting(true);
        try {
            if (!pdfFile) {
                toaster.create({
                    title: t("rag.toast.noFileSelected"),
                    description: t("rag.toast.selectPdfToUpload"),
                    type: "warning",
                    duration: 3000,
                });
                return;
            }

            const result = (await extractPdfMetadata(
                pdfFile,
            )) as PdfMetadataResult;

            setPdfData(result);
            setSuggestedCollection(result.disease_name);
            setCustomCollectionName(result.disease_name);
            setDocumentSource(result.document_source);
            setFocusArea(result.focus_area);
            setTitle(result.title || "");
            toaster.create({
                title: t("rag.toast.extractionSuccessful"),
                description: result.extractedText
                    ? t("rag.toast.extractedSuccessfully")
                    : t("rag.toast.extractedViaFallback"),
                type: "success",
                duration: 3000,
            });
        } catch (error) {
            console.error("Error extracting PDF info:", error);
            toaster.create({
                title: t("rag.toast.extractionFailed"),
                description:
                    error.message || t("rag.toast.failedToExtract"),
                type: "error",
                duration: 3000,
            });
        } finally {
            setIsExtracting(false);
        }
    };

    const handleCommitToDatabase = async () => {
        if (!pdfData) {
            toaster.create({
                title: t("rag.toast.noDataToCommit"),
                description: t("rag.toast.extractFirst"),
                type: "warning",
                duration: 3000,
            });
            return;
        }
        setIsCommitting(true);
        try {
            if (pdfData.extractedText) {
                await ragApi.commitDirect({
                    extracted_text: pdfData.extractedText,
                    disease_name: customCollectionName,
                    focus_area: focusArea,
                    document_source: documentSource,
                    filename: filename,
                    title: title || null,
                    pdf_base64: pdfData.pdfBase64 || null,
                });
            } else {
                await ragApi.commitToDatabase({
                    disease_name: customCollectionName,
                    focus_area: focusArea,
                    document_source: documentSource,
                    filename: filename,
                    title: title || null,
                });
            }
            const updatedCollections = await ragApi.fetchCollections();
            setCollections(
                updatedCollections.files.map((name) => ({
                    name,
                    files: [],
                    loaded: false,
                })),
            );
            setPdfFile(null);
            setSuggestedCollection("");
            setCustomCollectionName("");
            setDocumentSource("");
            setFocusArea("");
            setTitle("");
            setFilename("");
            setPdfData(null);
            toaster.create({
                title: t("rag.toast.commitSuccessful"),
                description: t("rag.toast.committedToDatabase"),
                type: "success",
                duration: 3000,
            });
        } catch (error) {
            console.error("Error committing to database:", error);
            toaster.create({
                title: t("toast.error"),
                description:
                    error.message || t("rag.toast.failedToCommit"),
                type: "error",
                duration: 3000,
            });
        } finally {
            setIsCommitting(false);
        }
    };
    return (
        <Box className="panels-bg" p="4" borderRadius="sm">
            <Flex align="center" justify="space-between">
                <Flex align="center">
                    <IconButton
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        aria-label={t("rag.toggleCollapse")}
                        variant="outline"
                        size="sm"
                        mr="2"
                        className="collapse-toggle">{isCollapsed ? (
                            <ChevronRightIcon />
                        ) : (
                            <ChevronDownIcon />
                        )}</IconButton>
                    <HStack gap={2}>
                        <MdFileUpload size="1.2em" />
                        <Text as="h3">{t("rag.uploadDocuments")}</Text>
                    </HStack>
                </Flex>
            </Flex>
            <Collapsible.Root open={!isCollapsed}>
                <Collapsible.Content>
                    <Tabs.Root variant='enclosed' mt={4} defaultValue="0">
                        <Tabs.List>
                            <Tabs.Trigger className="tab-style" value="0">
                                <HStack>
                                    <MdFileUpload />
                                    <Text>{t("rag.singleUpload")}</Text>
                                </HStack>
                            </Tabs.Trigger>
                            <Tabs.Trigger className="tab-style" value="1">
                                <HStack>
                                    <FaCloudUploadAlt />
                                    <Text>{t("rag.bulkUpload")}</Text>
                                </HStack>
                            </Tabs.Trigger>
                        </Tabs.List>
                        <Tabs.Content className="floating-main" value="0">
                                <VStack gap={4} align="stretch">
                                    <Input
                                        id="pdf-upload"
                                        type="file"
                                        accept=".pdf"
                                        onChange={handlePdfUpload}
                                        className="input-style"
                                    />
                                    <Button
                                        onClick={handleExtractPdfInfo}
                                        width="220px"
                                        loading={isExtracting}
                                        loadingText={t("rag.status.extracting")}
                                        className="orange-button"
                                        alignSelf="flex-start"><AddIcon />{t("rag.extractPdfInfo")}
                                                                        </Button>
                                    {pdfData && (
                                        <VStack
                                            gap={3}
                                            align="stretch"
                                            mt={2}
                                            className="anim-fade-slide-up"
                                            css={{ animationDuration: "0.2s" }}
                                        >
                                            <Text fontWeight="bold">{t("rag.extractedInformation")}</Text>
                                            <Field.Root>
                                            <Field.Label htmlFor="custom-collection">
                                                {t("rag.collectionName")}:
                                            </Field.Label>
                                            <Input
                                                id="custom-collection"
                                                placeholder={t("rag.customCollectionName")}
                                                className="input-style"
                                                value={customCollectionName}
                                                onChange={(e) =>
                                                    setCustomCollectionName(e.target.value)
                                                }
                                            />
                                            </Field.Root>
                                            <Field.Root>
                                            <Field.Label htmlFor="document-source">
                                                {t("rag.documentSource")}:
                                            </Field.Label>
                                            <Input
                                                id="document-source"
                                                placeholder={t("rag.documentSource")}
                                                className="input-style"
                                                value={documentSource}
                                                onChange={(e) =>
                                                    setDocumentSource(e.target.value)
                                                }
                                            />
                                            </Field.Root>
                                            <Field.Root>
                                            <Field.Label htmlFor="focus-area">
                                                {t("rag.focusArea")}:
                                            </Field.Label>
                                            <Input
                                                id="focus-area"
                                                placeholder={t("rag.focusArea")}
                                                className="input-style"
                                                value={focusArea}
                                                onChange={(e) => setFocusArea(e.target.value)}
                                            />
                                            </Field.Root>
                                            <Field.Root>
                                            <Field.Label htmlFor="document-title">
                                                {t("rag.documentTitle")}:
                                            </Field.Label>
                                            <Input
                                                id="document-title"
                                                placeholder={t("rag.documentTitle")}
                                                className="input-style"
                                                value={title}
                                                onChange={(e) => setTitle(e.target.value)}
                                            />
                                            </Field.Root>
                                            <Button
                                                onClick={handleCommitToDatabase}
                                                loading={isCommitting}
                                                loadingText={t("rag.status.committing")}
                                                className="green-button"
                                                width="220px"
                                                alignSelf="flex-start"><AddIcon />{t("rag.commitToDatabase")}
                                                                                        </Button>
                                        </VStack>
                                    )}
                                </VStack>
                            </Tabs.Content>
                            <Tabs.Content className="floating-main" value="1">
                                <BulkUploader setCollections={setCollections} />
                            </Tabs.Content>
                    </Tabs.Root>
                </Collapsible.Content>
            </Collapsible.Root>
        </Box>
    );
};
export default Uploader;
