import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Text, Textarea } from "@chakra-ui/react";

const CustomInstructionsInput = ({
    additionalInstructions,
    setAdditionalInstructions,
}) => {
    const { t } = useTranslation();
    return (
        <Box mt="2">
            <Text fontSize="sm" mb="2">
                {t("letter.customInstructions")}
            </Text>
            <Textarea
                placeholder={t("letter.customInstructionsPlaceholder")}
                size="sm"
                rows={2}
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                className="chat-input"
                css={{
                    paddingY: "2",
                    paddingX: "4",
                    minHeight: "40px",
                    resize: "none"
                }}
            />
        </Box>
    );
};

export default CustomInstructionsInput;
