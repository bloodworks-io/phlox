import { Box, Text } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { FaThumbtack } from "react-icons/fa";

// Preview component that mimics Summary.jsx field rendering
export const FieldPreview = ({ field }) => {
    const { t } = useTranslation();
    const content = field.style_example || "";

    return (
        <Box
            className="cohesive-field"
            css={{ animation: "phloxFadeScaleIn 0.2s ease-out both" }}
        >
            <Text className="cohesive-field-label">
                {field.field_name || t("modal.fieldEditor.unnamedField")}
                {field.persistent && (
                    <Tooltip
                        content={t("modal.fieldPreview.persistsTooltip")}
                        showArrow
                        positioning={{
                            placement: "right"
                        }}
                    >
                        <Box as="span" className="cohesive-persistent-marker">
                            <FaThumbtack />
                        </Box>
                    </Tooltip>
                )}
            </Text>
            <Box
                className="cohesive-textarea"
                minH="60px"
                p="2"
                borderRadius="sm"
                whiteSpace="pre-wrap"
                fontSize="sm"
                color="textTertiary"
            >
                {content || (
                    <Text
                        color="textSecondary"
                        asChild
                    ><i>
                            {field.persistent
                                ? t("modal.fieldPreview.persistentContent")
                                : t("modal.fieldPreview.dynamicContent")}
                        </i></Text>
                )}
            </Box>
        </Box>
    );
};
