import React, { useEffect, useRef, useState } from "react";
import { Box, Text, HStack } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { FaStop, FaBolt, FaChevronUp, FaChevronDown } from "react-icons/fa";

import ArtifactCard from "../../common/ArtifactCard";
import FormFillArtifact from "../../pdf-forms/FormFillArtifact";

const ACTIVITY_COLORS = {
    info: "overlay0",
    edit: "blue.solid",
    command: "green.solid",
    artifact: "purple.solid",
};

const getStatusInfo = (status, agentState) => {
    switch (status) {
        case "connecting":
            return { label: "Connecting…", color: "overlay0", pulse: true };
        case "stopping":
            return { label: "Wrapping up…", color: "overlay0", pulse: false };
        case "tidy":
            return {
                label: agentState === "working" ? "Applying…" : "Tidy mode",
                color: "successButton",
                pulse: agentState === "working",
            };
        case "live":
            return agentState === "working"
                ? { label: "Thinking…", color: "secondaryButton", pulse: false }
                : { label: "Listening…", color: "accent", pulse: true };
        default:
            return { label: "Idle", color: "overlay0", pulse: false };
    }
};

const StatusDot = ({ color, pulse }) => (
    <Box
        w="7px"
        h="7px"
        borderRadius="full"
        bg={color}
        flexShrink={0}
        className={pulse ? "live-bolt-pulse" : undefined}
    />
);

const slimScrollbarCss = {
    "&::-webkit-scrollbar": { width: "4px" },
    "&::-webkit-scrollbar-track": { background: "transparent" },
    "&::-webkit-scrollbar-thumb": {
        background: "var(--chakra-colors-scrollbar-thumb)",
        borderRadius: "24px",
    },
};

/* ------------------------------------------------------------------ */
/* Minimised: one-line live bar docked above the scribe pill.          */
/* ------------------------------------------------------------------ */
const LiveBar = ({ status, agentState, transcripts, onExpand }) => {
    const info = getStatusInfo(status, agentState);
    const latest = transcripts[transcripts.length - 1];

    return (
        <Box
            className="live-bar anim-fade-slide-up"
            position="fixed"
            bottom="85px"
            left="50%"
            transform="translateX(-50%)"
            zIndex="1060"
            display="flex"
            alignItems="center"
            gap={2.5}
            pl={4}
            pr={2}
            py={1.5}
            cursor="pointer"
            maxWidth="min(560px, calc(100vw - 48px))"
            onClick={onExpand}
        >
            <StatusDot color={info.color} pulse={info.pulse} />
            <Text fontSize="xs" fontWeight="600" flexShrink={0}>
                {info.label}
            </Text>
            <Box w="1px" h="14px" bg="surface" flexShrink={0} />
            <Text fontSize="xs" color="fg.subtle" isTruncated flex="1">
                {latest || "Waiting for speech…"}
            </Text>
            <Tooltip content="Expand" showArrow positioning={{ placement: "top" }}>
                <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    w="22px"
                    h="22px"
                    borderRadius="full"
                    color="fg.subtle"
                    cursor="pointer"
                    transition="all 0.2s ease"
                    _hover={{ bg: "surface", transform: "scale(1.05)" }}
                    asChild>
                    <button aria-label="Expand live panel">
                        <FaChevronUp size="10px" />
                    </button>
                </Box>
            </Tooltip>
        </Box>
    );
};

/* ------------------------------------------------------------------ */
/* Expanded: draggable mini-window.                                    */
/* ------------------------------------------------------------------ */
const DRAG_STORAGE_KEY = "phlox:live-panel-pos";
const PANEL_WIDTH = 340;
const PANEL_MARGIN = 8;
const TOP_MARGIN = 34; // clear the traffic-light drag region

const clampPosition = (x, y) => ({
    x: Math.min(
        Math.max(x, PANEL_MARGIN),
        Math.max(PANEL_MARGIN, window.innerWidth - PANEL_WIDTH - PANEL_MARGIN),
    ),
    y: Math.min(
        Math.max(y, TOP_MARGIN),
        Math.max(TOP_MARGIN, window.innerHeight - 80),
    ),
});

const readSavedPosition = () => {
    try {
        const raw = window.localStorage.getItem(DRAG_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed &&
            Number.isFinite(parsed.x) &&
            Number.isFinite(parsed.y)
            ? parsed
            : null;
    } catch {
        return null;
    }
};

const LiveWindow = ({
    status,
    agentState,
    transcripts,
    statuses,
    artifacts,
    onStop,
    onMinimize,
}) => {
    const info = getStatusInfo(status, agentState);
    const isStopping = status === "stopping";
    const isRunning = status === "live" || status === "tidy";

    const [position, setPosition] = useState(() => {
        const initial =
            readSavedPosition() ??
            { x: window.innerWidth - 110 - PANEL_WIDTH, y: 120 };
        return clampPosition(initial.x, initial.y);
    });
    const [isClosing, setIsClosing] = useState(false);
    const dragRef = useRef(null);
    const transcriptEndRef = useRef(null);

    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ block: "end" });
    }, [transcripts.length]);

    // Keep the parked panel inside the window on resize.
    useEffect(() => {
        const onResize = () =>
            setPosition((prev) => clampPosition(prev.x, prev.y));
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const handlePointerDown = (e) => {
        if (e.button !== 0 || e.target.closest("button")) return;
        dragRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            origX: position.x,
            origY: position.y,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;
        setPosition(
            clampPosition(
                drag.origX + e.clientX - drag.startX,
                drag.origY + e.clientY - drag.startY,
            ),
        );
    };

    const handlePointerUp = (e) => {
        if (!dragRef.current || dragRef.current.pointerId !== e.pointerId)
            return;
        dragRef.current = null;
        try {
            window.localStorage.setItem(
                DRAG_STORAGE_KEY,
                JSON.stringify(position),
            );
        } catch {
            // non-fatal: just lose the parked position
        }
    };

    const handleMinimize = () => {
        if (isClosing) return;
        setIsClosing(true);
        setTimeout(() => {
            setIsClosing(false);
            onMinimize?.();
        }, 220);
    };

    return (
        <Box
            position="fixed"
            left={`${position.x}px`}
            top={`${position.y}px`}
            width={`${PANEL_WIDTH}px`}
            maxHeight="65vh"
            zIndex="1060"
            display="flex"
            flexDirection="column"
            pointerEvents={isClosing ? "none" : "auto"}
            style={
                isClosing
                    ? {
                          transform: "scale(0.55) translateY(120px)",
                          opacity: 0,
                      }
                    : undefined
            }
            transition="transform 0.22s ease-in, opacity 0.22s ease-in"
        >
            <Box
                className="anim-emerge-spring"
                width="100%"
                maxHeight="65vh"
                display="flex"
                flexDirection="column"
            >
                <Box
                    className="floating-panel"
                    display="flex"
                    flexDirection="column"
                    overflow="hidden"
                    maxHeight="65vh"
                >
                    {/* Header — drag handle */}
                    <Box
                        display="flex"
                        alignItems="center"
                        gap={2}
                        flexShrink={0}
                        px={3}
                        py={2.5}
                        borderBottomWidth="1px"
                        borderColor="surface"
                        cursor="grab"
                        userSelect="none"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        _active={{ cursor: "grabbing" }}
                    >
                        <Box
                            w="24px"
                            h="24px"
                            borderRadius="full"
                            border="1px solid"
                            borderColor="accent"
                            color="accent"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            flexShrink={0}
                            className={
                                isRunning ? "live-bolt-pulse" : undefined
                            }
                        >
                            <FaBolt size="10px" />
                        </Box>
                        <Text fontWeight="bold" fontSize="sm" flexShrink={0}>
                            Live Scribe
                        </Text>
                        <HStack gap={1.5} ml={1} flexShrink={0}>
                            <StatusDot
                                color={info.color}
                                pulse={info.pulse}
                            />
                            <Text fontSize="xs" color="fg.subtle">
                                {info.label}
                            </Text>
                        </HStack>
                        <Box flex="1" />
                        <Tooltip
                            content="Minimize to live bar"
                            showArrow
                            positioning={{ placement: "top" }}
                        >
                            <Box
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                w="26px"
                                h="26px"
                                borderRadius="full"
                                border="1px solid"
                                borderColor="surface"
                                color="fg.subtle"
                                cursor="pointer"
                                transition="all 0.2s ease"
                                _hover={{
                                    bg: "surface",
                                    transform: "scale(1.05)",
                                }}
                                asChild>
                                <button
                                    aria-label="Minimize live panel"
                                    onClick={handleMinimize}>
                                    <FaChevronDown size="10px" />
                                </button>
                            </Box>
                        </Tooltip>
                        <Tooltip
                            content={isStopping ? "Wrapping up…" : "End session"}
                            showArrow
                            positioning={{ placement: "top" }}
                        >
                            <Box
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                w="26px"
                                h="26px"
                                borderRadius="full"
                                border="1px solid"
                                borderColor="dangerButton"
                                color="dangerButton"
                                cursor={isStopping ? "default" : "pointer"}
                                opacity={isStopping ? 0.5 : 1}
                                pointerEvents={isStopping ? "none" : "auto"}
                                transition="all 0.2s ease"
                                _hover={{
                                    bg: "dangerButton",
                                    borderColor: "dangerButton",
                                    color: "invertedText",
                                    transform: "scale(1.05)",
                                }}
                                asChild>
                                <button
                                    aria-label="End live session"
                                    onClick={onStop}>
                                    <FaStop size="10px" />
                                </button>
                            </Box>
                        </Tooltip>
                    </Box>

                    {/* Body */}
                    <Box
                        p={3}
                        flex="1"
                        minHeight="0"
                        display="flex"
                        flexDirection="column"
                        gap={3}
                    >
                        {/* Live transcript — open caption feed on the glass */}
                        <Box
                            flex="1"
                            minHeight="80px"
                            overflowY="auto"
                            pr={1}
                            css={slimScrollbarCss}
                        >
                            {transcripts.length === 0 ? (
                                <Box
                                    flex="1"
                                    minHeight="80px"
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="center"
                                >
                                    <Text
                                        fontSize="xs"
                                        fontStyle="italic"
                                        color="overlay0"
                                    >
                                        {status === "tidy"
                                            ? "Speak a command to edit the note…"
                                            : "Waiting for speech…"}
                                    </Text>
                                </Box>
                            ) : (
                                transcripts.map((text, index) => {
                                    const isRecent =
                                        index >= transcripts.length - 2;
                                    return (
                                        <Text
                                            key={index}
                                            mb={1.5}
                                            fontSize="xs"
                                            lineHeight="1.5"
                                            color={
                                                isRecent
                                                    ? "fg.muted"
                                                    : "fg.subtle"
                                            }
                                        >
                                            {text}
                                        </Text>
                                    );
                                })
                            )}
                            <div ref={transcriptEndRef} />
                        </Box>

                        {/* Agent activity */}
                        {statuses.length > 0 && (
                            <Box flexShrink={0}>
                                <Text
                                    className="live-section-label"
                                    mb={2}
                                >
                                    Activity
                                </Text>
                                <Box
                                    maxHeight="110px"
                                    overflowY="auto"
                                    pr={1}
                                    css={{
                                        ...slimScrollbarCss,
                                        maskImage:
                                            "linear-gradient(to bottom, transparent 0, black 16px)",
                                        WebkitMaskImage:
                                            "linear-gradient(to bottom, transparent 0, black 16px)",
                                    }}
                                >
                                    {statuses.map((item) => (
                                        <HStack
                                            key={item.id}
                                            gap={2}
                                            alignItems="flex-start"
                                            mb={1}
                                        >
                                            <Box
                                                mt="6px"
                                                w="5px"
                                                h="5px"
                                                borderRadius="full"
                                                flexShrink={0}
                                                bg={
                                                    ACTIVITY_COLORS[
                                                        item.kind
                                                    ] || "overlay0"
                                                }
                                            />
                                            <Text
                                                fontSize="xs"
                                                color="fg.subtle"
                                            >
                                                {item.content}
                                            </Text>
                                        </HStack>
                                    ))}
                                </Box>
                            </Box>
                        )}

                        {/* Staged artifacts */}
                        {artifacts.length > 0 && (
                            <Box flexShrink={0}>
                                <Text
                                    className="live-section-label"
                                    mb={2}
                                >
                                    Prepared for review · {artifacts.length}
                                </Text>
                                {artifacts.map((artifact, index) =>
                                    artifact.type === "form_fill" ? (
                                        <FormFillArtifact
                                            key={`form-${index}`}
                                            artifact={artifact}
                                        />
                                    ) : (
                                        <ArtifactCard
                                            key={`file-${index}`}
                                            artifact={artifact}
                                        />
                                    ),
                                )}
                            </Box>
                        )}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

/**
 * Live scribe PiP surface. A session shows as a one-line bar above the
 * scribe pill; expanding grows it into a draggable mini-window that
 * coexists with the other floating panels (it is not part of the
 * mutually-exclusive panel system).
 */
const AgentPanel = ({
    status,
    agentState,
    transcripts,
    statuses,
    artifacts,
    onStop,
    view = "bar",
    onExpand,
    onMinimize,
    hideBar = false,
}) => {
    const isActive = ["connecting", "live", "tidy", "stopping"].includes(
        status,
    );
    if (!isActive) return null;

    if (view === "window") {
        return (
            <LiveWindow
                status={status}
                agentState={agentState}
                transcripts={transcripts}
                statuses={statuses}
                artifacts={artifacts}
                onStop={onStop}
                onMinimize={onMinimize}
            />
        );
    }
    if (hideBar) return null;
    return (
        <LiveBar
            status={status}
            agentState={agentState}
            transcripts={transcripts}
            onExpand={onExpand}
        />
    );
};

export default AgentPanel;
