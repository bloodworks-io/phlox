import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Flex, Text, NativeSelect } from "@chakra-ui/react";
import { Tooltip } from '@/components/ui/tooltip';
import { LuMail, LuMic, LuWandSparkles } from "react-icons/lu";

import LetterEditor from "./LetterEditor";
import CustomInstructionsInput from "./CustomInstructionsInput";
import PanelFooterActions from "./PanelFooterActions";
import RefinementPanel from "./RefinementPanel";
import DictationWidget from "./DictationWidget";

const LetterPanel = ({
  patient,
  dimensions,
  resizerRef,
  handleMouseDown,
  _onClose,
  finalCorrespondence,
  setFinalCorrespondence,
  letterLoading,
  setLoading,
  handleGenerateLetterClick,
  handleSaveLetter,
  setIsModified,
  letterTemplates,
  selectedTemplate,
  selectTemplate,
  additionalInstructions,
  setAdditionalInstructions,
  refinementInput,
  setRefinementInput,
  handleRefinement,
  isRefining,
  setIsRefining,
  textareaRef,
  recentlyCopied,
  saveState,
  handleCopy,
}) => {
  const [letterMode, setLetterMode] = useState("draft");
  const refineButtonRef = useRef(null);
  const wasRefiningRef = useRef(isRefining);
  const { t } = useTranslation();
  const isDictateMode = letterMode === "dictate";
  const templateOptions = letterTemplates.filter((tpl) => tpl.name !== "Dictation");
  const templateValue =
    selectedTemplate === "custom"
      ? "custom"
      : selectedTemplate && templateOptions.some((tpl) => tpl.id === selectedTemplate.id)
        ? String(selectedTemplate.id)
        : "";

  useEffect(() => {
    if (wasRefiningRef.current && !isRefining) {
      refineButtonRef.current?.focus();
    }
    wasRefiningRef.current = isRefining;
  }, [isRefining]);

  return (
    <Box
      width={`${dimensions.width}px`}
      height={`${dimensions.height}px`}
      overflow="hidden"
      position="relative"
    >
      <Box
        borderRadius="xl"
        display="flex"
        flexDirection="column"
        height="100%"
      >
        {/* Header */}
        <Flex
          align="center"
          justify="space-between"
           p="3"
           className="panel-header"
           backgroundColor="folio.paper"
           color="folio.ink"
           borderBottomColor="folio.line"
           flexShrink={0}
         >
           <Flex align="center" color="folio.accent" lineHeight="1">

            <LuMail size="1em" strokeWidth={1.6} style={{ marginRight: "8px" }} />
            <Text fontWeight="bold" lineHeight="1">{t("common.fab.patientLetter")}</Text>
          </Flex>

          <Flex align="center" gap="2">
            <Tooltip
              content={
                isDictateMode
                  ? t("letter.modeTooltipDictate")
                  : t("letter.modeTooltipDraft")
              }
              aria-label={t("letter.modeTooltipAria")}
            >
              <Box
                className="mode-slider"
                position="relative"
                display="inline-flex"
                backgroundColor="folio.paperAlt"
                border="1px solid"
                borderColor="folio.line"
                borderRadius="full"
                padding="2px"
                height="28px"
                boxSizing="border-box"
              >
                {/* Sliding thumb behind the active mode icon. The cells are
                    plain buttons on a fixed 26px grid so the thumb tracks the
                    active mode exactly (IconButton would absolutely position
                    its child and collapse the cells). */}
                <Box
                  position="absolute"
                  top="2px"
                  left="2px"
                  width="26px"
                  height="22px"
                  borderRadius="full"
                  backgroundColor="folio.accent"
                  transform={
                    isDictateMode ? "translateX(26px)" : "translateX(0)"
                  }
                  transition="transform 180ms ease"
                />
                <Box
                  as="button"
                  aria-label={t("letter.modeDraft")}
                  aria-pressed={!isDictateMode}
                  onClick={() => setLetterMode("draft")}
                  width="26px"
                  height="22px"
                  flexShrink={0}
                  display="inline-flex"
                  alignItems="center"
                  justifyContent="center"
                  position="relative"
                  zIndex={1}
                  border="none"
                  background="transparent"
                  cursor="pointer"
                  color={isDictateMode ? "folio.muted" : "folio.accentInk"}
                  transition="color 160ms ease"
                >
                  <LuWandSparkles size={13} strokeWidth={1.6} />
                </Box>
                <Box
                  as="button"
                  aria-label={t("scribe.mode.dictate")}
                  aria-pressed={isDictateMode}
                  onClick={() => setLetterMode("dictate")}
                  width="26px"
                  height="22px"
                  flexShrink={0}
                  display="inline-flex"
                  alignItems="center"
                  justifyContent="center"
                  position="relative"
                  zIndex={1}
                  border="none"
                  background="transparent"
                  cursor="pointer"
                  color={isDictateMode ? "folio.accentInk" : "folio.muted"}
                  transition="color 160ms ease"
                >
                  <LuMic size={13} strokeWidth={1.6} />
                </Box>
              </Box>
            </Tooltip>
            <NativeSelect.Root size="sm" width="150px">
              <NativeSelect.Field
                aria-label={t("letter.templateLabel")}
                value={templateValue}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "custom") {
                    selectTemplate("custom");
                    return;
                  }
                  const template = letterTemplates.find(
                    (tpl) => String(tpl.id) === value,
                  );
                  if (template) selectTemplate(template);
                }}
                disabled={isDictateMode}
                height="28px"
                lineHeight="1"
                fontSize="xs"
                borderColor="folio.line"
                backgroundColor="folio.canvas"
                color="folio.ink"
              >
                {isDictateMode ? (
                  <option value="dictated">{t("letter.modeDictated")}</option>
                ) : (
                  <>
                    {templateValue === "" && (
                      <option value="" disabled>
                        {t("letter.templatePlaceholder")}
                      </option>
                    )}
                    {templateOptions.map((template) => (
                      <option key={template.id} value={String(template.id)}>
                        {template.name}
                      </option>
                    ))}
                    <option value="custom">
                      {t("settings.templates.badgeCustom")}
                    </option>
                  </>
                )}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Flex>
        </Flex>

        {/* Content Area - Now a Flex Column */}
        <Box flex="1" display="flex" flexDirection="column" overflow="hidden">
          {/* Letter Editor Wrapper - Takes flexible space */}
          <Box flex="1" overflow="hidden" minHeight="0">
            <LetterEditor
              finalCorrespondence={finalCorrespondence}
              onLetterChange={(value) => {
                setFinalCorrespondence(value);
                setIsModified(true);
              }}
              setIsRefining={setIsRefining}
              loading={letterLoading}
              isRefining={isRefining}
              refineButtonRef={refineButtonRef}
              textareaRef={textareaRef}
              dictationWidget={
                isDictateMode ? (
                  <DictationWidget
                    patient={patient}
                    setFinalCorrespondence={setFinalCorrespondence}
                    letterTemplates={letterTemplates}
                    setIsRefining={setIsRefining}
                    setLoading={setLoading}
                    isDisabled={letterLoading}
                  />
                ) : null
              }
            />
          </Box>

          {!isDictateMode && selectedTemplate === "custom" && (
            <Box px="3" pt="1" pb="2" flexShrink={0}>
              <CustomInstructionsInput
                additionalInstructions={additionalInstructions}
                setAdditionalInstructions={setAdditionalInstructions}
              />
            </Box>
          )}
        </Box>

        {isRefining && (
          <RefinementPanel
            refinementInput={refinementInput}
            setRefinementInput={setRefinementInput}
            handleRefinement={handleRefinement}
            loading={letterLoading}
            setIsRefining={setIsRefining}
          />
        )}

        {/* Footer */}
        <Box p="4" flexShrink={0} borderTopWidth="1px" borderTopColor="folio.line">
          <PanelFooterActions
            handleGenerateLetter={handleGenerateLetterClick}
            handleCopy={handleCopy}
            handleSave={handleSaveLetter}
            recentlyCopied={recentlyCopied}
            saveState={saveState}
            letterLoading={letterLoading}
            additionalInstructions={additionalInstructions}
          />
        </Box>
      </Box>
      {/* Resizer */}
      <Box
        ref={resizerRef}
        position="absolute"
        top="0"
        left="0"
        width="20px"
        height="20px"
        bg="transparent"
        cursor="nwse-resize"
        onMouseDown={handleMouseDown}
      />
    </Box>
  );
};

export default LetterPanel;
