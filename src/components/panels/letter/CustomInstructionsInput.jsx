import React from "react";
import { Box, Text, Textarea } from "@chakra-ui/react";

const CustomInstructionsInput = ({
    additionalInstructions,
    setAdditionalInstructions,
}) => {
    return (
        <Box mt="2">
            <Text fontSize="sm" mb="2">
                Custom Instructions:
            </Text>
            <Textarea
                placeholder="Enter custom instructions for letter generation..."
                size="sm"
                rows={2}
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                className="chat-input"
                sx={{
                    paddingY: "2",
                    paddingX: "4",
                    minHeight: "40px",
                    resize: "none",
                }}
            />
        </Box>
    );
};

export default CustomInstructionsInput;
