import React from "react";
import {
    Box,
    Flex,
    IconButton,
    Text,
    Textarea,
    Button,
    Spinner,
} from "@chakra-ui/react";
import { EditIcon, CloseIcon } from "@chakra-ui/icons";

const RefinementPanel = ({
    refinementInput,
    setRefinementInput,
    handleRefinement,
    loading,
    setIsRefining,
    suggestions = [
        "More formal",
        "More concise",
        "Add detail",
        "Improve clarity",
    ],
}) => (
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
                    Refine Letter
                </Text>
            </Flex>
            <IconButton
                icon={<CloseIcon boxSize="12px" />}
                onClick={() => setIsRefining(false)}
                aria-label="Close refinement"
                variant="ghost"
                size="sm"
                className="collapse-toggle"
            />
        </Flex>

        <Box p="3">
            <Flex wrap="wrap" gap={2} mb="3">
                {suggestions.map((suggestion) => (
                    <Button
                        key={suggestion}
                        size="xs"
                        onClick={() => setRefinementInput(suggestion)}
                        className="chat-suggestions"
                    >
                        {suggestion}
                    </Button>
                ))}
            </Flex>

            <Textarea
                placeholder="How would you like to improve the letter?"
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
                    isLoading={loading}
                    loadingText="Refining..."
                    size="sm"
                    className="refinement-submit-button"
                    leftIcon={<EditIcon />}
                >
                    Refine
                </Button>
            </Flex>
        </Box>
    </Box>
);

export default RefinementPanel;
