import React, { useEffect, useRef } from "react";
import { Box, Text } from "@chakra-ui/react";

import { parseSpeakerLine, speakerColorPair } from "@/components/transcript/SpeakerText";
import { useColorModeValue } from "@/components/ui/color-mode";

/* Captions follow the feed only while the reader is already at the end. */
export const TranscriptSection = ({ transcripts }) => {
    const boxRef = useRef(null);
    const endRef = useRef(null);
    const pinnedRef = useRef(true);

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
    }, [transcripts.length]);

    return (
        <Box
            ref={boxRef}
            className="slim-scrollbar"
            onScroll={handleScroll}
            maxHeight="160px"
            overflowY="auto"
            pr={1}
        >
            {transcripts.length === 0 ? (
                <Text fontSize="xs" fontStyle="italic" color="overlay0">
                    Waiting for speech…
                </Text>
            ) : (
                transcripts.map((text, index) => (
                    <Caption key={index} text={text} isRecent={index >= transcripts.length - 2} />
                ))
            )}
            <div ref={endRef} />
        </Box>
    );
};

const Caption = ({ text, isRecent }) => {
    const { speaker, text: body } = parseSpeakerLine(text);
    const [light, dark] = speaker ? speakerColorPair(speaker) : [null, null];
    const dotColor = useColorModeValue(light, dark);

    return (
        <Text
            mb={1.5}
            fontSize="xs"
            lineHeight="1.5"
            color={isRecent ? "fg.muted" : "fg.subtle"}
            className="anim-fade-slide-up"
            css={{ animationDuration: "0.15s" }}
        >
            {speaker && dotColor ? (
                <span
                    style={{
                        display: "inline-block",
                        width: "7px",
                        height: "7px",
                        borderRadius: "9999px",
                        backgroundColor: dotColor,
                        marginRight: "6px",
                        verticalAlign: "middle",
                    }}
                    data-speaker={speaker}
                    title={speaker}
                />
            ) : null}
            {body}
        </Text>
    );
};
