import React from "react";
import { Box, Text, Progress } from "@chakra-ui/react";

export const ModelDownloadProgress = ({ progress }) => {
  if (!progress) return null;

  const { percentage } = progress;

  return (
    <Box>
      <Text fontSize="xs" color="folio.muted" mb={1}>
        {Math.round(percentage)}%
      </Text>
      <Progress.Root value={percentage} variant="folio" size="sm" striped animated>
        <Progress.Track>
          <Progress.Range />
        </Progress.Track>
      </Progress.Root>
    </Box>
  );
};
