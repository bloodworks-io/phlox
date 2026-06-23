import React from "react";
import { Steps, Box, Text, Progress } from "@chakra-ui/react";

export const ReEmbedProgress = ({ progress }) => {
    if (!progress) return null;

    const {
        percentage = 0,
        collection_index = 0,
        total_collections = 0,
        collection_name = "",
        chunks_embedded = 0,
        total_chunks_in_collection = 0,
    } = progress;

    return (
        <Box w="100%">
            <Text fontSize="xs" color="gray.600" mb={1}>
                Collection {collection_index + 1} of {total_collections}
                {collection_name ? `: ${collection_name}` : ""}
            </Text>
            <Progress.Root value={percentage} colorPalette="blue" size="sm" striped animated>
                <Progress.Track>
                    <Progress.Range />
                </Progress.Track>
            </Progress.Root>
            <Text fontSize="xs" color="gray.500" mt={1}>
                {chunks_embedded} of {total_chunks_in_collection} chunks
                embedded
            </Text>
        </Box>
    );
};
