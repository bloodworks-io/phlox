// Live capture caption card: partial transcript while recording, anchored
// above the scribe pill. Surface/scroll/animation patterns ported from
// origin/main's live-agent TranscriptSection (pinned scroll, recency
// gradient, fade-slide lines), styled as a sibling of the pill's popover
// family (solid secondary surface + surface border + arrow at the pill).
import { useEffect, useRef } from "react";
import { Box, HStack, Portal, Text } from "@chakra-ui/react";
import { SpeakerDot } from "../transcript/SpeakerText";

/**
 * @param {{ speaker: string | null, text: string }[]} segments
 */
export const LiveCaptureCard = ({ segments, words }) => {
    const boxRef = useRef(null);
    const endRef = useRef(null);
    const pinnedRef = useRef(true);
    const handleScroll = () => {
        const el = boxRef.current;
        if (!el) return;
        pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    };
    useEffect(() => {
        if (pinnedRef.current) {
            endRef.current?.scrollIntoView?.({ block: "end" });
        }
    }, [segments.length]);
    return (
        // Portaled so position:fixed resolves against the viewport — the pill
        // box carries a transform, which would otherwise make IT the
        // containing block and skew the card's anchoring.
        <Portal>
            {/* Pure centering wrapper — deliberately no animation: a
                fill-mode animation on this node would clobber the
                translateX(-50%) and push the card off-center. */}
            <Box
                position="fixed"
                bottom="110px"
                left="50%"
                transform="translateX(-50%)"
                zIndex="1050"
            >
                <Box
                    className="anim-fade-scale"
                    css={{ animationDuration: "0.15s" }}
                    position="relative"
                    width="300px"
                    maxHeight="220px"
                    display="flex"
                    flexDirection="column"
                    bg="secondary"
                    borderWidth="1px"
                    borderColor="surface"
                    borderRadius="lg"
                    boxShadow="0 8px 32px rgba(20, 20, 38, 0.25)"
                >
                    {/* Arrow pointing at the pill — same surface family as
                        the Chakra popover arrow on the mode dial */}
                    <Box
                        position="absolute"
                        bottom="-6px"
                        left="50%"
                        transform="translateX(-50%) rotate(45deg)"
                        width="10px"
                        height="10px"
                        bg="secondary"
                        borderRight="1px solid"
                        borderBottom="1px solid"
                        borderColor="surface"
                    />
                    <HStack px={3} pt={2} pb={1.5} gap={2} flexShrink={0}>
                        <Box className="live-bolt-pulse" width="7px" height="7px" borderRadius="full" bg="accent" flexShrink={0} />
                        <Text fontSize="xs" color="textSecondary">Capturing</Text>
                        <Text fontSize="xs" color="overlay0" ml="auto" textAlign="right">{words} words</Text>
                    </HStack>
                    <Box ref={boxRef} px={3} pb={2} pt={0.5} flex="1" minHeight="0" overflowY="auto" onScroll={handleScroll}
                        css={{ "&::-webkit-scrollbar": { width: "4px" }, "&::-webkit-scrollbar-track": { background: "transparent" },
                          "&::-webkit-scrollbar-thumb": { background: "var(--chakra-colors-scrollbar-thumb)", borderRadius: "24px" } }}>
                        {segments.map((segment, index) => (
                            <Caption key={index} segment={segment} isRecent={index >= segments.length - 2} />
                        ))}
                        <div ref={endRef} />
                    </Box>
                </Box>
            </Box>
        </Portal>
    );
};

const Caption = ({ segment, isRecent }) => (
    <Text as="div" mb={1.5} fontSize="xs" lineHeight="1.5" whiteSpace="pre-wrap"
        color={isRecent ? "textSecondary" : "overlay0"}
        className="anim-fade-slide-up" css={{ animationDuration: "0.15s" }}>
        {segment.speaker ? <SpeakerDot speaker={segment.speaker} /> : null}
        {segment.text}
    </Text>
);

export default LiveCaptureCard;
