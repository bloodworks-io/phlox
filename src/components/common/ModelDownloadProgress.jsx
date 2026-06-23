import React from "react";
import { Steps, Box, Text, Progress } from "@chakra-ui/react";

export const ModelDownloadProgress = ({ progress }) => {
  if (!progress) return null;

  const { percentage } = progress;

  return (
    <Box>
      <Text fontSize="xs" color="gray.600" mb={1}>
        {Math.round(percentage)}%
      </Text>
      <Progress.Root value={percentage} colorPalette="blue" size="sm" striped animated>
        <Progress.Track>
          <Progress.Range />
        </Progress.Track>
      </Progress.Root>
    </Box>
  );
};
