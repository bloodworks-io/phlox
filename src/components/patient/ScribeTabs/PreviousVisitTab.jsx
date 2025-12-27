import { Box, Text, VStack } from "@chakra-ui/react";

const PreviousVisitTab = ({ previousVisitSummary }) => {
    return (
        <Box className="tab-panel-container">
            <VStack spacing={4}>
                {previousVisitSummary ? (
                    <Box>
                        <Text mt={2}>{previousVisitSummary}</Text>
                    </Box>
                ) : (
                    <Text>No previous visit records found.</Text>
                )}
            </VStack>
        </Box>
    );
};

export default PreviousVisitTab;
