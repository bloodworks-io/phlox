// Chat artifact renderer for form_fill type.
import React, { useState } from "react";
import { Box, HStack, Text, Button } from "@chakra-ui/react";
import { useToast } from "@/utils/useToastShim";
import { DownloadIcon } from "../common/icons";
import { FaFilePdf } from "react-icons/fa";
import { pdfFormsApi } from "../../utils/api/pdfFormsApi";
import { fillPdf } from "../../utils/pdf/fillForm";

const FormFillArtifact = ({ artifact }) => {
    const [loading, setLoading] = useState(false);
    const toast = useToast();

    const { template_id, template_name } = artifact;
    const filename = `${template_name || "form"}_filled.pdf`;

    const handleDownload = async () => {
        setLoading(true);
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
            toast({
                title: "Error",
                description: `Failed to generate PDF: ${error.message}`,
                status: "error",
                duration: 3000,
                isClosable: true,
            });
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
                <Text fontSize="xs" fontWeight="semibold" isTruncated flex={1}>
                    {filename}
                </Text>
            </HStack>
            <HStack gap={2} justify="space-between">
                <Text fontSize="xs" color="gray.500">
                    PDF form · filled
                </Text>
                <Button
                    size="xs"
                    variant="ghost"
                    colorPalette="blue"
                    aria-label="Download filled PDF"
                    onClick={handleDownload}
                    loading={loading}><DownloadIcon />Save
                                    </Button>
            </HStack>
        </Box>
    );
};

export default FormFillArtifact;
