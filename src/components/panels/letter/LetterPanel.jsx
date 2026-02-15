import React, { useState } from "react";
import {
  Box,
  Flex,
  Text,
  Select,
  Tooltip,
  useColorMode,
} from "@chakra-ui/react";
import { FaEnvelope, FaMicrophone, FaMagic } from "react-icons/fa";

import LetterEditor from "./LetterEditor";
import TemplateSelector from "./TemplateSelector";
import CustomInstructionsInput from "./CustomInstructionsInput";
import PanelFooterActions from "./PanelFooterActions";
import RefinementPanel from "./RefinementPanel";
import DictationWidget from "./DictationWidget";

const LetterPanel = ({
  patient,
  dimensions,
  resizerRef,
  handleMouseDown,
  onClose,
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
  // autoResizeTextarea, // We won't need this prop anymore
  recentlyCopied,
  saveState,
  handleCopy,
}) => {
  const [letterMode, setLetterMode] = useState("draft");
  const isDictateMode = letterMode === "dictate";
  const { colorMode } = useColorMode();

  return (
    <Box
      width={`${dimensions.width}px`}
      height={`${dimensions.height}px`}
      borderRadius="xl"
      overflow="hidden"
      position="relative"
      className="floating-panel"
      bg={colorMode === "light" ? "white" : "gray.800"}
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
          p="4"
          className="panel-header"
          flexShrink={0}
        >
          <Flex align="center">
            <FaEnvelope size="1em" style={{ marginRight: "8px" }} />
            <Text>Patient Letter</Text>
          </Flex>

          <Tooltip
            label={
              isDictateMode
                ? "Dictate: speak your letter and we'll turn it into a polished letter."
                : "Draft: choose a template and have AI draft the letter for you."
            }
            aria-label="Letter mode tooltip"
          >
            <Box>
              <Flex alignItems="center">
                {isDictateMode ? (
                  <FaMicrophone
                    style={{ marginRight: "8px" }}
                    className="pill-box-icons"
                  />
                ) : (
                  <FaMagic
                    style={{ marginRight: "8px" }}
                    className="pill-box-icons"
                  />
                )}
                <Select
                  value={letterMode}
                  onChange={(e) => setLetterMode(e.target.value)}
                  size="sm"
                  width={["110px", "140px", "160px"]}
                  className="input-style"
                >
                  <option value="draft">Draft</option>
                  <option value="dictate">Dictate</option>
                </Select>
              </Flex>
            </Box>
          </Tooltip>
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
              textareaRef={textareaRef}
              refinementPanel={
                <RefinementPanel
                  refinementInput={refinementInput}
                  setRefinementInput={setRefinementInput}
                  handleRefinement={handleRefinement}
                  loading={letterLoading}
                  setIsRefining={setIsRefining}
                />
              }
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

          {!isDictateMode && (
            <Box pt={2} flexShrink={0} className="template-selector">
              <TemplateSelector
                letterTemplates={letterTemplates}
                selectedTemplate={selectedTemplate}
                onTemplateSelect={selectTemplate}
              />
              {selectedTemplate === "custom" && (
                <Box pt={5}>
                  <CustomInstructionsInput
                    additionalInstructions={additionalInstructions}
                    setAdditionalInstructions={setAdditionalInstructions}
                  />
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* Footer */}
        <Box p="4" flexShrink={0}>
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
