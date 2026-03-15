// Component for uploading and vectorizing documents into the RAG database.
import React, { useState } from "react";
import {
    Box,
    Text,
    Flex,
    HStack,
    VStack,
    Input,
    Button,
    FormLabel,
    IconButton,
    Collapse,
    useToast,
} from "@chakra-ui/react";
import { ChevronDownIcon, ChevronRightIcon, AddIcon } from "@chakra-ui/icons";
import { MdFileUpload } from "react-icons/md";
import { ragApi } from "../../utils/api/ragApi";
import { chatApi } from "../../utils/api/chatApi";
import { extractPdfTextOrRenderForVision } from "../../utils/helpers/pdfVisionHelpers";
import { universalFetch } from "../../utils/helpers/apiHelpers";
import { buildApiUrl } from "../../utils/helpers/apiConfig";

const Uploader = ({ isCollapsed, setIsCollapsed, setCollections }) => {
    const [pdfFile, setPdfFile] = useState(null);
    // eslint-disable-next-line no-unused-vars
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

            const filenameForUpload = pdfFile.name || "uploaded.pdf";
            let data = null;
            let usedLegacyFallback = false;
            let mode = "auto";
            let visionCapable = false;

            try {
                const configResponse = await universalFetch(
                    await buildApiUrl("/api/config/global"),
                );
                if (configResponse.ok) {
                    const cfg = await configResponse.json();
                    const rawMode = String(
                        cfg?.DOCUMENT_IMAGE_PROCESSING_MODE || "auto",
                    )
                        .trim()
                        .toLowerCase();
                    mode =
                        rawMode === "vision" ||
                        rawMode === "ocr" ||
                        rawMode === "auto"
                            ? rawMode
                            : "auto";

                    try {
                        const capability =
                            await chatApi.getCurrentVisionCapability();
                        visionCapable = Boolean(capability?.vision_capable);
                    } catch (capabilityError) {
                        console.warn(
                            "Could not load cached current vision capability, falling back to legacy flag:",
                            capabilityError,
                        );
                        visionCapable = Boolean(cfg?.VISION_MODEL_CAPABLE);
                    }
                }
            } catch (configError) {
                console.warn(
                    "Could not load processing mode config, defaulting to auto:",
                    configError,
                );
            }

            const shouldUseVision =
                mode === "vision" || (mode === "auto" && visionCapable);
            const allowOcrFallback = mode !== "vision";

            if (mode === "vision" && !visionCapable) {
                throw new Error(
                    "Vision mode is enabled, but the selected endpoint/model is not marked as vision-capable.",
                );
            }

            if (shouldUseVision) {
                try {
                    const pdfResult =
                        await extractPdfTextOrRenderForVision(pdfFile);

                    let extractedText = "";
                    if (pdfResult.strategy === "text") {
                        extractedText = pdfResult.textResult?.text || "";
                    } else {
                        const visualResult =
                            await chatApi.analyzeVisualDocument({
                                filename: filenameForUpload,
                                content_type: "application/pdf",
                                strategy: "vision",
                                pages: (
                                    pdfResult.imageResult?.images || []
                                ).map((img) => ({
                                    page_number: img.pageNumber,
                                    data_url: img.dataUrl,
                                    mime_type: img.mimeType,
                                    width: img.width,
                                    height: img.height,
                                })),
                                fallback_text: pdfResult.textResult?.text || "",
                                extraction_info: {
                                    reason:
                                        pdfResult.textResult?.quality?.reason ||
                                        "No usable embedded PDF text",
                                    stats:
                                        pdfResult.textResult?.quality?.stats ||
                                        {},
                                    page_count:
                                        pdfResult.textResult?.pageCount || 0,
                                    processed_pages:
                                        pdfResult.textResult?.processedPages ||
                                        0,
                                    rendered_pages:
                                        pdfResult.imageResult?.renderedPages ||
                                        0,
                                },
                            });

                        extractedText =
                            visualResult.text ||
                            pdfResult.textResult?.text ||
                            "";
                    }

                    if (!extractedText.trim()) {
                        throw new Error(
                            "Could not extract usable text from frontend visual/text-first path.",
                        );
                    }

                    data = await ragApi.extractPdfInfoFromText({
                        extracted_text: extractedText,
                        filename: filenameForUpload,
                    });
                } catch (visionPathError) {
                    if (!allowOcrFallback) {
                        throw visionPathError;
                    }

                    console.warn(
                        "Vision path unavailable; falling back to backend OCR/PDF extraction:",
                        visionPathError,
                    );
                    usedLegacyFallback = true;
                    const formData = new FormData();
                    formData.append("file", pdfFile);
                    data = await ragApi.extractPdfInfo(formData);
                }
            } else {
                usedLegacyFallback = true;
                const formData = new FormData();
                formData.append("file", pdfFile);
                data = await ragApi.extractPdfInfo(formData);
            }

            setPdfData(data);
            setSuggestedCollection(data.disease_name);
            setCustomCollectionName(data.disease_name);
            setDocumentSource(data.document_source);
            setFocusArea(data.focus_area);
            toast({
                title: "Extraction Successful",
                description: usedLegacyFallback
                    ? "PDF information extracted via backend fallback"
                    : "PDF information extracted successfully",
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
            const data = {
                disease_name: customCollectionName,
                focus_area: focusArea,
                document_source: documentSource,
                filename: filename,
            };
            await ragApi.commitToDatabase(data);
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
                        icon={
                            isCollapsed ? (
                                <ChevronRightIcon />
                            ) : (
                                <ChevronDownIcon />
                            )
                        }
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        aria-label="Toggle collapse"
                        variant="outline"
                        size="sm"
                        mr="2"
                        className="collapse-toggle"
                    />
                    <HStack spacing={2}>
                        <MdFileUpload size="1.2em" />
                        <Text as="h3">Uploader</Text>
                    </HStack>
                </Flex>
            </Flex>
            <Collapse in={!isCollapsed} animateOpacity>
                <VStack spacing={4} align="stretch" mt={4}>
                    <Input
                        id="pdf-upload"
                        type="file"
                        accept=".pdf"
                        onChange={handlePdfUpload}
                        className="input-style"
                    />
                    <Button
                        leftIcon={<AddIcon />}
                        onClick={handleExtractPdfInfo}
                        width="220px"
                        isLoading={isExtracting}
                        loadingText="Extracting..."
                        className="orange-button"
                        alignSelf="flex-start"
                    >
                        Extract PDF Info
                    </Button>
                    {pdfData && (
                        <VStack spacing={3} align="stretch" mt={2}>
                            <Text fontWeight="bold">Extracted Information</Text>
                            <FormLabel htmlFor="custom-collection">
                                Collection Name:
                            </FormLabel>
                            <Input
                                id="custom-collection"
                                placeholder="Custom Collection Name"
                                className="input-style"
                                value={customCollectionName}
                                onChange={(e) =>
                                    setCustomCollectionName(e.target.value)
                                }
                            />
                            <FormLabel htmlFor="document-source">
                                Document Source:
                            </FormLabel>
                            <Input
                                id="document-source"
                                placeholder="Document Source"
                                className="input-style"
                                value={documentSource}
                                onChange={(e) =>
                                    setDocumentSource(e.target.value)
                                }
                            />
                            <FormLabel htmlFor="focus-area">
                                Focus Area:
                            </FormLabel>
                            <Input
                                id="focus-area"
                                placeholder="Focus Area"
                                className="input-style"
                                value={focusArea}
                                onChange={(e) => setFocusArea(e.target.value)}
                            />
                            <Button
                                leftIcon={<AddIcon />}
                                onClick={handleCommitToDatabase}
                                isLoading={isCommitting}
                                loadingText="Committing..."
                                className="green-button"
                                width="220px"
                                alignSelf="flex-start"
                            >
                                Commit to Database
                            </Button>
                        </VStack>
                    )}
                </VStack>
            </Collapse>
        </Box>
    );
};
export default Uploader;
