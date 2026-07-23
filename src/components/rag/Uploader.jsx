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

const Uploader = ({ isCollapsed, setIsCollapsed, setCollections }) => {
    const [pdfFile, setPdfFile] = useState(null);
     
    const [, setSuggestedCollection] = useState("");
    const [customCollectionName, setCustomCollectionName] = useState("");
    const [documentSource, setDocumentSource] = useState("");
    const [focusArea, setFocusArea] = useState("");
    const [title, setTitle] = useState("");
    const [filename, setFilename] = useState("");
    const [pdfData, setPdfData] = useState(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    const handlePdfUpload = (event) => {
        const file = event.target.files[0];
        setPdfFile(file);
        setFilename(file.name);
    };
    const handleExtractPdfInfo = async () => {
        setIsExtracting(true);
        try {
            if (!pdfFile) {
                toaster.create({
                    title: "No file selected",
                    description: "Please select a PDF file to upload",
                    type: "warning",
                    duration: 3000,
                });
                return;
            }

            const result = await extractPdfMetadata(pdfFile);

            setPdfData(result);
            setSuggestedCollection(result.disease_name);
            setCustomCollectionName(result.disease_name);
            setDocumentSource(result.document_source);
            setFocusArea(result.focus_area);
            setTitle(result.title || "");
            toaster.create({
                title: "Extraction Successful",
                description: result.extractedText
                    ? "PDF information extracted successfully"
                    : "PDF information extracted via backend fallback",
                type: "success",
                duration: 3000,
            });
        } catch (error) {
            console.error("Error extracting PDF info:", error);
            toaster.create({
                title: "Extraction Failed",
                description:
                    error.message || "Failed to extract PDF information",
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
                title: "No Data to Commit",
                description: "Please extract PDF information first",
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
                title: "Commit Successful",
                description: "Data successfully committed to the database",
                type: "success",
                duration: 3000,
            });
        } catch (error) {
            console.error("Error committing to database:", error);
            toaster.create({
                title: "Error",
                description:
                    error.message || "Failed to commit data to the database",
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
                        aria-label="Toggle collapse"
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
                        <Text as="h3">Upload Documents</Text>
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
                                    <Text>Single Upload</Text>
                                </HStack>
                            </Tabs.Trigger>
                            <Tabs.Trigger className="tab-style" value="1">
                                <HStack>
                                    <FaCloudUploadAlt />
                                    <Text>Bulk Upload</Text>
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
                                        loadingText="Extracting..."
                                        className="orange-button"
                                        alignSelf="flex-start"><AddIcon />Extract PDF Info
                                                                        </Button>
                                    {pdfData && (
                                        <VStack gap={3} align="stretch" mt={2}>
                                            <Text fontWeight="bold">Extracted Information</Text>
                                            <Field.Root>
                                            <Field.Label htmlFor="custom-collection">
                                                Collection Name:
                                            </Field.Label>
                                            <Input
                                                id="custom-collection"
                                                placeholder="Custom Collection Name"
                                                className="input-style"
                                                value={customCollectionName}
                                                onChange={(e) =>
                                                    setCustomCollectionName(e.target.value)
                                                }
                                            />
                                            </Field.Root>
                                            <Field.Root>
                                            <Field.Label htmlFor="document-source">
                                                Document Source:
                                            </Field.Label>
                                            <Input
                                                id="document-source"
                                                placeholder="Document Source"
                                                className="input-style"
                                                value={documentSource}
                                                onChange={(e) =>
                                                    setDocumentSource(e.target.value)
                                                }
                                            />
                                            </Field.Root>
                                            <Field.Root>
                                            <Field.Label htmlFor="focus-area">
                                                Focus Area:
                                            </Field.Label>
                                            <Input
                                                id="focus-area"
                                                placeholder="Focus Area"
                                                className="input-style"
                                                value={focusArea}
                                                onChange={(e) => setFocusArea(e.target.value)}
                                            />
                                            </Field.Root>
                                            <Field.Root>
                                            <Field.Label htmlFor="document-title">
                                                Document Title:
                                            </Field.Label>
                                            <Input
                                                id="document-title"
                                                placeholder="Document Title"
                                                className="input-style"
                                                value={title}
                                                onChange={(e) => setTitle(e.target.value)}
                                            />
                                            </Field.Root>
                                            <Button
                                                onClick={handleCommitToDatabase}
                                                loading={isCommitting}
                                                loadingText="Committing..."
                                                className="green-button"
                                                width="220px"
                                                alignSelf="flex-start"><AddIcon />Commit to Database
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
