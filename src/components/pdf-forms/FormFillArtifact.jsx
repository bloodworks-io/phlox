// Chat artifact renderer for form_fill type.
import React, { useState } from "react";
import { Box, HStack, Text, Button } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { DownloadIcon } from "../common/icons";
import { FaFilePdf } from "react-icons/fa";
import { pdfFormsApi } from "../../utils/api/pdfFormsApi";
import { fillPdf } from "../../utils/pdf/fillForm";
import { useTranslation } from "react-i18next";
import { t as tStatic } from "@/i18n";

/** Download a form_fill artifact as a filled PDF (shared with the live-agent chips). */
export const downloadFormFillArtifact = async (artifact) => {
    const { template_id, template_name } = artifact;
    const filename = `${template_name || "form"}_filled.pdf`;

    try {
        const [template, pdfData] = await Promise.all([
            pdfFormsApi.fetchTemplate(template_id),
            pdfFormsApi.fetchTemplatePdf(template_id),
        ]);

        const filledBytes = await fillPdf(
            new Uint8Array(pdfData),
            template,
            artifact.field_values,
        );

        const blob = new Blob([filledBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        toaster.create({
            title: tStatic("toast.error"),
            description: tStatic("forms.failedToGenerate", {
                message: error.message,
            }),
            type: "error",
            duration: 3000,
        });
    }
};

const FormFillArtifact = ({ artifact }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);

    const filename = `${artifact.template_name || "form"}_filled.pdf`;

    const handleDownload = async () => {
        setLoading(true);
        try {
            await downloadFormFillArtifact(artifact);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            p={2}
            borderWidth="1px"
            borderRadius="md"
            borderColor="border"
            bg="surfaceInset"
            maxW="320px"
        >
            <HStack gap={2} mb={1}>
                <FaFilePdf size="1.2em" color="gray" />
            <Text fontSize="xs" fontWeight="semibold" truncate minW="0" flex={1}>
                {filename}
            </Text>
            </HStack>
            <HStack gap={2} justify="space-between">
                <Text fontSize="xs" color="overlay0">
                    {t("forms.pdfFormFilled")}
                </Text>
                <Button
                    size="xs"
                    variant="ghost"
                    colorPalette="blue"
                    aria-label={t("forms.downloadFilledPdf")}
                    onClick={handleDownload}
                    loading={loading}><DownloadIcon />{t("action.save")}
                                    </Button>
            </HStack>
        </Box>
    );
};

export default FormFillArtifact;
