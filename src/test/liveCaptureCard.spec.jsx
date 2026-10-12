import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { LiveCaptureCard } from "../components/patient/LiveCaptureCard";
import { renderWithProviders } from "./utils";

// The card renders through a Portal (fixed positioning against the
// viewport), so its DOM lives on document.body — not inside the render
// container. There is no RTL auto-cleanup without vitest globals, so query
// per-render scopes instead of accumulating matches across tests.
const bodyOf = () => document.body;

const SEGMENTS = [
    { speaker: "S1", text: "So the vitamin D levels are back in range." },
    { speaker: "S2", text: "Great, let's repeat the bloods in two weeks." },
    { speaker: null, text: "And follow up in clinic." },
];

describe("LiveCaptureCard", () => {
    it("renders the capturing header with the running word count", () => {
        renderWithProviders(<LiveCaptureCard segments={SEGMENTS} words={214} />);
        expect(screen.getByText("Capturing")).toBeTruthy();
        expect(screen.getByText("214 words")).toBeTruthy();
    });

    it("renders captions with speaker dots only for labeled segments", () => {
        const firstDotCount = bodyOf().querySelectorAll("[data-speaker]").length;
        renderWithProviders(<LiveCaptureCard segments={SEGMENTS} words={20} />);
        const dots = [...bodyOf().querySelectorAll("[data-speaker]")].slice(firstDotCount);
        expect(dots.map((el) => el.getAttribute("data-speaker"))).toEqual(["S1", "S2"]);
        expect(bodyOf().textContent).toContain("vitamin D levels");
        expect(bodyOf().textContent).toContain("follow up in clinic");
    });

    it("renders an empty caption feed without dots", () => {
        const before = bodyOf().querySelectorAll("[data-speaker]").length;
        renderWithProviders(<LiveCaptureCard segments={[]} words={0} />);
        expect(screen.getByText("0 words")).toBeTruthy();
        expect(bodyOf().querySelectorAll("[data-speaker]").length).toBe(before);
    });
});
