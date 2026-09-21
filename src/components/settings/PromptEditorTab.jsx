import { Box, Button, Flex, Textarea, Text, VStack } from "@chakra-ui/react";
import { FiRefreshCw } from "react-icons/fi";

const ResetToDefaultButton = ({ onClick, ...props }) => (
    <Button
        size="sm"
        h="30px"
        minH="30px"
        className="red-button"
        onClick={onClick}
        {...props}
    >
        <FiRefreshCw />
        Reset to Default
    </Button>
);

const PromptEditorTab = ({ title, subtitle, value, onChange, onReset }) => (
    <VStack gap={4} align="stretch">
        <Flex justify="space-between" align="center">
            <Box>
                <Text fontSize="md" fontWeight="bold">
                    {title}
                </Text>
                <Text fontSize="sm" color="overlay0">
                    {subtitle}
                </Text>
            </Box>
            <ResetToDefaultButton onClick={onReset} />
        </Flex>
        <Textarea
            value={value || ""}
            onChange={(e) => onChange && onChange(e.target.value)}
            rows={10}
            className="textarea-style"
        />
    </VStack>
);

export default PromptEditorTab;
