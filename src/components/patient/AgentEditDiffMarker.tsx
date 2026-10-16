import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box, Popover, Text } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { FaExclamationTriangle } from "react-icons/fa";
import { lineDiff } from "../../utils/lineDiff";

const AgentEditDiffMarker = ({
  fieldLabel,
  before,
  after,
}: {
  fieldLabel: string;
  before?: string;
  after: string;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rows = useMemo(
    () => (before === undefined ? [] : lineDiff(before, after)),
    [before, after],
  );
  const markerLabel = t("patient.agentEditedPersistentField");

  return (
    <Popover.Root
      open={open}
      onOpenChange={(details) => setOpen(details.open)}
      positioning={{ placement: "bottom-start" }}
    >
      <Popover.Trigger asChild>
        <Box
          as="button"
          className="cohesive-agent-edit-marker"
          aria-label={markerLabel}
        >
          <Tooltip
            content={markerLabel}
            showArrow
            disabled={open}
            positioning={{ placement: "right" }}
          >
            <Box as="span" display="inline-flex" lineHeight="0">
              <FaExclamationTriangle />
            </Box>
          </Tooltip>
        </Box>
      </Popover.Trigger>
      <Popover.Positioner>
        <Popover.Content maxW="440px" w="440px">
          <Popover.Arrow>
            <Popover.ArrowTip />
          </Popover.Arrow>
          <Popover.Header
            display="flex"
            alignItems="center"
            gap={2}
            fontSize="sm"
            fontWeight="600"
          >
            <FaExclamationTriangle />
            <Text as="span" truncate>
              {t("patient.agentDiffTitle", { field: fieldLabel })}
            </Text>
          </Popover.Header>
          <Popover.Body>
            {before === undefined ? (
              <Text fontSize="sm" whiteSpace="pre-wrap">
                {t("patient.agentDiffUnavailable")}
              </Text>
            ) : (
              <Box className="agent-diff">
                {rows.map((row, index) => (
                  <Text
                    key={index}
                    as="div"
                    className={`agent-diff-line agent-diff-line--${row.type}`}
                    whiteSpace="pre-wrap"
                  >
                    {row.type === "add" ? "+ " : row.type === "remove" ? "- " : ""}
                    {row.text}
                  </Text>
                ))}
              </Box>
            )}
          </Popover.Body>
        </Popover.Content>
      </Popover.Positioner>
    </Popover.Root>
  );
};

export default AgentEditDiffMarker;
