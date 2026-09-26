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
} from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { Tooltip } from "@/components/ui/tooltip";
import {
    EditIcon,
    DeleteIcon,
    DownloadIcon,
} from "../common/icons";
import AnimatedChevron from "../common/icons/AnimatedChevron";
import { FaFolder, FaFolderOpen, FaFile } from "react-icons/fa";
import { MdOutlineFolderCopy } from "react-icons/md";
import { ragApi } from "../../utils/api/ragApi";
import { formatCollectionName } from "../../utils/helpers/formatHelpers";
import { EditDocumentPopover } from "./EditDocumentPopover";
import { useTranslation } from "react-i18next";

const DocumentExplorer = ({
    isCollapsed,
    setIsCollapsed,
    collections,
    setCollections,
    loading,
    setItemToDelete,
}) => {
    const { t } = useTranslation();
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
                console.error("Error fetching collection:", error);
                toaster.create({
                    title: t("toast.error"),
                    description: t("rag.toast.errorFetchingCollectionFiles"),
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
                        title: t("toast.success"),
                        description: t("rag.toast.renamedTo", { name: newName }),
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
                        } catch {
                            toaster.create({
                                title: t("toast.error"),
                                description: t("rag.toast.errorFetchingCollections"),
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
                        title: t("toast.error"),
                        description: t("rag.toast.failedToRename"),
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
                title: t("toast.error"),
                description: t("rag.toast.failedToDownloadPdf"),
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
                        aria-label={t("rag.toggleCollapse")}
                        variant="outline"
                        size="sm"
                        mr="2"
                        className="collapse-toggle"
                    >
                        <AnimatedChevron isOpen={!isCollapsed} />
                    </IconButton>
                    <HStack gap={2}>
                        <MdOutlineFolderCopy size="1.2em" />
                        <Text as="h3">{t("rag.documentExplorer")}</Text>
                    </HStack>
                </Flex>
            </Flex>
            <Collapsible.Root open={!isCollapsed}>
                <Collapsible.Content>
                    {loading && <Spinner />}
                    {!loading && (
                        <Box mt="4">
                            <List.Root
                                gap={3}
                                className="anim-stagger"
                                css={{
                                    "& > *": { animationDuration: "0.15s" },
                                }}
                            >
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
                                                content={t("rag.toggleCollection")}
                                                showArrow
                                            >
                                                <IconButton
                                                    onClick={() =>
                                                        toggleCollection(
                                                            collection.name,
                                                        )
                                                    }
                                                    aria-label={t("rag.toggleCollection")}
                                                    variant="ghost"
                                                    size="sm"
                                                    mr="2"
                                                    className="documentExplorer-button"
                                                >
                                                    <AnimatedChevron
                                                        isOpen={
                                                            expandedCollections[
                                                                collection.name
                                                            ]
                                                        }
                                                    />
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
                                                    content={t("rag.renameCollection")}
                                                    showArrow
                                                >
                                                    <IconButton
                                                        aria-label={t("rag.renameCollection")}
                                                        onClick={() => {
                                                            const newName =
                                                                prompt(
                                                                    t("rag.enterNewName"),
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
                                                    content={t("rag.deleteCollection")}
                                                    showArrow
                                                >
                                                    <IconButton
                                                        aria-label={t("rag.deleteCollection")}
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
                                                            {t("rag.loadingFiles")}
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
                                                                        className="anim-fade-slide-up"
                                                                        css={{
                                                                            animationDuration:
                                                                                "0.15s",
                                                                        }}
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
                                                                                    content={t("rag.downloadPdf")}
                                                                                    showArrow
                                                                                >
                                                                                    <IconButton
                                                                                        aria-label={t("rag.downloadPdf")}
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
                                                                                content={t("rag.deleteFile")}
                                                                                showArrow
                                                                            >
                                                                                <IconButton
                                                                                    aria-label={t("rag.deleteFile")}
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
                                                            {t("rag.noFilesFound")}
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
