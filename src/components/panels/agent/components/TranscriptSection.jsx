import React, { useEffect, useRef } from "react";
import { Box, Text } from "@chakra-ui/react";

/* Captions follow the feed only while the reader is already at the end. */
export const TranscriptSection = ({ transcripts, status }) => {
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
                    {status === "tidy"
                        ? "Speak a command to edit the note…"
                        : "Waiting for speech…"}
                </Text>
            ) : (
                transcripts.map((text, index) => {
                    const isRecent = index >= transcripts.length - 2;
                    return (
                        <Text
                            key={index}
                            mb={1.5}
                            fontSize="xs"
                            lineHeight="1.5"
                            color={isRecent ? "fg.muted" : "fg.subtle"}
                        >
                            {text}
                        </Text>
                    );
                })
            )}
            <div ref={endRef} />
        </Box>
    );
};
