import React, { useEffect, useRef, useState } from "react";
import { useColorMode } from "../ui/color-mode";
import { Box } from "@chakra-ui/react";
import { colors } from "../../theme/colors";

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
            if (!triggerEl || !panelRef.current) return;
            const triggerRect = triggerEl.getBoundingClientRect();
            const panelRect = panelRef.current.getBoundingClientRect();

            if (position === "left-of-fab") {
                const menuEl = triggerEl.closest(".floating-action-menu");
                if (menuEl) {
                    setMinPanelHeight(
                        `${menuEl.getBoundingClientRect().height}px`,
                    );
                }
                setArrowTop(
                    `${triggerRect.top + triggerRect.height / 2 - panelRect.top}px`,
                );
            } else if (
                position === "bottom-center" ||
                position === "above-transcript-button"
            ) {
                setArrowLeft(
                    `${triggerRect.left + triggerRect.width / 2 - panelRect.left}px`,
                );
            }
        };

        const frameId = requestAnimationFrame(updateArrowPosition);
        window.addEventListener("resize", updateArrowPosition);
        let resizeObserver;
        if (panelRef.current && typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(() => updateArrowPosition());
            resizeObserver.observe(panelRef.current);
        }

        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener("resize", updateArrowPosition);
            resizeObserver?.disconnect();
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
            case "left-of-fab-grow-down":
                return {
                    right: "110px",
                    top: "calc(50% - 110px)",
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
            <Box
                className="anim-emerge-spring"
                width="100%"
                height="100%"
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
                        position="absolute"
                        right="-12px"
                        top={arrowTop}
                        transform="translateY(-50%)"
                        width="13px"
                        height="24px"
                        viewBox="4 0 6 24"
                        zIndex="1"
                        asChild
                    >
                        <svg>
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
                        </svg>
                    </Box>
                )}
                {showArrow &&
                    (position === "bottom-center" ||
                        position === "above-transcript-button") && (
                        <Box
                            position="absolute"
                            bottom="-15px"
                            left={arrowLeft}
                            transform="translateX(-50%)"
                            width="24px"
                            height="16px"
                            viewBox="0 0 24 16"
                            zIndex="1"
                            asChild
                        >
                            <svg>
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
                            </svg>
                        </Box>
                    )}
            </Box>
        </Box>
    );
};

export default FloatingPanel;
