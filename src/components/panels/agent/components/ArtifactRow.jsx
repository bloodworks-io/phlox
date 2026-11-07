import React from "react";
import { Box, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { LuArrowRight, LuFile, LuFileText, LuMail } from "react-icons/lu";

import { downloadFormFillArtifact } from "../../../pdf-forms/FormFillArtifact";

const ARTIFACT_ROW_ICONS = {
    letter: LuMail,
    form_fill: LuFileText,
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
    const { t } = useTranslation();
    const Icon = ARTIFACT_ROW_ICONS[artifact.type] || LuFile;
    const label =
        artifact.title ||
        artifact.template_name ||
        artifact.filename ||
        t("agent.artifact.defaultTitle");
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
            borderColor="folio.line"
            borderRadius="folioPanel"
            bg="folio.paper"
            cursor="pointer"
            textAlign="left"
            mb={1.5}
            transition="border-color 0.15s ease"
            _hover={{ borderColor: "folio.accent" }}
            onClick={handleClick}
            aria-label={t("agent.artifact.aria", {
                label,
                state: artifact.saved
                    ? t("agent.artifact.stateSaved")
                    : t("agent.artifact.statePrepared"),
            })}
        >
            <Box
                as="span"
                color="folio.accent"
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
                <Text fontSize="xs" color="folio.muted">
                    {artifact.saved
                        ? t("agent.artifact.saved")
                        : t("agent.artifact.preparedForReview")}{" "}
                    ·{" "}
                    {isLetter
                        ? t("agent.artifact.openInEditor")
                        : t("agent.artifact.download")}
                </Text>
            </Box>
            <Box
                as="span"
                color="folio.muted"
                flexShrink={0}
                display="flex"
                alignItems="center"
            >
                <LuArrowRight size="10px" strokeWidth={1.6} />
            </Box>
        </Box>
    );
};
