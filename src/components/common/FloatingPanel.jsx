import React from "react";
import { Box, useColorMode } from "@chakra-ui/react";
import styled from "@emotion/styled";
import { emergeFromButton } from "../../theme/animations";

// Animation only (no positioning transform)
const AnimatedBox = styled(Box)`
  animation: ${emergeFromButton} 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)
    forwards;
`;

/**
 * Shared floating panel wrapper with consistent positioning and optional speech bubble arrow.
 * Used by all floating panels (Chat, Letter, Document, etc.)
 *
 * @param {boolean} isOpen - Whether the panel is visible
 * @param {string} position - "left-of-fab" (right side) or "bottom-center" (above ScribePillBox)
 * @param {boolean} showArrow - Whether to show speech bubble arrow pointing to trigger
 * @param {string} width - Panel width
 * @param {string} height - Panel height
 * @param {string} maxWidth - Maximum panel width
 * @param {string} maxHeight - Maximum panel height
 * @param {string|number} zIndex - Z-index for stacking
 */
const FloatingPanel = ({
  children,
  isOpen,
  position = "left-of-fab",
  showArrow = true,
  width,
  height,
  maxWidth,
  maxHeight,
  zIndex = "1040",
}) => {
  const { colorMode } = useColorMode();

  if (!isOpen) return null;

  const getPositionStyles = () => {
    switch (position) {
      case "left-of-fab":
        return {
          right: "110px",
          top: "50%",
          transform: "translateY(-50%)",
        };
      case "above-transcript-button":
        return {
          bottom: "85px",
          right: "calc(50% - 90px)",
        };
      case "bottom-center":
      default:
        return {
          bottom: "100px",
          left: "50%",
          transform: "translateX(-50%)",
        };
    }
  };

  const positionStyles = getPositionStyles();
  const arrowColor = colorMode === "light" ? "white" : "gray.800";

  return (
    <Box
      position="fixed"
      {...positionStyles}
      width={width}
      height={height}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      zIndex={zIndex}
      pointerEvents="auto"
    >
      <AnimatedBox
        width="100%"
        height="100%"
        maxWidth={maxWidth}
        maxHeight={maxHeight}
        className="floating-panel"
      >
        {children}
      </AnimatedBox>
    </Box>
  );
};

export default FloatingPanel;
