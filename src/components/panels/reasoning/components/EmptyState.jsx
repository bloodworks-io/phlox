import React from "react";
import { VStack, Text, Button } from "@chakra-ui/react";
import { FaAtom } from "react-icons/fa";

// Empty state component shown when no reasoning has been generated yet
export const EmptyState = ({ loading, status, onGenerate }) => {
    return (
        <VStack spacing={3} p={4} flex="1" justify="center">
            <Text
                textAlign="center"
                fontSize="sm"
                color="gray.500"
            >
                Generate an analysis of the case using your
                model's reasoning capabilities.
            </Text>
            <Button
                leftIcon={<FaAtom />}
                onClick={onGenerate}
                isLoading={loading}
                loadingText={status || "Generating"}
                size="sm"
                className="green-button"
            >
                Generate Clinical Reasoning
            </Button>
        </VStack>
    );
};
