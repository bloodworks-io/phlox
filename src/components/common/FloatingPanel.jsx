import React, { useEffect, useRef, useState } from "react";
import { Box, useColorMode } from "@chakra-ui/react";
import styled from "@emotion/styled";
import { emergeFromButton } from "../../theme/animations";
import { colors } from "../../theme/colors";

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
 * @param {string} triggerId - ID of the element that triggered the panel, used to align the arrow
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
  triggerId,
  width,
  height,
  maxWidth,
  maxHeight,
  zIndex = "1060",
}) => {
  const { colorMode } = useColorMode();
  const panelRef = useRef(null);
  const [arrowTop, setArrowTop] = useState("50%");
  const [arrowLeft, setArrowLeft] = useState("50%");
  const [minPanelHeight, setMinPanelHeight] = useState("auto");

  useEffect(() => {
    if (!isOpen || !showArrow || !triggerId) {
      setArrowTop("50%");
      setArrowLeft("50%");
      setMinPanelHeight("auto");
      return;
    }

    const updateArrowPosition = () => {
      const triggerEl = document.getElementById(triggerId);
      if (triggerEl) {
        const triggerRect = triggerEl.getBoundingClientRect();

        if (position === "left-of-fab") {
          const menuEl = triggerEl.closest(".floating-action-menu");
          if (menuEl) {
            const menuRect = menuEl.getBoundingClientRect();
            setMinPanelHeight(`${menuRect.height}px`);

            const offset =
              triggerRect.top +
              triggerRect.height / 2 -
              (menuRect.top + menuRect.height / 2);
            setArrowTop(`calc(50% + ${offset}px)`);
          }
        } else if (
          position === "bottom-center" ||
          position === "above-transcript-button"
        ) {
          const menuEl = triggerEl.closest(".pill-box-scribe") || triggerEl;
          if (menuEl) {
            const menuRect = menuEl.getBoundingClientRect();
            const offset =
              triggerRect.left +
              triggerRect.width / 2 -
              (menuRect.left + menuRect.width / 2);
            setArrowLeft(`calc(50% + ${offset}px)`);
          }
        }
      }
    };

    const frameId = requestAnimationFrame(updateArrowPosition);
    window.addEventListener("resize", updateArrowPosition);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateArrowPosition);
    };
  }, [isOpen, showArrow, triggerId, position, height, width]);

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

  // Get colors for the arrow to match the panel
  const bgColor =
    colorMode === "light" ? colors.light.secondary : colors.dark.secondary;
  const borderColor =
    colorMode === "light" ? colors.light.surface : colors.dark.surface;

  return (
    <Box
      ref={panelRef}
      position="fixed"
      {...positionStyles}
      width={width}
      height={height}
      minHeight={minPanelHeight}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      zIndex={zIndex}
      pointerEvents="auto"
      display="flex"
      flexDirection="column"
    >
      <AnimatedBox
        width="100%"
        flex="1"
        maxWidth={maxWidth}
        maxHeight={maxHeight}
        position="relative"
      >
        <Box
          width="100%"
          height="100%"
          className="floating-panel"
          overflow="hidden"
        >
          {children}
        </Box>

        {/* Isthmus / Arrow */}
        {showArrow && position === "left-of-fab" && (
          <Box
            as="svg"
            position="absolute"
            right="-12px"
            top={arrowTop}
            transform="translateY(-50%)"
            width="13px"
            height="24px"
            viewBox="0 0 14 24"
            zIndex="1"
          >
            <path
              d="M 0 0.5 Q 7 8 14 0.5 L 14 23.5 Q 7 16 0 23.5 Z"
              fill={bgColor}
            />
            <path
              d="M 0 0.5 Q 7 8 14 0.5"
              fill="none"
              stroke={borderColor}
              strokeWidth="1"
            />
            <path
              d="M 0 23.5 Q 7 16 14 23.5"
              fill="none"
              stroke={borderColor}
              strokeWidth="1"
            />
          </Box>
        )}
        {showArrow &&
          (position === "bottom-center" ||
            position === "above-transcript-button") && (
            <Box
              as="svg"
              position="absolute"
              bottom="-15px"
              left={arrowLeft}
              transform="translateX(-50%)"
              width="24px"
              height="16px"
              viewBox="0 0 24 16"
              zIndex="1"
            >
              <path
                d="M 0.5 0 Q 8 8 0.5 16 L 23.5 16 Q 16 8 23.5 0 Z"
                fill={bgColor}
              />
              <path
                d="M 0.5 0 Q 8 8 0.5 16"
                fill="none"
                stroke={borderColor}
                strokeWidth="1"
              />
              <path
                d="M 23.5 0 Q 16 8 23.5 16"
                fill="none"
                stroke={borderColor}
                strokeWidth="1"
              />
            </Box>
          )}
      </AnimatedBox>
    </Box>
  );
};

export default FloatingPanel;
