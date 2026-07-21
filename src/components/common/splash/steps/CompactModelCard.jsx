import {
  HStack,
  Box,
  Text,
  Button,
  Progress,
} from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DownloadIcon,
  CheckIcon,
} from "../../icons";
import { FaStar } from "react-icons/fa";
import { GreenButton, NavButton } from "../../Buttons";
import { PerformancePopover } from "./PerformancePopover";

// Compact model card for carousel
export const CompactModelCard = ({
  model,
  isSelected,
  isDownloaded,
  isDownloading,
  downloadProgress,
  onSelect,
  onDownload,
  systemSpecs,
}) => {
  const isRecommended = model.recommendedType === "recommended";

  return (
    <Box
      p="3"
      borderRadius="md"
      borderWidth="1px"
      borderColor={
        isSelected
          ? "primaryButton"
          : isRecommended
            ? "purple.200"
            : "surface"
      }
      bg={isSelected ? "primaryButtonFaint" : "base"}
      position="relative"
      overflow="hidden"
      h="100%"
      minH="120px"
      cursor={isDownloaded ? "pointer" : "default"}
      onClick={isDownloaded ? onSelect : undefined}
      transition="all 0.2s ease"
      _hover={
        isDownloaded
          ? { borderColor: "primaryButton", shadow: "sm" }
          : { borderColor: "surface1" }
      }
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
    >
      {/* Header: star + name + info icon */}
      <HStack w="full" justify="space-between">
        <HStack gap={1}>
          {model.recommendedType === "recommended" && (
            <Tooltip content="Recommended for your Mac" showArrow>
              <Box color="secondaryButton" display="flex" alignItems="center" cursor="default">
                <FaStar size="12" />
              </Box>
            </Tooltip>
          )}
          <Text fontSize="sm" fontWeight="bold">
            {model.simple_name || model.id}
          </Text>
        </HStack>
        <PerformancePopover model={model} systemSpecs={systemSpecs} />
      </HStack>

      <Text fontSize="xs" fontWeight="normal" className="pill-box-icons" noOfLines={2}>
        {model.description}
      </Text>

      {/* Download progress */}
      {isDownloading && (
        <Box mt={1}>
          <Progress.Root
            value={downloadProgress}
            colorPalette="blue"
            size="xs"
            striped
            animated
          >
            <Progress.Track>
              <Progress.Range />
            </Progress.Track>
          </Progress.Root>
          <Text
            fontSize="xs"
            className="pill-box-icons"
            textAlign="right"
            mt={0.5}
          >
            {downloadProgress.toFixed(0)}%
          </Text>
        </Box>
      )}

      {/* Action button */}
      {!isDownloading && isDownloaded && isSelected && (
        <GreenButton size="sm" w="full" disabled leftIcon={<CheckIcon />}>
          Selected
        </GreenButton>
      )}
      {!isDownloading && isDownloaded && !isSelected && (
        <Button size="sm" w="full" variant="outline" onClick={onSelect}>
          Select
        </Button>
      )}
      {!isDownloading && !isDownloaded && (
        <NavButton size="sm" w="full" onClick={onDownload}>
          <DownloadIcon />
          Download
        </NavButton>
      )}
    </Box>
  );
};
