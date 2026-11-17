import React from "react";
import { useTranslation } from "react-i18next";
import { VStack, Text, Button } from "@chakra-ui/react";
import { LuAtom } from "react-icons/lu";

// Empty state component shown when no reasoning has been generated yet
export const EmptyState = ({ loading, status, onGenerate }) => {
    const { t } = useTranslation();
    return (
        <VStack gap={3} p={4} flex="1" justify="center">
            <Text
                textAlign="center"
                fontSize="sm"
                color="folio.faint"
            >
                {t("reasoning.emptyHint")}
            </Text>
            <Button
                onClick={onGenerate}
                loading={loading}
                loadingText={status || t("reasoning.generating")}
                size="sm"
                variant="folioPrimary"><LuAtom strokeWidth={1.6} />{t("reasoning.generate")}
                            </Button>
        </VStack>
    );
};
