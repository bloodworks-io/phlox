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

    it("parses the unattributed S? marker", () => {
        expect(parseSpeakerLine("S?: not sure who")).toEqual({
            speaker: "S?",
            text: "not sure who",
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

    it("gives S? a muted pair distinct from numbered speakers", () => {
        const [unknown] = speakerColorPair("S?");
        [1, 2, 3, 4].forEach((n) => {
            expect(unknown).not.toBe(speakerColorPair(`S${n}`)[0]);
        });
    });
});

describe("SpeakerText", () => {
    it("renders a coloured dot per labelled line and leaves plain lines plain", () => {
        renderWithProviders(
            <SpeakerText
                text={"S1: good morning\nno labels here\nS2: thanks for coming in"}
            />,
        );
        expect(screen.getByText("good morning")).toBeInTheDocument();
        expect(screen.getByText("no labels here")).toBeInTheDocument();
        expect(screen.getByText("thanks for coming in")).toBeInTheDocument();
        const dots = document.querySelectorAll("[data-speaker]");
        expect(dots).toHaveLength(2);
        expect(dots[0].getAttribute("data-speaker")).toBe("S1");
        expect(dots[1].getAttribute("data-speaker")).toBe("S2");
        expect(dots[0].textContent).toBe("");
        expect(dots[0].style.borderRadius).not.toBe("");
        expect(dots[0].style.backgroundColor).not.toBe("");
        expect(dots[0].style.backgroundColor).not.toBe(dots[1].style.backgroundColor);
    });

    it("renders a hollow dot for the unattributed S? marker", () => {
        renderWithProviders(<SpeakerText text={"S1: good morning\nS?: unclear who"} />);
        const dots = document.querySelectorAll("[data-speaker]");
        expect(dots).toHaveLength(2);
        const unknown = dots[1];
        expect(unknown.getAttribute("data-speaker")).toBe("S?");
        expect(unknown.getAttribute("title")).toBe("Unattributed");
        // Hollow: transparent fill with a visible border.
        expect(unknown.style.backgroundColor).toBe("transparent");
        expect(unknown.style.border).not.toBe("");
        expect(dots[0].style.backgroundColor).not.toBe("transparent");
    });

    it("renders a fully plain transcript without any dots", () => {
        renderWithProviders(<SpeakerText text={"line one\nline two"} />);
        expect(screen.getByText("line one")).toBeInTheDocument();
        expect(screen.getByText("line two")).toBeInTheDocument();
        expect(document.querySelector("[data-speaker]")).toBeNull();
    });
});
