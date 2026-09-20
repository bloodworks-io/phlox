import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import SpeakerText, {
    parseSpeakerLine,
    speakerColorPair,
} from "../transcript/SpeakerText";
import { renderWithProviders } from "../../test/utils";

afterEach(cleanup);

describe("parseSpeakerLine", () => {
    it("splits a labelled line", () => {
        expect(parseSpeakerLine("S1: hello there")).toEqual({
            speaker: "S1",
            text: "hello there",
        });
        expect(parseSpeakerLine("S12: multi word")).toEqual({
            speaker: "S12",
            text: "multi word",
        });
    });

    it("leaves plain and malformed lines alone", () => {
        expect(parseSpeakerLine("plain line")).toEqual({
            speaker: null,
            text: "plain line",
        });
        expect(parseSpeakerLine("s1: lowercase")).toEqual({
            speaker: null,
            text: "s1: lowercase",
        });
        expect(parseSpeakerLine("S0: zero is not a label")).toEqual({
            speaker: null,
            text: "S0: zero is not a label",
        });
    });
});

describe("speakerColorPair", () => {
    it("assigns distinct colours to S1..S4 and cycles beyond", () => {
        const pairs = [1, 2, 3, 4, 5].map(
            (n) => speakerColorPair(`S${n}`)[0],
        );
        expect(new Set(pairs.slice(0, 4)).size).toBe(4);
        expect(pairs[4]).toBe(pairs[0]); // S5 cycles back to S1's colour
    });
});

describe("SpeakerText", () => {
    it("renders chips per labelled line and leaves plain lines plain", () => {
        renderWithProviders(
            <SpeakerText
                text={"S1: good morning\nno labels here\nS2: thanks for coming in"}
            />,
        );
        expect(screen.getByText("S1")).toBeInTheDocument();
        expect(screen.getByText("S2")).toBeInTheDocument();
        expect(screen.getByText("good morning")).toBeInTheDocument();
        expect(screen.getByText("no labels here")).toBeInTheDocument();
        expect(screen.getByText("thanks for coming in")).toBeInTheDocument();
        expect(screen.queryByText("S3")).not.toBeInTheDocument();
    });

    it("renders a fully plain transcript without any chips", () => {
        renderWithProviders(<SpeakerText text={"line one\nline two"} />);
        expect(screen.getByText("line one")).toBeInTheDocument();
        expect(screen.getByText("line two")).toBeInTheDocument();
        expect(document.querySelector("[data-speaker]")).toBeNull();
    });
});
