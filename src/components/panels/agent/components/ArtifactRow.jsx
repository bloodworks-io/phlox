import React from "react";
import { Box, Text } from "@chakra-ui/react";
import { FaEnvelope, FaFilePdf, FaFile, FaArrowRight } from "react-icons/fa";

import { downloadFormFillArtifact } from "../../../pdf-forms/FormFillArtifact";

const ARTIFACT_ROW_ICONS = {
    letter: FaEnvelope,
    form_fill: FaFilePdf,
};

const _downloadUrl = (url, filename) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "artifact";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

/* A prepared output as one full-width action row. */
export const ArtifactRow = ({ artifact, onOpenLetter }) => {
    const Icon = ARTIFACT_ROW_ICONS[artifact.type] || FaFile;
    const label =
        artifact.title || artifact.template_name || artifact.filename || "Artifact";
    const isLetter = artifact.type === "letter";

    const handleClick = () => {
        if (isLetter) {
            onOpenLetter?.(artifact);
        } else if (artifact.type === "form_fill") {
            downloadFormFillArtifact(artifact);
        } else if (artifact.url) {
            _downloadUrl(artifact.url, artifact.filename);
        }
    };

    return (
        <Box
            as="button"
            display="flex"
            alignItems="center"
            gap={2.5}
            w="100%"
            p={2.5}
            borderWidth="1px"
            borderColor="border"
            borderRadius="8px"
            bg="surfaceInset"
            cursor="pointer"
            textAlign="left"
            mb={1.5}
            transition="border-color 0.15s ease"
            _hover={{ borderColor: "accent" }}
            onClick={handleClick}
            aria-label={`${label} — ${
                artifact.saved ? "saved" : "prepared for review"
            }`}
        >
            <Box
                as="span"
                color="accent"
                flexShrink={0}
                display="flex"
                alignItems="center"
            >
                <Icon size="14px" />
            </Box>
            <Box minW="0" flex="1">
                <Text fontSize="xs" fontWeight="semibold" truncate>
                    {label}
                </Text>
                <Text fontSize="xs" color="fg.subtle">
                    {artifact.saved ? "Saved" : "Prepared for review"} ·{" "}
                    {isLetter ? "Open in letter editor" : "Download"}
                </Text>
            </Box>
            <Box
                as="span"
                color="fg.subtle"
                flexShrink={0}
                display="flex"
                alignItems="center"
            >
                <FaArrowRight size="10px" />
            </Box>
        </Box>
    );
};
