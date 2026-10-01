import {
  VStack,
  HStack,
  Box,
  Text,
  Popover,
  Portal,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@/components/ui/tooltip";
import { InfoIcon } from "../../icons";
import { calculateLLMPerformance } from "../../../../utils/performanceUtils";

const getMachineLabel = (t, os) => {
  if (os === "macos") return t("splash.performance.machineMac");
  if (os === "windows") return t("splash.performance.machinePc");
  return t("splash.performance.machineSystem");
};

// Performance info popover — info icon is the trigger
export const PerformancePopover = ({ model, systemSpecs }) => {
  const { t } = useTranslation();
  const perf =
    systemSpecs?.apple_silicon && model.parameters_billions
      ? calculateLLMPerformance(
          systemSpecs.apple_silicon.generation,
          systemSpecs.apple_silicon.tier,
          model.parameters_billions,
          model.active_parameters_billions,
        )
      : null;

  return (
    <Popover.Root positioning={{ placement: "top", offset: { mainAxis: 4 } }}>
      <Popover.Trigger asChild>
        <Box
          cursor="pointer"
          onClick={(e) => e.stopPropagation()}
          display="flex"
          alignItems="center"
          color="textSecondary"
          _hover={{ color: "primaryButton" }}
          transition="color 0.15s"
        >
          <InfoIcon boxSize={3.5} />
        </Box>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content w="200px">
            <Popover.Arrow>
              <Popover.ArrowTip />
            </Popover.Arrow>
            <Popover.Body p={3}>
              <VStack gap={1} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="xs" className="pill-box-icons">
                    {t("splash.performance.size")}
                  </Text>
                  <Text fontSize="xs" fontWeight="bold">
                    {model.size_mb}MB
                  </Text>
                </HStack>
                {(model.active_parameters_billions ||
                  model.parameters_billions) && (
                  <HStack justify="space-between">
                    <Text fontSize="xs" className="pill-box-icons">
                      {t("splash.performance.parameters")}
                    </Text>
                    <Text fontSize="xs" fontWeight="bold">
                      {model.active_parameters_billions
                        ? `${model.active_parameters_billions}B`
                        : `${model.parameters_billions}B`}
                    </Text>
                  </HStack>
                )}
                {model.recommended_ram_gb && (
                  <HStack justify="space-between">
                    <Text fontSize="xs" className="pill-box-icons">
                      {t("splash.performance.ramNeeded")}
                    </Text>
                    <Text fontSize="xs" fontWeight="bold">
                      {model.recommended_ram_gb}GB
                    </Text>
                  </HStack>
                )}
                {systemSpecs && (
                  <HStack justify="space-between">
                    <Text fontSize="xs" className="pill-box-icons">
                      {getMachineLabel(t, systemSpecs.os)}
                    </Text>
                    <Text
                      fontSize="xs"
                      fontWeight="bold"
                      color={
                        model.recommended_ram_gb &&
                        systemSpecs.total_memory_gb >= model.recommended_ram_gb
                          ? "successButton"
                          : "secondaryButton"
                      }
                    >
                      {systemSpecs.total_memory_gb.toFixed(0)}GB
                    </Text>
                  </HStack>
                )}
                {perf && (
                  <Tooltip
                    content={t("splash.performance.estTimeTooltip")}
                    showArrow
                  >
                    <HStack justify="space-between">
                      <Text fontSize="xs" className="pill-box-icons">
                        {t("splash.performance.estTime")}
                      </Text>
                      <Text fontSize="xs" fontWeight="bold">
                        ~{Math.round(perf.estimatedTime)}s
                      </Text>
                    </HStack>
                  </Tooltip>
                )}
              </VStack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
