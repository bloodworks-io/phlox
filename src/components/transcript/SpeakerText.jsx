import React from "react";
import { Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

import { useColorModeValue } from "@/components/ui/color-mode";

// Catppuccin-derived accents, one per anonymous speaker label (S1..S4+).
const SPEAKER_COLORS = [
    ["#179299", "#8bd5ca"],
    ["#fe640b", "#f5a97f"],
    ["#7287fd", "#b7bdf8"],
    ["#d20f39", "#ed8796"],
];

const SPEAKER_LINE_RE = /^(S[1-9]\d*|S\?):\s/;

/** Label for an utterance the diarizer heard but could not attribute. */
export const UNKNOWN_SPEAKER = "S?";
const UNKNOWN_COLORS = ["#6c6f85", "#a5adcb"];

/** Parse an optional speaker prefix: { speaker: "S2" | "S?" | null, text }. */
export const parseSpeakerLine = (line) => {
    const match = SPEAKER_LINE_RE.exec(line);
    if (!match) return { speaker: null, text: line };
    return { speaker: match[1], text: line.slice(match[0].length) };
};

/** Light/dark hex pair for a speaker label (S5+ cycles the palette). */
export const speakerColorPair = (speaker) => {
    if (speaker === UNKNOWN_SPEAKER) return UNKNOWN_COLORS;
    const num = parseInt(speaker.slice(1), 10);
    return SPEAKER_COLORS[(num - 1) % SPEAKER_COLORS.length];
};

export const SpeakerDot = ({ speaker }) => {
    const [light, dark] = speakerColorPair(speaker);
    const color = useColorModeValue(light, dark);
    const unknown = speaker === UNKNOWN_SPEAKER;
    const { t } = useTranslation();
    return (
        <span
            style={{
                display: "inline-block",
                width: "7px",
                height: "7px",
                borderRadius: "9999px",
                backgroundColor: unknown ? "transparent" : color,
                border: unknown ? `1.5px solid ${color}` : "none",
                boxSizing: "border-box",
                marginRight: "6px",
                verticalAlign: "middle",
            }}
            data-speaker={speaker}
            title={unknown ? t("transcript.unattributed") : speaker}
        />
    );
};

export const SpeakerText = ({ text, ...textProps }) =>
    text.split("\n").map((line, i) => {
        const { speaker, text: body } = parseSpeakerLine(line);
        return (
            <Text key={i} as="div" whiteSpace="pre-wrap" {...textProps}>
                {speaker ? <SpeakerDot speaker={speaker} /> : null}
                {body}
            </Text>
        );
    });

export default SpeakerText;
