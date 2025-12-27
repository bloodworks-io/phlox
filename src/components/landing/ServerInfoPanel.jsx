// Component to display information about the server and loaded models.
import React from "react";
import { Box, Flex, Text, VStack, HStack, IconButton } from "@chakra-ui/react";
import { RepeatIcon } from "@chakra-ui/icons";
import { FaServer } from "react-icons/fa";

const ServerInfoPanel = ({
    serverInfo,
    isServerInfoRefreshing,
    fetchServerInfo,
}) => {
    return (
        <Box className="panels-bg" p="5" borderRadius="sm" shadow="sm">
            <Flex justify="space-between" align="center" mb="4">
                <HStack spacing={3}>
                    <FaServer size="1.2em" />
                    <Text as="h3">Server Information</Text>
                </HStack>
                <IconButton
                    icon={<RepeatIcon />}
                    onClick={fetchServerInfo}
                    isLoading={isServerInfoRefreshing}
                    aria-label="Refresh server info"
                    size="sm"
                    className="settings-button"
                    borderRadius="sm"
                />
            </Flex>

            <Box
                w="full"
                maxH="300px"
                overflowY="auto"
                className="summary-panels"
                borderRadius="sm"
                p={4}
            >
                {serverInfo?.models ? (
                    <VStack align="stretch" spacing={3}>
                        {serverInfo.models.map((model, index) => (
                            <Box
                                key={index}
                                p={3}
                                borderWidth="1px"
                                borderRadius="sm"
                                className="landing-items"
                            >
                                <HStack justify="space-between" mb={2}>
                                    <Text fontWeight="bold" fontSize="sm">
                                        {model.model.split(":")[0]}
                                    </Text>
                                    <Text fontSize="sm" color="gray.500">
                                        {model.details?.parameter_size}
                                    </Text>
                                </HStack>

                                <HStack spacing={4} fontSize="sm">
                                    <HStack>
                                        <Text color="gray.500">Size:</Text>
                                        <Text>
                                            {(
                                                model.size_vram /
                                                (1024 * 1024 * 1024)
                                            ).toFixed(1)}{" "}
                                            GB
                                        </Text>
                                    </HStack>
                                    <HStack>
                                        <Text color="gray.500">
                                            Quantization:
                                        </Text>
                                        <Text>
                                            {model.details?.quantization_level?.replace(
                                                "Q4_K_M",
                                                "Q4",
                                            )}
                                        </Text>
                                    </HStack>
                                </HStack>
                            </Box>
                        ))}
                    </VStack>
                ) : (
                    <Flex
                        direction="column"
                        align="center"
                        justify="center"
                        py={8}
                        color="gray.500"
                    >
                        <Text>No models running</Text>
                    </Flex>
                )}
            </Box>
        </Box>
    );
};

export default ServerInfoPanel;
