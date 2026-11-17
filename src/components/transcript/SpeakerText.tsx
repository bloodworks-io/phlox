import React from "react";
import { Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

import { useColorModeValue } from "@/components/ui/color-mode";

// Dedicated categorical speaker colors. Speaker identity is not clinical
// status, so these deliberately do not reuse action/success/warning/danger.
const SPEAKER_PAIRS: Array<[string, string]> = [
    ["#51617c", "#8fb8ce"],
    ["#7d5c46", "#e0b48c"],
    ["#5c724f", "#c3d59b"],
    ["#7a4f74", "#cbb3d8"],
];
const UNKNOWN_PAIR: [string, string] = ["#5e675c", "#b8bdb1"];

const SPEAKER_LINE_RE = /^(S[1-9]\d*|S\?):\s/;

/** Label for an utterance the diarizer heard but could not attribute. */
export const UNKNOWN_SPEAKER = "S?";

export interface ParsedSpeakerLine {
    speaker: string | null;
    text: string;
}

/** Parse an optional speaker prefix: { speaker: "S2" | "S?" | null, text }. */
export const parseSpeakerLine = (line: string): ParsedSpeakerLine => {
    const match = SPEAKER_LINE_RE.exec(line);
    if (!match) return { speaker: null, text: line };
    return { speaker: match[1], text: line.slice(match[0].length) };
};

/** Light/dark categorical pair for a speaker label (S5+ cycles). */
export const speakerColorPair = (speaker: string): [string, string] => {
    if (speaker === UNKNOWN_SPEAKER) return UNKNOWN_PAIR;
    const index = parseInt(speaker.slice(1), 10) - 1;
    return SPEAKER_PAIRS[index % SPEAKER_PAIRS.length];
};

interface SpeakerDotProps {
    speaker: string;
}

export const SpeakerDot = ({ speaker }: SpeakerDotProps) => {
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

interface SpeakerTextProps {
    text: string;
    /** Transcript line index to highlight (citation navigation). */
    highlightIndex?: number | null;
    [key: string]: unknown;
}

export const SpeakerText = ({ text, highlightIndex, ...textProps }: SpeakerTextProps) =>
    text.split("\n").map((line, i) => {
        const { speaker, text: body } = parseSpeakerLine(line);
        return (
            <Text
                key={i}
                as="div"
                whiteSpace="pre-wrap"
                data-line={i}
                className={highlightIndex === i ? "transcript-line--highlighted" : undefined}
                {...textProps}
            >
                {speaker ? <SpeakerDot speaker={speaker} /> : null}
                {body}
            </Text>
        );
    });

export default SpeakerText;
