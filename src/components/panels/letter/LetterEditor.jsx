import { Box, Flex, IconButton, Textarea, Spinner } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@/components/ui/tooltip";
import { EditIcon } from "../../common/icons";

const LetterEditor = ({
  finalCorrespondence,
  onLetterChange,
  setIsRefining,
  loading,
  isRefining,
  textareaRef,
  refinementPanel,
  dictationWidget,
}) => {
  const { t } = useTranslation();

  return (
    <Box position="relative" height="100%">
      {loading && (
        <Flex
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={1}
          justify="center"
          align="center"
          borderRadius="folioPanel"
          backgroundColor="folio.canvas"
          opacity={0.78}
        >
          <Spinner size="xl" color="folio.brand" />
        </Flex>
      )}
      <Box
        display="flex"
        flexDirection="column"
        height="100%"
        maxHeight="100%"
        overflow="hidden"
        borderRadius="folioPanel"
        className="attached-panel-body"
        backgroundColor="folio.canvas"
        color="folio.ink"
        opacity={loading ? 0.6 : 1}
        transition="opacity 160ms ease"
      >
        <Textarea
          placeholder={t("letter.placeholder")}
          value={finalCorrespondence || t("letter.toast.noneAttached")}
          onChange={(event) => onLetterChange(event.target.value)}
          flex="1"
          minHeight="0"
          style={{
            color: loading ? "var(--chakra-colors-folio-faint)" : "inherit",
            transition: "color 160ms ease-in-out",
            overflow: "auto !important",
          }}
          className="textarea-style letter-editor-textarea sidebar-scroll-overlay"
          ref={textareaRef}
          disabled={loading}
        />
        <Tooltip
          content={t("letter.refineTooltip")}
          disabled={loading}
          positioning={{ placement: "left" }}
        >
          <IconButton
            position="absolute"
            bottom={4}
            width="40px"
            height="40px"
            right={4}
            zIndex={2}
            aspectRatio="1/1"
            pointerEvents={loading ? "none" : "auto"}
            backgroundColor="folio.accent"
            color="folio.accentInk"
            borderWidth="1px"
            borderColor="folio.accent"
            transition="background-color 160ms ease, color 160ms ease, opacity 160ms ease"
            _hover={
              loading ? undefined : { backgroundColor: "folio.accent/90" }
            }
            _focusVisible={{
              outline: "2px solid",
              outlineColor: "folio.focus",
              outlineOffset: "2px",
            }}
            className="refinement-fab"
            onClick={() => !loading && setIsRefining(true)}
            aria-label={t("letter.refineTooltip")}
            disabled={loading}
          >
            <EditIcon />
          </IconButton>
        </Tooltip>
        {dictationWidget}
      </Box>
      {isRefining && refinementPanel}
    </Box>
  );
};

export default LetterEditor;
