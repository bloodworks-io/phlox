import {
  VStack,
  HStack,
  Box,
  Text,
  Popover,
  Portal,
} from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { InfoIcon } from "../../icons";
import { calculateLLMPerformance } from "../../../../utils/performanceUtils";

const getMachineLabel = (os) => {
  if (os === "macos") return "Your Mac";
  if (os === "windows") return "Your PC";
  return "Your system";
};

// Performance info popover — info icon is the trigger
export const PerformancePopover = ({ model, systemSpecs }) => {
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
                    Size
                  </Text>
                  <Text fontSize="xs" fontWeight="bold">
                    {model.size_mb}MB
                  </Text>
                </HStack>
                {(model.active_parameters_billions ||
                  model.parameters_billions) && (
                  <HStack justify="space-between">
                    <Text fontSize="xs" className="pill-box-icons">
                      Parameters
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
                      RAM needed
                    </Text>
                    <Text fontSize="xs" fontWeight="bold">
                      {model.recommended_ram_gb}GB
                    </Text>
                  </HStack>
                )}
                {systemSpecs && (
                  <HStack justify="space-between">
                    <Text fontSize="xs" className="pill-box-icons">
                      {getMachineLabel(systemSpecs.os)}
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
                    content="Estimated processing time for a 10-minute consultation"
                    showArrow
                  >
                    <HStack justify="space-between">
                      <Text fontSize="xs" className="pill-box-icons">
                        Est. time
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
