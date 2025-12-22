import React, { useEffect, useRef } from "react";
import {
  Box,
  Flex,
  IconButton,
  Textarea,
  Tooltip,
  Spinner,
} from "@chakra-ui/react";
import { EditIcon } from "@chakra-ui/icons";

const LetterEditor = ({
  finalCorrespondence,
  onLetterChange,
  setIsRefining,
  loading,
  isRefining,
  textareaRef,
  // autoResizeTextarea, // Removed prop
  refinementPanel,
  dictationWidget,
}) => {
  // Removed useEffect related to autoResizeTextarea

  return (
    // This outer Box needs height="100%" if its parent relies on it
    // Alternatively, if LetterPanel uses flex, this Box might need flex="1"
    // Assuming LetterPanel gives this component a defined area, height="100%" is a good start.
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
          borderRadius="sm"
          // Add a subtle background to obscure content slightly better
          bg={loading ? "rgba(255, 255, 255, 0.5)" : "transparent"}
          backdropFilter={loading ? "blur(1px)" : "none"} // Optional: nicer blur
        >
          <Spinner size="xl" />
        </Flex>
      )}
      <Box
        // Make this a flex container that takes full height
        display="flex"
        flexDirection="column"
        height="100%"
        maxHeight="100%" // Add this
        overflow="hidden"
        borderRadius="sm"
        className="floating-main"
        // Apply blur/opacity directly here if preferred over overlay style
        filter={loading ? "blur(0.4px)" : "none"}
        opacity={loading ? 0.6 : 1}
        transition="opacity 0.2s ease-in-out, filter 0.2s ease-in-out"
      >
        <Textarea
          placeholder="Write your letter here..."
          value={finalCorrespondence || "No letter attached to encounter"}
          onChange={(e) => {
            onLetterChange(e.target.value);
            // autoResizeTextarea(); // Removed call
          }}
          // Make Textarea the flexible item, taking up remaining space
          flex="1"
          minHeight="0"
          style={{
            color: loading ? "rgba(0, 0, 0, 0.4)" : "inherit",
            transition: "color 0.2s ease-in-out",
            overflow: "auto !important",
          }}
          className="textarea-style letter-editor-textarea"
          ref={textareaRef}
          isDisabled={loading}
        />
        {/* Tooltip and IconButton remain largely the same */}
        {/* They are absolutely positioned relative to the floating-main Box */}
        <Tooltip label="Refine letter" placement="left" isDisabled={loading}>
          <IconButton
            icon={<EditIcon />}
            position="absolute"
            bottom={4}
            width="40px"
            height="40px"
            right={4}
            sx={{
              opacity: 1, // Opacity is handled by parent now
              zIndex: 2,
              transition: "transform 0.2s",
              aspectRatio: "1/1",
              pointerEvents: loading ? "none" : "auto",
              "&:hover": !loading && {
                transform: "scale(1.1)",
              },
            }}
            className="refinement-fab"
            onClick={() => !loading && setIsRefining(true)} // Prevent click when loading
            aria-label="Refine letter"
            isDisabled={loading}
          />
        </Tooltip>
        {dictationWidget}
      </Box>
      {/* refinementPanel is outside the scrolling area, which is correct */}
      {isRefining && refinementPanel}
    </Box>
  );
};

export default LetterEditor;
