import React, { useState, useEffect } from "react";
import {
    Box,
    VStack,
    HStack,
    Text,
    Button,
    Input,
    Select,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    IconButton,
    useToast,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    ModalCloseButton,
    useDisclosure,
    Spinner,
    Badge,
    Tooltip,
    Alert,
    AlertIcon,
    AlertTitle,
    AlertDescription,
    Flex,
    Spacer,
} from "@chakra-ui/react";
import { FaExclamationTriangle } from "react-icons/fa";
import { DeleteIcon, DownloadIcon, SearchIcon } from "@chakra-ui/icons";
import { universalFetch } from "../../utils/helpers/apiHelpers";
import { buildApiUrl } from "../../utils/helpers/apiConfig";

const LocalModelManager = () => {
    const [models, setModels] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedRepo, setSelectedRepo] = useState("");
    const [selectedFile, setSelectedFile] = useState("");
    const [repoFiles, setRepoFiles] = useState([]);
    const [localStatus, setLocalStatus] = useState(null);
    const [modelToDelete, setModelToDelete] = useState(null);
    const toast = useToast();
    const { isOpen, onOpen, onClose } = useDisclosure();
    const {
        isOpen: isDeleteOpen,
        onOpen: onDeleteOpen,
        onClose: onDeleteClose,
    } = useDisclosure();

    useEffect(() => {
        fetchLocalModels();
        checkLocalStatus();
    }, []);

    const checkLocalStatus = async () => {
        try {
            const response = await universalFetch(
                await buildApiUrl("/api/config/local/status"),
            );
            if (response.ok) {
                const data = await response.json();
                setLocalStatus(data);
            }
        } catch (error) {
            console.error("Error checking local status:", error);
        }
    };

    const fetchLocalModels = async () => {
        try {
            const response = await universalFetch(
                await buildApiUrl("/api/config/local/models"),
            );
            if (response.ok) {
                const data = await response.json();
                setModels(data.models || []);
            }
        } catch (error) {
            console.error("Error fetching local models:", error);
            toast({
                title: "Error",
                description: "Failed to fetch local models",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        }
    };

    const searchModels = async () => {
        if (!searchQuery.trim()) return;

        setLoading(true);
        try {
            const response = await universalFetch(
                await buildApiUrl(
                    `/api/config/local/models/search?query=${encodeURIComponent(searchQuery)}&limit=20`,
                ),
            );
            if (response.ok) {
                const data = await response.json();
                setSearchResults(data.models || []);
            }
        } catch (error) {
            console.error("Error searching models:", error);
            toast({
                title: "Error",
                description: "Failed to search models",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchRepoFiles = async (repoId) => {
        setLoading(true);
        try {
            const response = await universalFetch(
                await buildApiUrl(
                    `/api/config/local/models/repo/${encodeURIComponent(repoId)}`,
                ),
            );
            if (response.ok) {
                const data = await response.json();
                setRepoFiles(data.quantizations || {});
                setSelectedRepo(repoId);
                onOpen();
            }
        } catch (error) {
            console.error("Error fetching repo files:", error);
            toast({
                title: "Error",
                description: "Failed to fetch repository files",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        } finally {
            setLoading(false);
        }
    };

    const downloadModel = async (
        repoId,
        filename = null,
        quantization = "Q4_K_M",
    ) => {
        setLoading(true);
        try {
            const response = await universalFetch(
                await buildApiUrl("/api/config/local/models/download"),
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        repo_id: repoId,
                        filename: filename,
                        quantization: quantization,
                    }),
                },
            );

            if (response.ok) {
                const data = await response.json();
                toast({
                    title: "Success",
                    description: data.message,
                    status: "success",
                    duration: 3000,
                    isClosable: true,
                });
                fetchLocalModels();
                onClose();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Download failed");
            }
        } catch (error) {
            console.error("Error downloading model:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to download model",
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (repoId, filename) => {
        setModelToDelete({ repoId, filename });
        onDeleteOpen();
    };

    const confirmDelete = async () => {
        if (!modelToDelete) return;

        const { repoId, filename } = modelToDelete;

        try {
            const response = await universalFetch(
                await buildApiUrl(
                    `/api/config/local/models?repo_id=${encodeURIComponent(repoId)}&filename=${encodeURIComponent(filename)}`,
                ),
                { method: "DELETE" },
            );

            if (response.ok) {
                toast({
                    title: "Success",
                    description: "Model deleted successfully",
                    status: "success",
                    duration: 3000,
                    isClosable: true,
                });
                fetchLocalModels();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Delete failed");
            }
        } catch (error) {
            console.error("Error deleting model:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to delete model",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        } finally {
            setModelToDelete(null);
            onDeleteClose();
        }
    };

    if (!localStatus) {
        return <Spinner />;
    }

    if (!localStatus.available) {
        return (
            <Alert status="warning" style={{ borderRadius: "lg !important" }}>
                <AlertIcon as={FaExclamationTriangle} mr={2} />
                <AlertTitle>Local Models Not Available</AlertTitle>
                <AlertDescription>{localStatus.reason}</AlertDescription>
            </Alert>
        );
    }

    return (
        <Box className="panels-bg" p="4" borderRadius="sm">
            <VStack spacing={4} align="stretch">
                <Text as="h3" fontSize="lg" fontWeight="bold">
                    Local Model Manager
                </Text>

                {/* Search Section */}
                <Box>
                    <Text fontSize="sm" mb="2">
                        Search Hugging Face Models
                    </Text>
                    <HStack>
                        <Input
                            placeholder="Search for models (e.g., 'llama', 'mistral', 'qwen')"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={(e) =>
                                e.key === "Enter" && searchModels()
                            }
                        />
                        <Button
                            leftIcon={<SearchIcon />}
                            onClick={searchModels}
                            isLoading={loading}
                            colorScheme="blue"
                        >
                            Search
                        </Button>
                    </HStack>
                </Box>

                {/* Search Results */}
                {searchResults.length > 0 && (
                    <Box>
                        <Text fontSize="sm" mb="2" fontWeight="bold">
                            Search Results
                        </Text>
                        <Table size="sm">
                            <Thead>
                                <Tr>
                                    <Th>Model</Th>
                                    <Th>Author</Th>
                                    <Th>Downloads</Th>
                                    <Th>Actions</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                {searchResults.map((model) => (
                                    <Tr key={model.repo_id}>
                                        <Td>
                                            <VStack align="start" spacing={1}>
                                                <Text
                                                    fontSize="sm"
                                                    fontWeight="bold"
                                                >
                                                    {model.repo_id}
                                                </Text>
                                                <Text
                                                    fontSize="xs"
                                                    color="gray.500"
                                                >
                                                    {model.description?.slice(
                                                        0,
                                                        100,
                                                    )}
                                                    ...
                                                </Text>
                                            </VStack>
                                        </Td>
                                        <Td>{model.author}</Td>
                                        <Td>
                                            {model.downloads?.toLocaleString()}
                                        </Td>
                                        <Td>
                                            <Button
                                                size="sm"
                                                leftIcon={<DownloadIcon />}
                                                onClick={() =>
                                                    fetchRepoFiles(
                                                        model.repo_id,
                                                    )
                                                }
                                                colorScheme="green"
                                            >
                                                Download
                                            </Button>
                                        </Td>
                                    </Tr>
                                ))}
                            </Tbody>
                        </Table>
                    </Box>
                )}

                {/* Downloaded Models */}
                <Box>
                    <Flex align="center" mb="2">
                        <Text fontSize="sm" fontWeight="bold">
                            Downloaded Models
                        </Text>
                        <Spacer />
                        <Button size="sm" onClick={fetchLocalModels}>
                            Refresh
                        </Button>
                    </Flex>

                    {models.length === 0 ? (
                        <Text fontSize="sm" color="gray.500">
                            No models downloaded yet
                        </Text>
                    ) : (
                        <Table size="sm">
                            <Thead>
                                <Tr>
                                    <Th>Model</Th>
                                    <Th>Size</Th>
                                    <Th>Actions</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                {models.map((model) => (
                                    <Tr
                                        key={`${model.repo_id}/${model.filename}`}
                                    >
                                        <Td>
                                            <VStack align="start" spacing={1}>
                                                <Text
                                                    fontSize="sm"
                                                    fontWeight="bold"
                                                >
                                                    {model.repo_id}
                                                </Text>
                                                <Text
                                                    fontSize="xs"
                                                    color="gray.500"
                                                >
                                                    {model.filename}
                                                </Text>
                                            </VStack>
                                        </Td>
                                        <Td>
                                            <Badge colorScheme="blue">
                                                {model.size_mb} MB
                                            </Badge>
                                        </Td>
                                        <Td>
                                            <Tooltip label="Delete model">
                                                <IconButton
                                                    size="sm"
                                                    icon={<DeleteIcon />}
                                                    onClick={() =>
                                                        handleDeleteClick(
                                                            model.repo_id,
                                                            model.filename,
                                                        )
                                                    }
                                                    colorScheme="red"
                                                    variant="outline"
                                                />
                                            </Tooltip>
                                        </Td>
                                    </Tr>
                                ))}
                            </Tbody>
                        </Table>
                    )}
                </Box>
            </VStack>

            {/* Download Modal */}
            <Modal isOpen={isOpen} onClose={onClose} size="lg">
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Download Model: {selectedRepo}</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <VStack spacing={4} align="stretch">
                            <Text fontSize="sm">
                                Choose a quantization level. Q4_K_M is
                                recommended for most use cases.
                            </Text>

                            {Object.entries(repoFiles).map(
                                ([quantType, files]) => (
                                    <Box key={quantType}>
                                        <Text
                                            fontSize="sm"
                                            fontWeight="bold"
                                            mb="2"
                                        >
                                            {quantType}
                                        </Text>
                                        {files.map((file) => (
                                            <HStack key={file} mb="2">
                                                <Text fontSize="sm" flex="1">
                                                    {file}
                                                </Text>
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        downloadModel(
                                                            selectedRepo,
                                                            file,
                                                        )
                                                    }
                                                    isLoading={loading}
                                                    colorScheme="blue"
                                                >
                                                    Download
                                                </Button>
                                            </HStack>
                                        ))}
                                    </Box>
                                ),
                            )}
                        </VStack>
                    </ModalBody>
                    <ModalFooter>
                        <Button onClick={onClose}>Cancel</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={isDeleteOpen} onClose={onDeleteClose}>
                <ModalOverlay />
                <ModalContent className="modal-style">
                    <ModalHeader>Confirm Delete</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        Are you sure you want to delete{" "}
                        <Text as="span" fontWeight="bold">
                            {modelToDelete?.repoId}/{modelToDelete?.filename}
                        </Text>
                        ? This action cannot be undone.
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            className="red-button"
                            mr={3}
                            onClick={confirmDelete}
                        >
                            Delete
                        </Button>
                        <Button
                            className="green-button"
                            onClick={onDeleteClose}
                        >
                            Cancel
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </Box>
    );
};

export default LocalModelManager;
