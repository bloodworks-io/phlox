import React from "react";
import { Box, HStack, Text, Button, Link } from "@chakra-ui/react";
import { ExternalLinkIcon, DownloadIcon } from "./icons";
import { FaFilePdf, FaFileImage, FaFile } from "react-icons/fa";

const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getArtifactIcon = (mimeType = "") => {
    if (mimeType.startsWith("image/")) return FaFileImage;
    if (mimeType === "application/pdf") return FaFilePdf;
    return FaFile;
};

const ArtifactCard = ({ artifact }) => {
    const { filename, mime_type, size, url } = artifact;
    const icon = getArtifactIcon(mime_type);

    return (
        <Box
            p={2}
            borderWidth="1px"
            borderRadius="md"
            borderColor="border"
            bg="surfaceInset"
            _dark={{ borderColor: "border", bg: "surface1" }}
            _hover={{ borderColor: "accent" }}
            transition="border-color 0.15s ease"
            maxW="320px"
            className="anim-fade-scale"
            css={{ animationDuration: "0.2s" }}
        >
            <HStack gap={2} mb={1}>
                {React.createElement(icon, { size: "1.2em", color: "overlay0" })}
                <Text fontSize="xs" fontWeight="semibold" truncate minW="0" flex={1}>
                    {filename}
                </Text>
            </HStack>
            <HStack gap={2} justify="space-between">
                <Text fontSize="xs" color="overlay0">
                    {mime_type} · {formatFileSize(size)}
                </Text>
                <HStack gap={1}>
                    {mime_type === "application/pdf" && (
                        <Link href={url} target='_blank' rel='noopener noreferrer'>
                            <Button size="xs" variant="ghost" colorPalette="blue" aria-label="View file"><ExternalLinkIcon />View
                                                            </Button>
                        </Link>
                    )}
                    <Link href={url} download>
                        <Button size="xs" variant="ghost" colorPalette="blue" aria-label="Download file"><DownloadIcon />Save
                                                    </Button>
                    </Link>
                </HStack>
            </HStack>
        </Box>
    );
};

export default ArtifactCard;
