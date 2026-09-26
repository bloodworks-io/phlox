import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Flex, IconButton, Text, Textarea, Button, Spinner } from "@chakra-ui/react";
import { EditIcon, CloseIcon } from "../../common/icons";

const RefinementPanel = ({
    refinementInput,
    setRefinementInput,
    handleRefinement,
    loading,
    setIsRefining,
    suggestions,
}) => {
    const { t } = useTranslation();
    const items =
        suggestions || [
            t("letter.suggestions.formal"),
            t("letter.suggestions.concise"),
            t("letter.suggestions.detail"),
            t("letter.suggestions.clarity"),
        ];
    return (
    <Box
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        width="90%"
        maxWidth="500px"
        zIndex={2}
        className="floating-panel"
        borderRadius="lg"
    >
        {loading && (
            <Flex
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                zIndex={3}
                justify="center"
                align="center"
                bg="rgba(255, 255, 255, 0.4)"
                borderRadius="xl"
            >
                <Spinner size="xl" />
            </Flex>
        )}
        <Flex align="center" justify="space-between" p="3">
            <Flex align="center">
                <EditIcon mr={2} />
                <Text fontSize="sm" fontWeight="medium">
                    {t("letter.refineTitle")}
                </Text>
            </Flex>
            <IconButton
                onClick={() => setIsRefining(false)}
                aria-label={t("letter.closeRefinement")}
                variant="ghost"
                size="sm"
                className="collapse-toggle"><CloseIcon boxSize="12px" /></IconButton>
        </Flex>

        <Box p="3">
            <Flex wrap="wrap" gap={2} mb="3">
                {items.map((suggestion) => (
                    <Button
                        key={suggestion}
                        size="xs"
                        onClick={() => setRefinementInput(suggestion)}
                        className="refinement-suggestions"
                    >
                        {suggestion}
                    </Button>
                ))}
            </Flex>

            <Textarea
                placeholder={t("letter.refinePlaceholder")}
                value={refinementInput}
                onChange={(e) => setRefinementInput(e.target.value)}
                size="sm"
                rows={3}
                mb="3"
                className="chat-input"
                fontSize="sm"
                resize="none"
            />

            <Flex justify="center">
                <Button
                    onClick={handleRefinement}
                    loading={loading}
                    loadingText={t("letter.refining")}
                    size="sm"
                    className="refinement-submit-button"><EditIcon />{t("letter.refine")}
                                    </Button>
            </Flex>
        </Box>
    </Box>
    );
};

export default RefinementPanel;
