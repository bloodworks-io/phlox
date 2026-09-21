import React, {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
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
    const arrowRef = useRef(null);
    const [hasMeasured, setHasMeasured] = useState(false);
    const [minPanelHeight, setMinPanelHeight] = useState("auto");
    // Delayed unmount so the close transition can play.
    const [shouldRender, setShouldRender] = useState(isOpen);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            setIsClosing(false);
            return undefined;
        }
        setIsClosing(true);
        const t = setTimeout(() => {
            setShouldRender(false);
            setIsClosing(false);
        }, 180);
        return () => clearTimeout(t);
    }, [isOpen]);

    useLayoutEffect(() => {
        if (!shouldRender || !showArrow || !triggerId) return undefined;

        const updateArrowPosition = () => {
            const triggerEl = document.getElementById(triggerId);
            const arrowEl = arrowRef.current;
            if (!triggerEl || !panelRef.current || !arrowEl) return;
            const triggerRect = triggerEl.getBoundingClientRect();
            const panelRect = panelRef.current.getBoundingClientRect();

            if (
                position === "left-of-fab" ||
                position === "left-of-fab-grow-down"
            ) {
                const menuEl = triggerEl.closest(".floating-action-menu");
                if (menuEl) {
                    setMinPanelHeight(
                        `${menuEl.getBoundingClientRect().height}px`,
                    );
                }
                arrowEl.style.left = "";
                arrowEl.style.top = `${triggerRect.top + triggerRect.height / 2 - panelRect.top}px`;
            } else if (
                position === "bottom-center" ||
                position === "above-transcript-button"
            ) {
                arrowEl.style.top = "";
                arrowEl.style.left = `${triggerRect.left + triggerRect.width / 2 - panelRect.left}px`;
            }
            setHasMeasured(true);
        };

        updateArrowPosition();
        window.addEventListener("resize", updateArrowPosition);

        const onAnimationEnd = () => updateArrowPosition();
        const onTransitionEnd = (e) => {
            if (e.propertyName === "transform") updateArrowPosition();
        };
        const panel = panelRef.current;
        panel.addEventListener("animationend", onAnimationEnd);
        panel.addEventListener("transitionend", onTransitionEnd);
        let resizeObserver;
        if (typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(() => updateArrowPosition());
            resizeObserver.observe(panel);
        }

        return () => {
            window.removeEventListener("resize", updateArrowPosition);
            panel.removeEventListener("animationend", onAnimationEnd);
            panel.removeEventListener("transitionend", onTransitionEnd);
            resizeObserver?.disconnect();
        };
    }, [shouldRender, showArrow, triggerId, position]);

    if (!shouldRender) return null;

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

    // Fade/shrink on close, composing with each position's base transform
    // so centered panels don't jump while animating out.
    const closeStyle = isClosing
        ? {
              opacity: 0,
              transform: positionStyles.transform
                  ? `${positionStyles.transform} scale(0.95)`
                  : "scale(0.95)",
          }
        : undefined;

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
            style={closeStyle}
            transition="transform 0.18s ease-in, opacity 0.18s ease-in"
            width={width}
            height={height}
            minHeight={minPanelHeight}
            maxWidth={maxWidth}
            maxHeight={maxHeight}
            zIndex={zIndex}
            pointerEvents={isOpen ? "auto" : "none"}
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
                {showArrow &&
                    (position === "left-of-fab" ||
                        position === "left-of-fab-grow-down") && (
                    <Box
                        ref={arrowRef}
                        position="absolute"
                        right="-12px"
                        visibility={hasMeasured ? "visible" : "hidden"}
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
                            ref={arrowRef}
                            position="absolute"
                            bottom="-15px"
                            visibility={hasMeasured ? "visible" : "hidden"}
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
