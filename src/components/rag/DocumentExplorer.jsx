// Component for navigating and managing document collections.
import React, { useState } from "react";
import { Box, Text, HStack, Flex, List, Collapsible, IconButton, Spinner } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { Tooltip } from '@/components/ui/tooltip';
import {
    ChevronDownIcon,
    ChevronRightIcon,
    EditIcon,
    DeleteIcon,
    DownloadIcon,
} from "../common/icons";
import { FaFolder, FaFolderOpen, FaFile } from "react-icons/fa";
import { MdOutlineFolderCopy } from "react-icons/md";
import { ragApi } from "../../utils/api/ragApi";
import { formatCollectionName } from "../../utils/helpers/formatHelpers";

const DocumentExplorer = ({
    isCollapsed,
    setIsCollapsed,
    collections,
    setCollections,
    loading,
    setItemToDelete,
}) => {
    const [expandedCollections, setExpandedCollections] = useState({});
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
                        className="collapse-toggle">{isCollapsed ? (
                            <ChevronRightIcon />
                        ) : (
                            <ChevronDownIcon />
                        )}</IconButton>
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
                                            _hover={{ bg: "gray.100" }}
                                        >
                                            <Tooltip content="Toggle collection" showArrow>
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
                                                className="documentExplorer-button">{expandedCollections[
                                                    collection.name
                                                ] ? (
                                                    <ChevronDownIcon />
                                                ) : (
                                                    <ChevronRightIcon />
                                                )}</IconButton>
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
                                            <Text fontSize="md" fontWeight="medium">
                                                {formatCollectionName(
                                                    collection.name,
                                                )}
                                            </Text>
                                            <Flex ml="auto">
                                                <Tooltip content="Rename collection" showArrow>
                                                <IconButton
                                                    aria-label="Rename collection"
                                                    onClick={() => {
                                                        const newName = prompt(
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
                                                    colorPalette="blue"><EditIcon /></IconButton>
                                                </Tooltip>
                                                <Tooltip content="Delete collection" showArrow>
                                                <IconButton
                                                    aria-label="Delete collection"
                                                    onClick={() =>
                                                        setItemToDelete({
                                                            type: "collection",
                                                            name: collection.name,
                                                            collection: null,
                                                        })
                                                    }
                                                    size="sm"
                                                    variant="ghost"
                                                    colorPalette="red"><DeleteIcon /></IconButton>
                                                </Tooltip>
                                            </Flex>
                                        </Flex>
                                        <Collapsible.Root
                                            open={
                                                expandedCollections[collection.name]
                                            }>
                                            <Collapsible.Content>
                                                <List.Root
                                                    pl="8"
                                                    py="2"
                                                    className="filelist-style"
                                                >
                                                    {collection.files.length === 0 &&
                                                    !collection.loaded ? (
                                                        <List.Item>
                                                            <Spinner size="sm" mr="2" />{" "}
                                                            Loading files...
                                                        </List.Item>
                                                    ) : collection.files.length > 0 ? (
                                                        collection.files.map(
                                                            (file, index) => {
                                                                const fileName = typeof file === "string" ? file : file.filename;
                                                                const hasPdf = typeof file === "object" ? file.has_pdf : false;
                                                                return (
                                                                    <List.Item
                                                                        key={index}
                                                                        display="flex"
                                                                        alignItems="center"
                                                                        py="1"
                                                                    >
                                                                        <Box
                                                                            as={FaFile}
                                                                            mr="2"
                                                                            color="blue.500"
                                                                        />
                                                                        <Text fontSize="sm">
                                                                            {fileName}
                                                                        </Text>
                                                                        <Flex ml="auto">
                                                                            {hasPdf && (
                                                                                <Tooltip content="Download PDF" showArrow>
                                                                                <IconButton
                                                                                    aria-label="Download PDF"
                                                                                    onClick={() =>
                                                                                        handleDownloadPdf(collection.name, fileName)
                                                                                    }
                                                                                    size="xs"
                                                                                    variant="ghost"
                                                                                    colorPalette="blue"
                                                                                    mr="1"><DownloadIcon /></IconButton>
                                                                                </Tooltip>
                                                                            )}
                                                                            <Tooltip content="Delete file" showArrow>
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
                                                                                colorPalette="red"><DeleteIcon /></IconButton>
                                                                            </Tooltip>
                                                                        </Flex>
                                                                    </List.Item>
                                                                );},
                                                        )
                                                    ) : (
                                                        <List.Item
                                                            fontSize="sm"
                                                            color="gray.500"
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
