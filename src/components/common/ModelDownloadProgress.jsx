import React from "react";
import { Box, Text, Progress } from "@chakra-ui/react";

export const ModelDownloadProgress = ({ progress }) => {
  if (!progress) return null;

  const { percentage } = progress;

  return (
    <Box>
      <Text fontSize="xs" color="gray.600" mb={1}>
        {Math.round(percentage)}%
      </Text>
      <Progress
        value={percentage}
        colorScheme="blue"
        size="sm"
        hasStripe
        isAnimated
      />
    </Box>
  );
};
