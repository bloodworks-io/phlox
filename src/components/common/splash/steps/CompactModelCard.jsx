import {
  HStack,
  Box,
  Text,
  Button,
  Progress,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DownloadIcon,
  CheckIcon,
} from "../../icons";
import { LuStar } from "react-icons/lu";
import { PrimaryButton, SuccessButton } from "../../Buttons";
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
  const { t } = useTranslation();
  const isRecommended = model.recommendedType === "recommended";

  return (
    <Box
      p="3"
      borderRadius="folioPanel"
      borderWidth="1px"
      borderColor={
        isSelected
          ? "folio.accent"
          : isRecommended
            ? "folio.info"
            : "folio.line"
      }
      bg={isSelected ? "folio.accentSoft" : "folio.paper"}
      position="relative"
      overflow="hidden"
      h="100%"
      minH="120px"
      cursor={isDownloaded ? "pointer" : "default"}
      onClick={isDownloaded ? onSelect : undefined}
      transition="background-color 160ms ease, border-color 160ms ease"
      _hover={
        isDownloaded
          ? { borderColor: "folio.accent" }
          : { borderColor: "folio.muted" }
      }
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
    >
      {/* Header: star + name + info icon */}
      <HStack w="full" justify="space-between">
        <HStack gap={1}>
          {model.recommendedType === "recommended" && (
            <Tooltip content={t("splash.step.aiModels.recommendedTooltip")} showArrow>
              <Box color="folio.info" display="flex" alignItems="center" cursor="default">
                <LuStar size="12" strokeWidth={1.6} />
              </Box>
            </Tooltip>
          )}
          <Text fontSize="sm" fontWeight="bold">
            {model.simple_name || model.id}
          </Text>
        </HStack>
        <PerformancePopover model={model} systemSpecs={systemSpecs} />
      </HStack>

      <Text fontSize="xs" fontWeight="normal" color="folio.muted" className="settings-meta" noOfLines={2}>
        {model.description}
      </Text>

      {/* Download progress */}
      {isDownloading && (
        <Box mt={1}>
          <Progress.Root
            value={downloadProgress}
            variant="folio"
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
            color="folio.muted"
            className="settings-meta"
            textAlign="right"
            mt={0.5}
          >
            {downloadProgress.toFixed(0)}%
          </Text>
        </Box>
      )}

      {/* Action button */}
      {!isDownloading && isDownloaded && isSelected && (
        <SuccessButton size="sm" w="full" disabled leftIcon={<CheckIcon />}>
          {t("splash.step.aiModels.selected")}
        </SuccessButton>
      )}
      {!isDownloading && isDownloaded && !isSelected && (
        <Button size="sm" w="full" variant="folioSecondary" onClick={onSelect}>
          {t("splash.step.aiModels.select")}
        </Button>
      )}
      {!isDownloading && !isDownloaded && (
        <PrimaryButton size="sm" w="full" onClick={onDownload}>
          <DownloadIcon />
          {t("splash.step.aiModels.download")}
        </PrimaryButton>
      )}
    </Box>
  );
};
