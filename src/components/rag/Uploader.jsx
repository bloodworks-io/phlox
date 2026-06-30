// Component for uploading and vectorizing documents into the RAG database.
import React, { useState } from "react";
import { Field, Box, Text, Flex, HStack, VStack, Input, Button, IconButton, Collapsible, Tabs } from "@chakra-ui/react";
import { useToast } from "@/utils/useToastShim";
import { ChevronDownIcon, ChevronRightIcon, AddIcon } from "../common/icons";
import { MdFileUpload } from "react-icons/md";
import { FaCloudUploadAlt } from "react-icons/fa";
import { ragApi } from "../../utils/api/ragApi";
import { extractPdfMetadata } from "../../utils/helpers/pdfExtractHelpers";
import BulkUploader from "./BulkUploader";

const Uploader = ({ isCollapsed, setIsCollapsed, setCollections }) => {
    const [pdfFile, setPdfFile] = useState(null);
     
    const [suggestedCollection, setSuggestedCollection] = useState("");
    const [customCollectionName, setCustomCollectionName] = useState("");
    const [documentSource, setDocumentSource] = useState("");
    const [focusArea, setFocusArea] = useState("");
    const [filename, setFilename] = useState("");
    const [pdfData, setPdfData] = useState(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    const toast = useToast();
    const handlePdfUpload = (event) => {
        const file = event.target.files[0];
        setPdfFile(file);
        setFilename(file.name);
    };
    const handleExtractPdfInfo = async () => {
        setIsExtracting(true);
        try {
            if (!pdfFile) {
                toast({
                    title: "No file selected",
                    description: "Please select a PDF file to upload",
                    status: "warning",
                    duration: 3000,
                    isClosable: true,
                });
                return;
            }

            const result = await extractPdfMetadata(pdfFile);

            setPdfData(result);
            setSuggestedCollection(result.disease_name);
            setCustomCollectionName(result.disease_name);
            setDocumentSource(result.document_source);
            setFocusArea(result.focus_area);
            toast({
                title: "Extraction Successful",
                description: result.extractedText
                    ? "PDF information extracted successfully"
                    : "PDF information extracted via backend fallback",
                status: "success",
                duration: 3000,
                isClosable: true,
            });
        } catch (error) {
            console.error("Error extracting PDF info:", error);
            toast({
                title: "Extraction Failed",
                description:
                    error.message || "Failed to extract PDF information",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        } finally {
            setIsExtracting(false);
        }
    };

    const handleCommitToDatabase = async () => {
        if (!pdfData) {
            toast({
                title: "No Data to Commit",
                description: "Please extract PDF information first",
                status: "warning",
                duration: 3000,
                isClosable: true,
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
                    pdf_base64: pdfData.pdfBase64 || null,
                });
            } else {
                await ragApi.commitToDatabase({
                    disease_name: customCollectionName,
                    focus_area: focusArea,
                    document_source: documentSource,
                    filename: filename,
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
            setFilename("");
            setPdfData(null);
            toast({
                title: "Commit Successful",
                description: "Data successfully committed to the database",
                status: "success",
                duration: 3000,
                isClosable: true,
            });
        } catch (error) {
            console.error("Error committing to database:", error);
            toast({
                title: "Error",
                description:
                    error.message || "Failed to commit data to the database",
                status: "error",
                duration: 3000,
                isClosable: true,
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
