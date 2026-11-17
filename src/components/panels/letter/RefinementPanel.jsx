import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Flex, IconButton, Input, Button } from "@chakra-ui/react";
import { EditIcon, CloseIcon } from "../../common/icons";

const RefinementPanel = ({
    refinementInput,
    setRefinementInput,
    handleRefinement,
    loading,
    setIsRefining,
}) => {
    const { t } = useTranslation();
    return (
        <Flex
            className="refinement-bar"
            align="center"
            gap="2"
            p="3"
            flexShrink={0}
            borderTopWidth="1px"
            borderTopColor="folio.line"
            onKeyDown={(e) => {
                // IME Enter/Escape confirms/cancels composition, not the bar.
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                if (e.key === "Escape") setIsRefining(false);
                if (e.key === "Enter" && e.target.tagName === "INPUT" && !loading) {
                    handleRefinement();
                }
            }}
        >
            <Box color="folio.accent" flexShrink={0} display="flex">
                <EditIcon />
            </Box>
            <Input
                autoFocus
                placeholder={t("letter.refinePlaceholder")}
                value={refinementInput}
                onChange={(e) => setRefinementInput(e.target.value)}
                size="sm"
                className="chat-input"
                fontSize="sm"
                disabled={loading}
            />
            <Button
                onClick={handleRefinement}
                loading={loading}
                loadingText={t("letter.refining")}
                size="sm"
                variant="folioPrimary"
            >
                <EditIcon />
                {t("letter.refine")}
            </Button>
            <IconButton
                onClick={() => setIsRefining(false)}
                aria-label={t("letter.closeRefinement")}
                variant="ghost"
                size="sm"
                color="folio.muted"
                backgroundColor="transparent"
                _hover={{ backgroundColor: "folio.hover", color: "folio.ink" }}
                _focusVisible={{
                    outline: "2px solid",
                    outlineColor: "folio.focus",
                    outlineOffset: "2px",
                }}
            >
                <CloseIcon boxSize="12px" />
            </IconButton>
        </Flex>
    );
};

export default RefinementPanel;
