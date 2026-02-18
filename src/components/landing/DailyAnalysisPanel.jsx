// Component displaying daily analysis digest, including incomplete jobs.
import React from "react";
import {
    Box,
    Flex,
    Icon,
    Text,
    VStack,
    HStack,
    IconButton,
} from "@chakra-ui/react";
import { RepeatIcon } from "@chakra-ui/icons";
import { FaChartLine, FaFileAlt, FaHistory } from "react-icons/fa";

const DailyAnalysisPanel = ({
    analysis,
    incompleteJobs,
    isAnalysisRefreshing,
    refreshAnalysis,
}) => {
    return (
        <Box className="panels-bg" p="5" borderRadius="sm" shadow="sm">
            <Flex justify="space-between" align="center" mb="4">
                <HStack spacing={3}>
                    <FaChartLine size="1.2em" />
                    <Text as="h3">Daily Intelligence Digest</Text>
                    <Box px={3} py={1} borderRadius="full" bg="teal.100">
                        <Text fontSize="sm" fontWeight="bold">
                            {incompleteJobs} pending
                        </Text>
                    </Box>
                </HStack>
                <IconButton
                    icon={<RepeatIcon />}
                    onClick={refreshAnalysis}
                    aria-label="Refresh analysis"
                    size="sm"
                    className="settings-button"
                    borderRadius="sm"
                    isLoading={isAnalysisRefreshing}
                />
            </Flex>

            <Box
                className="floating-main custom-scrollbar"
                p="4"
                minH="200px"
                maxH="400px"
                overflowY="auto"
                borderRadius="sm"
            >
                {analysis ? (
                    <VStack align="stretch" spacing={3}>
                        <Text whiteSpace="pre-wrap">{analysis.analysis}</Text>
                        <HStack spacing={2} color="gray.500" pt={2}>
                            <Icon as={FaHistory} />
                            <Text fontSize="sm">
                                Generated:{" "}
                                {new Date(
                                    analysis.generated_at,
                                ).toLocaleString()}
                            </Text>
                        </HStack>
                    </VStack>
                ) : (
                    <Flex
                        direction="column"
                        align="center"
                        justify="center"
                        h="full"
                    >
                        <Icon as={FaFileAlt} fontSize="3xl" mb={2} />
                        <Text>No analysis available</Text>
                    </Flex>
                )}
            </Box>
        </Box>
    );
};

export default DailyAnalysisPanel;
