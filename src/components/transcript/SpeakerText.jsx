import React from "react";
import { Text } from "@chakra-ui/react";

import { useColorModeValue } from "@/components/ui/color-mode";

// Catppuccin-derived accents, one per anonymous speaker label (S1..S4+).
const SPEAKER_COLORS = [
    ["#179299", "#8bd5ca"],
    ["#fe640b", "#f5a97f"],
    ["#7287fd", "#b7bdf8"],
    ["#d20f39", "#ed8796"],
];

const SPEAKER_LINE_RE = /^(S[1-9]\d*):\s/;

/** Parse an optional speaker prefix: { speaker: "S2" | null, text }. */
export const parseSpeakerLine = (line) => {
    const match = SPEAKER_LINE_RE.exec(line);
    if (!match) return { speaker: null, text: line };
    return { speaker: match[1], text: line.slice(match[0].length) };
};

/** Light/dark hex pair for a speaker label (S5+ cycles the palette). */
export const speakerColorPair = (speaker) => {
    const num = parseInt(speaker.slice(1), 10);
    return SPEAKER_COLORS[(num - 1) % SPEAKER_COLORS.length];
};

const SpeakerChip = ({ speaker }) => {
    const [light, dark] = speakerColorPair(speaker);
    const color = useColorModeValue(light, dark);
    return (
        <span
            style={{ color, fontWeight: 600, fontSize: "10px", marginRight: 4 }}
            data-speaker={speaker}
        >
            {speaker}
        </span>
    );
};

export const SpeakerText = ({ text, ...textProps }) =>
    text.split("\n").map((line, i) => {
        const { speaker, text: body } = parseSpeakerLine(line);
        return (
            <Text key={i} as="div" whiteSpace="pre-wrap" {...textProps}>
                {speaker ? <SpeakerChip speaker={speaker} /> : null}
                {body}
            </Text>
        );
    });

export default SpeakerText;
