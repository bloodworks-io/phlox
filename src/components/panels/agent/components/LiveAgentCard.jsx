import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box } from "@chakra-ui/react";

import { ExpandedAgentPanel } from "./ExpandedAgentPanel";

const POSITION_STORAGE_KEY = "phlox:live-agent-pos";
const EXPANDED_WIDTH = 340;

const EDGE_BUFFER = 16;
const TOP_MARGIN = 34; // clear the traffic-light drag region
const MAX_HEIGHT_VH = 0.65;
const PILL_CLEARANCE = 12;

const scribePillRect = () => {
    const pill =
        typeof document === "undefined"
            ? null
            : document.querySelector(".pill-box-scribe");
    if (!pill) return null;
    const rect = pill.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? rect : null;
};

const clampPosition = (x, bottom, width, height) => {
    const maxHeight = Math.min(
        height ?? window.innerHeight * MAX_HEIGHT_VH,
        window.innerHeight * MAX_HEIGHT_VH,
    );
    const next = {
        x: Math.min(
            Math.max(x, EDGE_BUFFER),
            Math.max(EDGE_BUFFER, window.innerWidth - width - EDGE_BUFFER),
        ),
        bottom: Math.min(
            Math.max(bottom, EDGE_BUFFER),
            Math.max(
                EDGE_BUFFER,
                window.innerHeight - TOP_MARGIN - maxHeight - EDGE_BUFFER,
            ),
        ),
    };

    const pill = scribePillRect();
    if (!pill) return next;
    const cardBottomY = window.innerHeight - next.bottom;
    const cardTop = cardBottomY - maxHeight;
    const bandsOverlap =
        cardBottomY > pill.top - PILL_CLEARANCE &&
        cardTop < pill.bottom + PILL_CLEARANCE;
    const horizontalOverlap =
        next.x < pill.right + PILL_CLEARANCE &&
        next.x + width > pill.left - PILL_CLEARANCE;
    if (!bandsOverlap || !horizontalOverlap) return next;

    const clearRight = pill.right + PILL_CLEARANCE;
    if (clearRight + width <= window.innerWidth - EDGE_BUFFER) {
        return { ...next, x: Math.max(next.x, clearRight) };
    }
    return {
        ...next,
        bottom: Math.max(
            next.bottom,
            window.innerHeight - pill.top + PILL_CLEARANCE,
        ),
    };
};

const readSavedPosition = () => {
    try {
        const raw = window.localStorage.getItem(POSITION_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed &&
            Number.isFinite(parsed.x) &&
            Number.isFinite(parsed.bottom)
            ? parsed
            : null;
    } catch {
        return null;
    }
};

export const LiveAgentCard = ({
    status,
    agentState,
    transcripts,
    statuses,
    artifacts,
    lastError,
    onToggleExpand,
    onOpenLetter,
    onRetry,
    onDismissReview,
}) => {
    const width = EXPANDED_WIDTH;

    const [position, setPosition] = useState(() => {
        const saved = readSavedPosition();
        if (saved) return clampPosition(saved.x, saved.bottom, width, null);

        const pill = scribePillRect();
        const initial = pill
            ? {
                  x: pill.left + pill.width / 2 - width / 2,
                  bottom: window.innerHeight - pill.top + PILL_CLEARANCE,
              }
            : {
                  x: window.innerWidth - EXPANDED_WIDTH - EDGE_BUFFER,
                  bottom: 16,
              };
        return clampPosition(initial.x, initial.bottom, width, null);
    });
    const dragRef = useRef(null);
    const panelRef = useRef(null);

    const panelHeight = useCallback(
        () => panelRef.current?.offsetHeight ?? null,
        [],
    );

    useEffect(() => {
        const reclamp = () =>
            setPosition((prev) =>
                clampPosition(prev.x, prev.bottom, width, panelHeight()),
            );
        reclamp();
        window.addEventListener("resize", reclamp);
        return () => window.removeEventListener("resize", reclamp);
    }, [width, panelHeight, statuses.length, artifacts.length, status]);

    const handlePointerDown = (e) => {
        if (e.button !== 0 || e.target.closest("button")) return;
        dragRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            origX: position.x,
            origBottom: position.bottom,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;
        setPosition(
            clampPosition(
                drag.origX + (e.clientX - drag.startX),
                drag.origBottom - (e.clientY - drag.startY),
                width,
                panelHeight(),
            ),
        );
    };

    const handlePointerUp = (e) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;
        dragRef.current = null;
        try {
            window.localStorage.setItem(
                POSITION_STORAGE_KEY,
                JSON.stringify(position),
            );
        } catch {
            // non-fatal: just lose the parked position
        }
    };

    const dragHandlers = {
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
    };

    return (
        <Box
            ref={panelRef}
            className="live-agent-card anim-fade-slide-up"
            position="fixed"
            left={`${position.x}px`}
            bottom={`${position.bottom}px`}
            width={`${width}px`}
            zIndex="1060"
        >
            <ExpandedAgentPanel
                status={status}
                agentState={agentState}
                transcripts={transcripts}
                statuses={statuses}
                artifacts={artifacts}
                lastError={lastError}
                onToggleExpand={onToggleExpand}
                onOpenLetter={onOpenLetter}
                onRetry={onRetry}
                onDismissReview={onDismissReview}
                dragHandlers={dragHandlers}
            />
        </Box>
    );
};
