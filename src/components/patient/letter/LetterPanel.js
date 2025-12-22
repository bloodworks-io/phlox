import React from "react";
import { Box, Flex, VStack, Text, IconButton } from "@chakra-ui/react";
import { FaEnvelope } from "react-icons/fa";
import { CloseIcon } from "@chakra-ui/icons";

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
  return (
    <Box
      width={`${dimensions.width}px`}
      height={`${dimensions.height}px`}
      borderRadius="xl"
      boxShadow="md"
      overflow="hidden"
      position="relative"
      className="floating-panel"
      bg="white"
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
                <DictationWidget
                  patient={patient}
                  setFinalCorrespondence={setFinalCorrespondence}
                  letterTemplates={letterTemplates}
                  setIsRefining={setIsRefining}
                  setLoading={setLoading}
                  isDisabled={letterLoading}
                />
              }
            />
          </Box>

          {/* Template Selection Area - Fixed size below editor */}
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
