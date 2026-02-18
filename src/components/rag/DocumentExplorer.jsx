// Component for navigating and managing document collections.
import React, { useState } from "react";
import {
    Box,
    Text,
    HStack,
    Flex,
    List,
    ListItem,
    Collapse,
    IconButton,
    Spinner,
    useToast,
} from "@chakra-ui/react";
import {
    ChevronDownIcon,
    ChevronRightIcon,
    EditIcon,
    DeleteIcon,
} from "@chakra-ui/icons";
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
    const toast = useToast();
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
                toast({
                    title: "Error",
                    description: "Error fetching collection files",
                    status: "error",
                    duration: 3000,
                    isClosable: true,
                });
            }
        }
    };

    const handleRenameCollection = async (oldName, newName) => {
        if (newName) {
            ragApi
                .renameCollection(oldName, newName)
                .then(() => {
                    toast({
                        title: "Success",
                        description: `Successfully renamed to ${newName}`,
                        status: "success",
                        duration: 3000,
                        isClosable: true,
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
                            toast({
                                title: "Error",
                                description:
                                    "Error fetching updated collection list",
                                status: "error",
                                duration: 3000,
                                isClosable: true,
                            });
                        }
                    };
                    fetchCollections();
                })
                .catch((error) => {
                    console.error("Error renaming collection:", error);
                    toast({
                        title: "Error",
                        description: "Failed to rename collection",
                        status: "error",
                        duration: 3000,
                        isClosable: true,
                    });
                });
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
                        <MdOutlineFolderCopy size="1.2em" />
                        <Text as="h3">Document Explorer</Text>
                    </HStack>
                </Flex>
            </Flex>
            <Collapse in={!isCollapsed} animateOpacity>
                {loading && <Spinner />}
                {!loading && (
                    <Box mt="4">
                        <List spacing={3}>
                            {collections.map((collection) => (
                                <ListItem
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
                                        <IconButton
                                            icon={
                                                expandedCollections[
                                                    collection.name
                                                ] ? (
                                                    <ChevronDownIcon />
                                                ) : (
                                                    <ChevronRightIcon />
                                                )
                                            }
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
                                        />
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
                                            <IconButton
                                                icon={<EditIcon />}
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
                                                colorScheme="blue"
                                            />
                                            <IconButton
                                                icon={<DeleteIcon />}
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
                                                colorScheme="red"
                                            />
                                        </Flex>
                                    </Flex>
                                    <Collapse
                                        in={
                                            expandedCollections[collection.name]
                                        }
                                    >
                                        <List
                                            pl="8"
                                            py="2"
                                            className="filelist-style"
                                        >
                                            {collection.files.length === 0 &&
                                            !collection.loaded ? (
                                                <ListItem>
                                                    <Spinner size="sm" mr="2" />{" "}
                                                    Loading files...
                                                </ListItem>
                                            ) : collection.files.length > 0 ? (
                                                collection.files.map(
                                                    (file, index) => (
                                                        <ListItem
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
                                                                {file}
                                                            </Text>
                                                            <IconButton
                                                                icon={
                                                                    <DeleteIcon />
                                                                }
                                                                aria-label="Delete file"
                                                                onClick={() =>
                                                                    setItemToDelete(
                                                                        {
                                                                            type: "file",
                                                                            name: file,
                                                                            collection:
                                                                                collection.name,
                                                                        },
                                                                    )
                                                                }
                                                                size="xs"
                                                                variant="ghost"
                                                                colorScheme="red"
                                                                ml="auto"
                                                            />
                                                        </ListItem>
                                                    ),
                                                )
                                            ) : (
                                                <ListItem
                                                    fontSize="sm"
                                                    color="gray.500"
                                                >
                                                    No files found.
                                                </ListItem>
                                            )}
                                        </List>
                                    </Collapse>
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                )}
            </Collapse>
        </Box>
    );
};

export default DocumentExplorer;
