import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Text, HStack } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { FaChevronUp, FaChevronDown, FaTimes } from "react-icons/fa";

import { AgentSymbol, StatusDot } from "./agentVisuals";
import { getStatusInfo, getContextLine } from "./agentStatus";
import { ActivityList } from "./ActivityList";
import { ArtifactRow } from "./ArtifactRow";
import { TranscriptSection } from "./TranscriptSection";
import { ErrorBlock } from "./ErrorBlock";

const DRAG_STORAGE_KEY = "phlox:live-panel-pos";
const PANEL_WIDTH = 340;
const PANEL_MARGIN = 8;
const TOP_MARGIN = 34; // clear the traffic-light drag region
const PANEL_MAX_HEIGHT_VH = 0.65;

const clampPosition = (x, y, panelHeight) => {
    const maxHeight = Math.min(
        panelHeight ?? window.innerHeight * PANEL_MAX_HEIGHT_VH,
        window.innerHeight * PANEL_MAX_HEIGHT_VH,
    );
    return {
        x: Math.min(
            Math.max(x, PANEL_MARGIN),
            Math.max(
                PANEL_MARGIN,
                window.innerWidth - PANEL_WIDTH - PANEL_MARGIN,
            ),
        ),
        y: Math.min(
            Math.max(y, TOP_MARGIN),
            Math.max(TOP_MARGIN, window.innerHeight - maxHeight - PANEL_MARGIN),
        ),
    };
};

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


export const LiveWindow = ({
    status,
    agentState,
    transcripts,
    statuses,
    artifacts,
    lastError,
    onMinimize,
    onOpenLetter,
    onRetry,
    onDismissReview,
}) => {
    const info = getStatusInfo(status, agentState);
    const isReview = status === "review";
    const isError = status === "error";

    const [position, setPosition] = useState(() => {
        const initial =
            readSavedPosition() ??
            { x: window.innerWidth - 110 - PANEL_WIDTH, y: 120 };
        return clampPosition(initial.x, initial.y, null);
    });
    const [isClosing, setIsClosing] = useState(false);
    const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
    const dragRef = useRef(null);
    const panelRef = useRef(null);

    const panelHeight = useCallback(
        () => panelRef.current?.offsetHeight ?? null,
        [],
    );

    useEffect(() => {
        const onResize = () =>
            setPosition((prev) => clampPosition(prev.x, prev.y, panelHeight()));
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [panelHeight]);

    useEffect(() => {
        setPosition((prev) =>
            clampPosition(prev.x, prev.y, panelHeight()),
        );
    }, [
        statuses.length,
        artifacts.length,
        isTranscriptOpen,
        isError,
        panelHeight,
    ]);

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
                panelHeight(),
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
                    ref={panelRef}
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
                        gap={2.5}
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
                        <AgentSymbol pulse={info.pulse} />
                        <Box flex="1" minW="0">
                            <Text
                                fontWeight="semibold"
                                fontSize="sm"
                                lineHeight="1.3"
                            >
                                Live agent
                            </Text>
                            <HStack gap={1.5} mt="2px">
                                <StatusDot
                                    color={info.color}
                                    pulse={info.pulse}
                                />
                                <Text
                                    fontSize="xs"
                                    color="fg.subtle"
                                    truncate
                                    minW="0"
                                >
                                    {info.label}
                                </Text>
                            </HStack>
                        </Box>
                        {isReview && (
                            <Tooltip
                                content="Close review"
                                showArrow
                                positioning={{ placement: "top" }}
                            >
                                <Box
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="center"
                                    w="32px"
                                    h="32px"
                                    borderRadius="full"
                                    color="fg.subtle"
                                    cursor="pointer"
                                    flexShrink={0}
                                    transition="all 0.2s ease"
                                    _hover={{
                                        bg: "surface",
                                        color: "fg.muted",
                                    }}
                                    asChild
                                >
                                    <button
                                        aria-label="Close session review"
                                        onClick={onDismissReview}
                                    >
                                        <FaTimes size="11px" />
                                    </button>
                                </Box>
                            </Tooltip>
                        )}
                        <Tooltip
                            content="Minimize to live bar"
                            showArrow
                            positioning={{ placement: "top" }}
                        >
                            <Box
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                w="32px"
                                h="32px"
                                borderRadius="full"
                                color="fg.subtle"
                                cursor="pointer"
                                flexShrink={0}
                                transition="all 0.2s ease"
                                _hover={{
                                    bg: "surface",
                                    color: "fg.muted",
                                }}
                                asChild
                            >
                                <button
                                    aria-label="Minimize live panel"
                                    onClick={handleMinimize}
                                >
                                    <FaChevronDown size="11px" />
                                </button>
                            </Box>
                        </Tooltip>
                    </Box>

                    {/* Body — what changed and what is ready come first. */}
                    <Box
                        className="slim-scrollbar"
                        p={3}
                        flex="1"
                        minHeight="0"
                        overflowY="auto"
                        display="flex"
                        flexDirection="column"
                        gap={3}
                    >
                        {isError ? (
                            <ErrorBlock
                                message={lastError}
                                onRetry={onRetry}
                                onDismiss={onDismissReview}
                            />
                        ) : (
                            <>
                                <Box flexShrink={0}>
                                    <Text
                                        className="live-section-label"
                                        mb={2}
                                    >
                                        Latest activity
                                    </Text>
                                    {statuses.length === 0 ? (
                                        <Text
                                            fontSize="xs"
                                            fontStyle="italic"
                                            color="overlay0"
                                        >
                                            {status === "connecting"
                                                ? "Loading live agent context…"
                                                : "Waiting for updates…"}
                                        </Text>
                                    ) : (
                                        <ActivityList statuses={statuses} />
                                    )}
                                </Box>

                                {artifacts.length > 0 && (
                                    <Box flexShrink={0}>
                                        <Text
                                            className="live-section-label"
                                            mb={2}
                                        >
                                            Prepared for review ·{" "}
                                            {artifacts.length}
                                        </Text>
                                        {artifacts.map((artifact, index) => (
                                            <ArtifactRow
                                                key={`${artifact.type}-${index}-${artifact.content?.length ?? 0}-${artifact.saved}`}
                                                artifact={artifact}
                                                onOpenLetter={onOpenLetter}
                                            />
                                        ))}
                                    </Box>
                                )}
                            </>
                        )}
                    </Box>

                    {isTranscriptOpen && (
                        <Box
                            id="live-agent-transcript"
                            className="slim-scrollbar"
                            px={3}
                            pb={3}
                            flexShrink={0}
                            maxHeight="190px"
                            overflowY="auto"
                        >
                            <Text className="live-section-label" mb={2}>
                                Transcript
                            </Text>
                            <TranscriptSection
                                transcripts={transcripts}
                                status={status}
                            />
                        </Box>
                    )}

                    {/* Footer */}
                    <Box
                        flexShrink={0}
                        px={3}
                        py={2}
                        borderTopWidth="1px"
                        borderColor="surface"
                        display="flex"
                        alignItems="center"
                        gap={2}
                    >
                        <Box
                            as="button"
                            display="inline-flex"
                            alignItems="center"
                            gap={1.5}
                            px={2}
                            py={1.5}
                            borderRadius="6px"
                            fontSize="xs"
                            color="fg.subtle"
                            cursor="pointer"
                            transition="all 0.15s ease"
                            _hover={{ bg: "surface", color: "fg.muted" }}
                            aria-expanded={isTranscriptOpen}
                            aria-controls="live-agent-transcript"
                            onClick={() =>
                                setIsTranscriptOpen((open) => !open)
                            }
                        >
                            {isTranscriptOpen ? (
                                <FaChevronDown size="10px" />
                            ) : (
                                <FaChevronUp size="10px" />
                            )}
                            Transcript
                        </Box>
                        <Text
                            fontSize="xs"
                            color="overlay0"
                            ml="auto"
                            textAlign="right"
                            truncate
                        >
                            {getContextLine(status)}
                        </Text>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};
