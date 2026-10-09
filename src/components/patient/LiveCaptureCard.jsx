// Live capture caption card: partial transcript while recording, anchored
// above the scribe pill. Surface/scroll/animation patterns ported from
// origin/main's live-agent TranscriptSection (pinned scroll, recency
// gradient, fade-slide lines) on a theme-following translucent card.
import { useEffect, useRef } from "react";
import { Box, HStack, Text } from "@chakra-ui/react";
import { SpeakerDot } from "../transcript/SpeakerText";

/**
 * @param {{ speaker: string | null, text: string }[]} segments
 */
export const LiveCaptureCard = ({ segments, words }) => {
    const boxRef = useRef(null);
    const endRef = useRef(null);
    const pinnedRef = useRef(true);

    // Captions follow the feed only while the reader is already at the end.
    const handleScroll = () => {
        const el = boxRef.current;
        if (!el) return;
        pinnedRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    };

    useEffect(() => {
        if (pinnedRef.current) {
            endRef.current?.scrollIntoView?.({ block: "end" });
        }
    }, [segments.length]);

    return (
        <Box
            className="anim-fade-slide-up"
            position="fixed"
            bottom="92px"
            left="50%"
            transform="translateX(-50%)"
            width="300px"
            maxHeight="220px"
            zIndex="1050"
            display="flex"
            flexDirection="column"
            bg="surfaceQuartile"
            backdropFilter="blur(20px) saturate(180%)"
            borderWidth="1px"
            borderColor="surfaceQuartile"
            borderRadius="xl"
            boxShadow="0 8px 32px rgba(20, 20, 38, 0.25)"
            overflow="hidden"
        >
            {/* Header: capture status + running word count */}
            <HStack
                px={3}
                py={2}
                gap={2}
                flexShrink={0}
                borderBottomWidth="1px"
                borderColor="surfaceQuartile"
            >
                <Box
                    className="live-bolt-pulse"
                    width="7px"
                    height="7px"
                    borderRadius="full"
                    bg="accent"
                    flexShrink={0}
                />
                <Text fontSize="xs" color="textSecondary">
                    Capturing
                </Text>
                <Text fontSize="xs" color="overlay0" ml="auto" textAlign="right">
                    {words} words
                </Text>
            </HStack>

            {/* Caption feed — sticks to the newest utterance unless scrolled up */}
            <Box
                ref={boxRef}
                px={3}
                py={2}
                flex="1"
                minHeight="0"
                overflowY="auto"
                onScroll={handleScroll}
                css={{
                    "&::-webkit-scrollbar": { width: "4px" },
                    "&::-webkit-scrollbar-track": { background: "transparent" },
                    "&::-webkit-scrollbar-thumb": {
                        background: "var(--chakra-colors-scrollbar-thumb)",
                        borderRadius: "24px",
                    },
                }}
            >
                {segments.map((segment, index) => (
                    <Caption
                        key={index}
                        segment={segment}
                        isRecent={index >= segments.length - 2}
                    />
                ))}
                <div ref={endRef} />
            </Box>
        </Box>
    );
};

const Caption = ({ segment, isRecent }) => (
    <Text
        as="div"
        mb={1.5}
        fontSize="xs"
        lineHeight="1.5"
        whiteSpace="pre-wrap"
        color={isRecent ? "textSecondary" : "overlay0"}
        className="anim-fade-slide-up"
        css={{ animationDuration: "0.15s" }}
    >
        {segment.speaker ? <SpeakerDot speaker={segment.speaker} /> : null}
        {segment.text}
    </Text>
);

export default LiveCaptureCard;
