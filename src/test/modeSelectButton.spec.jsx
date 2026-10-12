// ModeSelectButton: the pill's mode-dial popover (ported from origin/main,
// minus the agent mode). Options render with hints and exactly one active row.
// No RTL auto-cleanup without vitest globals — every query is scoped to the
// render's own tree so earlier tests can't leak DOM into later assertions.
import { describe, expect, it, vi } from "vitest";
import { ModeSelectButton } from "../components/patient/scribeButtons";
import { renderWithProviders } from "./utils";

const renderPopover = (mode, onSelect = () => {}, onOpenChange = () => {}) =>
    renderWithProviders(
        <ModeSelectButton mode={mode} open onSelect={onSelect} onOpenChange={onOpenChange} />,
    );

const optionButton = (root, label) =>
    [...root.querySelectorAll("button")].find((b) => b.textContent.includes(label));

describe("ModeSelectButton", () => {
    it("lists both capture modes with hints and one active row", () => {
        const { container } = renderPopover("ambient");
        const text = container.textContent;
        expect(text).toContain("Ambient");
        expect(text).toContain("captures the whole consultation");
        expect(text).toContain("Dictate");
        expect(text).toContain("direct speech, processed on send");
        // no agent mode in the demo
        expect(text).not.toContain("realtime");
        // react-icons render classless svgs here; the active row is the one
        // carrying a second svg (the FaCheck next to the mode icon)
        const svgs = (label) => optionButton(container, label)?.querySelectorAll("svg").length;
        expect(svgs("Ambient")).toBe(2);
        expect(svgs("Dictate")).toBe(1);
    });

    it("reports the chosen mode and closes", () => {
        const onSelect = vi.fn();
        const onOpenChange = vi.fn();
        const { container } = renderPopover("ambient", onSelect, onOpenChange);
        optionButton(container, "Dictate").click();
        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(onSelect).toHaveBeenCalledWith("dictate");
    });

    it("does not re-select the active mode", () => {
        const onSelect = vi.fn();
        const { container } = renderPopover("ambient", onSelect);
        optionButton(container, "Ambient").click();
        expect(onSelect).not.toHaveBeenCalled();
    });
});
