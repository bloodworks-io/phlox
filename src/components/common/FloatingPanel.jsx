import React, {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { useColorMode } from "../ui/color-mode";
import { Box } from "@chakra-ui/react";
import { folioColors } from "../../theme/colors";

const PANEL_CLOSE_MS = 160;

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
    const prefersReducedMotion = Boolean(
        window
            .matchMedia("(prefers-reduced-motion: reduce)")
            ?.matches,
    );
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
        }, PANEL_CLOSE_MS);
        return () => clearTimeout(t);
    }, [isOpen]);

    useLayoutEffect(() => {
        if (!shouldRender || !showArrow || !triggerId) return undefined;

        const triggerEl = document.getElementById(triggerId);
        const arrowEl = arrowRef.current;
        const panel = panelRef.current;
        if (!triggerEl || !panel || !arrowEl) return undefined;

        const updateArrowPosition = () => {
            const currentTrigger = document.getElementById(triggerId);
            const currentArrow = arrowRef.current;
            if (!currentTrigger || !panelRef.current || !currentArrow) return;
            const triggerRect = currentTrigger.getBoundingClientRect();
            const panelRect = panelRef.current.getBoundingClientRect();

            if (
                position === "left-of-fab" ||
                position === "left-of-fab-grow-down"
            ) {
                const menuEl = currentTrigger.closest(".floating-action-menu");
                if (menuEl) {
                    setMinPanelHeight(
                        `${menuEl.getBoundingClientRect().height}px`,
                    );
                }
                currentArrow.style.left = "";
                currentArrow.style.top = `${triggerRect.top + triggerRect.height / 2 - panelRect.top}px`;
            } else if (
                position === "bottom-center" ||
                position === "above-transcript-button"
            ) {
                currentArrow.style.top = "";
                currentArrow.style.left = `${triggerRect.left + triggerRect.width / 2 - panelRect.left}px`;
            }
            setHasMeasured(true);
        };

        updateArrowPosition();
        window.addEventListener("resize", updateArrowPosition);

        // One post-layout pass covers first-frame content/font shifts that
        // previously arrived incidentally through animation events.
        const animationFrameId = window.requestAnimationFrame(
            updateArrowPosition,
        );

        // Arrow position is derived from the panel, trigger, and rail layout
        // boxes. Observing those boxes keeps measurement independent of
        // entrance/close animation timing and correct under reduced motion.
        const observedElements = [panel, triggerEl];
        const menuEl = triggerEl.closest(".floating-action-menu");
        if (menuEl) observedElements.push(menuEl);

        let resizeObserver;
        if (typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(updateArrowPosition);
            for (const element of observedElements) {
                resizeObserver.observe(element);
            }
        }

        return () => {
            window.removeEventListener("resize", updateArrowPosition);
            window.cancelAnimationFrame(animationFrameId);
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

    // Opacity-only close animation. The base transform remains untouched so
    // centered panels and fixed positioning cannot shift during exit.
    const closeStyle = isClosing ? { opacity: 0 } : undefined;

    // The SVG arrow cannot consume Chakra semantic tokens directly.
    const bgColor =
        colorMode === "light" ? folioColors.light.paper : folioColors.dark.paper;
    const borderColor =
        colorMode === "light" ? folioColors.light.line : folioColors.dark.line;

    return (
        <Box
            ref={panelRef}
            position="fixed"
            {...positionStyles}
            style={closeStyle}
            transition={
                prefersReducedMotion
                    ? "none"
                    : `opacity ${PANEL_CLOSE_MS}ms ease-in`
            }
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
                className="anim-fade"
                css={{ animationDuration: `${PANEL_CLOSE_MS}ms` }}
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
                        aria-hidden="true"
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
                            aria-hidden="true"
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
