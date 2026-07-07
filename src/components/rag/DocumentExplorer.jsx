// Component for navigating and managing document collections.
import React, { useState, useEffect } from "react";
import {
    Box,
    Text,
    HStack,
    Flex,
    List,
    Collapsible,
    IconButton,
    Spinner,
    Popover,
    Input,
    VStack,
    Button,
} from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { Tooltip } from "@/components/ui/tooltip";
import {
    ChevronDownIcon,
    ChevronRightIcon,
    EditIcon,
    DeleteIcon,
    DownloadIcon,
} from "../common/icons";
import { FaFolder, FaFolderOpen, FaFile, FaTimes } from "react-icons/fa";
import { MdOutlineFolderCopy } from "react-icons/md";
import { ragApi } from "../../utils/api/ragApi";
import { formatCollectionName } from "../../utils/helpers/formatHelpers";

const FOCUS_AREA_OPTIONS = [
    "guidelines",
    "diagnosis",
    "treatment",
    "epidemiology",
    "pathophysiology",
    "prognosis",
    "clinical_features",
    "prevention",
    "miscellaneous",
];

const EditDocumentPopover = ({ collectionName, file, onSaved }) => {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState(file.title || "");
    const [source, setSource] = useState(file.source || "");
    const [focusArea, setFocusArea] = useState(file.focus_area || "");
    const [saving, setSaving] = useState(false);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await ragApi.updateDocumentMetadata({
                collection_name: collectionName,
                filename: file.filename,
                title: title || null,
                source: source || null,
                focus_area: focusArea || null,
            });
            onSaved({ ...file, title, source, focus_area: focusArea });
            setOpen(false);
        } catch (err) {
            toaster.create({
                title: "Error",
                description: "Failed to update document",
                type: "error",
                duration: 3000,
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Popover.Root
            open={open}
            onOpenChange={(d) => setOpen(d.open)}
            positioning={{ placement: "left" }}
            lazyRender
        >
            <Popover.Trigger asChild>
                <IconButton
                    aria-label="Edit document"
                    size="xs"
                    variant="ghost"
                    colorPalette="blue"
                    mr="1"
                >
                    <EditIcon />
                </IconButton>
            </Popover.Trigger>
            <Popover.Positioner>
                <Popover.Content w="340px" position="relative">
                    <Popover.Arrow>
                        <Popover.ArrowTip />
                    </Popover.Arrow>
                    <Popover.Header
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        gap={2}
                    >
                        <Text
                            as="span"
                            fontSize="sm"
                            fontWeight="600"
                            color="textPrimary"
                            lineHeight="1.2"
                            flex="1"
                        >
                            Edit document
                        </Text>
                        <Box
                            as="button"
                            onClick={() => setOpen(false)}
                            background="none"
                            border="none"
                            cursor="pointer"
                            padding="2px"
                            color="textSecondary"
                            opacity={0.6}
                            _hover={{ opacity: 1 }}
                            aria-label="Close"
                            flexShrink={0}
                            display="flex"
                            alignItems="center"
                            lineHeight="1"
                        >
                            <FaTimes size={12} />
                        </Box>
                    </Popover.Header>
                    <Popover.Body>
                        <VStack gap={2} align="stretch">
                            <Box>
                                <Text
                                    fontSize="xs"
                                    mb={1}
                                    color="textSecondary"
                                >
                                    Title
                                </Text>
                                <Input
                                    size="sm"
                                    className="input-style"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Document title"
                                />
                            </Box>
                            <Box>
                                <Text
                                    fontSize="xs"
                                    mb={1}
                                    color="textSecondary"
                                >
                                    Source
                                </Text>
                                <Input
                                    size="sm"
                                    className="input-style"
                                    value={source}
                                    onChange={(e) => setSource(e.target.value)}
                                    placeholder="Publishing source"
                                />
                            </Box>
                            <Box>
                                <Text
                                    fontSize="xs"
                                    mb={1}
                                    color="textSecondary"
                                >
                                    Focus area
                                </Text>
                                <Input
                                    size="sm"
                                    className="input-style"
                                    value={focusArea}
                                    onChange={(e) =>
                                        setFocusArea(e.target.value)
                                    }
                                    placeholder="Focus area"
                                    list="focus-area-options"
                                />
                                <datalist id="focus-area-options">
                                    {FOCUS_AREA_OPTIONS.map((o) => (
                                        <option key={o} value={o} />
                                    ))}
                                </datalist>
                            </Box>
                        </VStack>
                    </Popover.Body>
                    <Flex
                        justify="flex-end"
                        p={2}
                        gap={2}
                        borderTop="1px solid"
                        borderColor="surface"
                    >
                        <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="xs"
                            className="green-button"
                            loading={saving}
                            onClick={handleSave}
                        >
                            Save
                        </Button>
                    </Flex>
                </Popover.Content>
            </Popover.Positioner>
        </Popover.Root>
    );
};

const DocumentExplorer = ({
    isCollapsed,
    setIsCollapsed,
    collections,
    setCollections,
    loading,
    setItemToDelete,
}) => {
    const [expandedCollections, setExpandedCollections] = useState({});

    useEffect(() => {
        if (collections.length > 0 && collections.every((c) => !c.loaded)) {
            setExpandedCollections({});
        }
    }, [collections]);

    const toggleCollection = async (collectionName) => {
        setExpandedCollections((prev) => ({
            ...prev,
            [collectionName]: !prev[collectionName],
        }));
        const collection = collections.find((c) => c.name === collectionName);
        if (collection && !collection.loaded) {
            try {
                const files = await ragApi.fetchCollectionFiles(collectionName);
                setCollections((prev) =>
                    prev.map((c) =>
                        c.name === collectionName
                            ? { ...c, files: files.files, loaded: true }
                            : c,
                    ),
                );
            } catch (error) {
                console.log("Error fetching collection:", error);
                toaster.create({
                    title: "Error",
                    description: "Error fetching collection files",
                    type: "error",
                    duration: 3000,
                });
            }
        }
    };

    const handleRenameCollection = async (oldName, newName) => {
        if (newName) {
            ragApi
                .renameCollection(oldName, newName)
                .then(() => {
                    toaster.create({
                        title: "Success",
                        description: `Successfully renamed to ${newName}`,
                        type: "success",
                        duration: 3000,
                    });
                    // After successful rename, refetch collections
                    const fetchCollections = async () => {
                        try {
                            const updatedCollections =
                                await ragApi.fetchCollections();
                            setCollections(
                                updatedCollections.files.map((name) => ({
                                    name,
                                    files: [],
                                    loaded: false,
                                })),
                            );
                        } catch (error) {
                            toaster.create({
                                title: "Error",
                                description:
                                    "Error fetching updated collection list",
                                type: "error",
                                duration: 3000,
                            });
                        }
                    };
                    fetchCollections();
                })
                .catch((error) => {
                    console.error("Error renaming collection:", error);
                    toaster.create({
                        title: "Error",
                        description: "Failed to rename collection",
                        type: "error",
                        duration: 3000,
                    });
                });
        }
    };

    const handleDownloadPdf = async (collectionName, filename) => {
        try {
            const blob = await ragApi.downloadPdf(collectionName, filename);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error downloading PDF:", error);
            toaster.create({
                title: "Error",
                description: "Failed to download PDF",
                type: "error",
                duration: 3000,
            });
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
                        className="collapse-toggle"
                    >
                        {isCollapsed ? (
                            <ChevronRightIcon />
                        ) : (
                            <ChevronDownIcon />
                        )}
                    </IconButton>
                    <HStack gap={2}>
                        <MdOutlineFolderCopy size="1.2em" />
                        <Text as="h3">Document Explorer</Text>
                    </HStack>
                </Flex>
            </Flex>
            <Collapsible.Root open={!isCollapsed}>
                <Collapsible.Content>
                    {loading && <Spinner />}
                    {!loading && (
                        <Box mt="4">
                            <List.Root gap={3}>
                                {collections.map((collection) => (
                                    <List.Item
                                        key={collection.name}
                                        borderRadius="sm"
                                        overflow="hidden"
                                    >
                                        <Flex
                                            alignItems="center"
                                            p="2"
                                            className="documentExplorer-style"
                                            _hover={{ bg: "surfaceMuted" }}
                                        >
                                            <Tooltip
                                                content="Toggle collection"
                                                showArrow
                                            >
                                                <IconButton
                                                    onClick={() =>
                                                        toggleCollection(
                                                            collection.name,
                                                        )
                                                    }
                                                    aria-label="Toggle collection"
                                                    variant="ghost"
                                                    size="sm"
                                                    mr="2"
                                                    className="documentExplorer-button"
                                                >
                                                    {expandedCollections[
                                                        collection.name
                                                    ] ? (
                                                        <ChevronDownIcon />
                                                    ) : (
                                                        <ChevronRightIcon />
                                                    )}
                                                </IconButton>
                                            </Tooltip>
                                            <Box
                                                as={
                                                    expandedCollections[
                                                        collection.name
                                                    ]
                                                        ? FaFolderOpen
                                                        : FaFolder
                                                }
                                                mr="2"
                                                color="yellow.500"
                                            />
                                            <Text
                                                fontSize="md"
                                                fontWeight="medium"
                                            >
                                                {formatCollectionName(
                                                    collection.name,
                                                )}
                                            </Text>
                                            <Flex ml="auto">
                                                <Tooltip
                                                    content="Rename collection"
                                                    showArrow
                                                >
                                                    <IconButton
                                                        aria-label="Rename collection"
                                                        onClick={() => {
                                                            const newName =
                                                                prompt(
                                                                    "Enter new name:",
                                                                    collection.name,
                                                                );
                                                            handleRenameCollection(
                                                                collection.name,
                                                                newName,
                                                            );
                                                        }}
                                                        size="sm"
                                                        variant="ghost"
                                                        colorPalette="blue"
                                                    >
                                                        <EditIcon />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip
                                                    content="Delete collection"
                                                    showArrow
                                                >
                                                    <IconButton
                                                        aria-label="Delete collection"
                                                        onClick={() =>
                                                            setItemToDelete({
                                                                type: "collection",
                                                                name: collection.name,
                                                                collection:
                                                                    null,
                                                            })
                                                        }
                                                        size="sm"
                                                        variant="ghost"
                                                        colorPalette="red"
                                                    >
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </Flex>
                                        </Flex>
                                        <Collapsible.Root
                                            open={
                                                expandedCollections[
                                                    collection.name
                                                ]
                                            }
                                        >
                                            <Collapsible.Content>
                                                <List.Root
                                                    pl="8"
                                                    py="2"
                                                    className="filelist-style"
                                                >
                                                    {collection.files.length ===
                                                        0 &&
                                                    !collection.loaded ? (
                                                        <List.Item>
                                                            <Spinner
                                                                size="sm"
                                                                mr="2"
                                                            />{" "}
                                                            Loading files...
                                                        </List.Item>
                                                    ) : collection.files
                                                          .length > 0 ? (
                                                        collection.files.map(
                                                            (file, index) => {
                                                                const fileName =
                                                                    typeof file ===
                                                                    "string"
                                                                        ? file
                                                                        : file.filename;
                                                                const fileTitle =
                                                                    typeof file ===
                                                                    "object"
                                                                        ? file.title ||
                                                                          file.filename
                                                                        : file;
                                                                const hasPdf =
                                                                    typeof file ===
                                                                    "object"
                                                                        ? file.has_pdf
                                                                        : false;
                                                                return (
                                                                    <List.Item
                                                                        key={
                                                                            index
                                                                        }
                                                                        display="flex"
                                                                        alignItems="center"
                                                                        py="1"
                                                                    >
                                                                        <Box
                                                                            as={
                                                                                FaFile
                                                                            }
                                                                            mr="2"
                                                                            color="primaryButton"
                                                                        />
                                                                        <Text fontSize="sm">
                                                                            {fileTitle ||
                                                                                fileName}
                                                                        </Text>
                                                                        <Flex
                                                                            ml="auto"
                                                                            alignItems="center"
                                                                        >
                                                                            {typeof file ===
                                                                                "object" && (
                                                                                <EditDocumentPopover
                                                                                    collectionName={
                                                                                        collection.name
                                                                                    }
                                                                                    file={
                                                                                        file
                                                                                    }
                                                                                    onSaved={(
                                                                                        updated,
                                                                                    ) => {
                                                                                        setCollections(
                                                                                            (
                                                                                                prev,
                                                                                            ) =>
                                                                                                prev.map(
                                                                                                    (
                                                                                                        c,
                                                                                                    ) =>
                                                                                                        c.name ===
                                                                                                        collection.name
                                                                                                            ? {
                                                                                                                  ...c,
                                                                                                                  files: c.files.map(
                                                                                                                      (
                                                                                                                          f,
                                                                                                                      ) => {
                                                                                                                          const fn =
                                                                                                                              typeof f ===
                                                                                                                              "string"
                                                                                                                                  ? f
                                                                                                                                  : f.filename;
                                                                                                                          return fn ===
                                                                                                                              updated.filename
                                                                                                                              ? {
                                                                                                                                    ...f,
                                                                                                                                    ...updated,
                                                                                                                                }
                                                                                                                              : f;
                                                                                                                      },
                                                                                                                  ),
                                                                                                              }
                                                                                                            : c,
                                                                                                ),
                                                                                        );
                                                                                    }}
                                                                                />
                                                                            )}
                                                                            {hasPdf && (
                                                                                <Tooltip
                                                                                    content="Download PDF"
                                                                                    showArrow
                                                                                >
                                                                                    <IconButton
                                                                                        aria-label="Download PDF"
                                                                                        onClick={() =>
                                                                                            handleDownloadPdf(
                                                                                                collection.name,
                                                                                                fileName,
                                                                                            )
                                                                                        }
                                                                                        size="xs"
                                                                                        variant="ghost"
                                                                                        colorPalette="blue"
                                                                                        mr="1"
                                                                                    >
                                                                                        <DownloadIcon />
                                                                                    </IconButton>
                                                                                </Tooltip>
                                                                            )}
                                                                            <Tooltip
                                                                                content="Delete file"
                                                                                showArrow
                                                                            >
                                                                                <IconButton
                                                                                    aria-label="Delete file"
                                                                                    onClick={() =>
                                                                                        setItemToDelete(
                                                                                            {
                                                                                                type: "file",
                                                                                                name: fileName,
                                                                                                collection:
                                                                                                    collection.name,
                                                                                            },
                                                                                        )
                                                                                    }
                                                                                    size="xs"
                                                                                    variant="ghost"
                                                                                    colorPalette="red"
                                                                                >
                                                                                    <DeleteIcon />
                                                                                </IconButton>
                                                                            </Tooltip>
                                                                        </Flex>
                                                                    </List.Item>
                                                                );
                                                            },
                                                        )
                                                    ) : (
                                                        <List.Item
                                                            fontSize="sm"
                                                            color="overlay0"
                                                        >
                                                            No files found.
                                                        </List.Item>
                                                    )}
                                                </List.Root>
                                            </Collapsible.Content>
                                        </Collapsible.Root>
                                    </List.Item>
                                ))}
                            </List.Root>
                        </Box>
                    )}
                </Collapsible.Content>
            </Collapsible.Root>
        </Box>
    );
};

export default DocumentExplorer;
