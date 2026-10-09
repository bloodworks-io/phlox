// DemoSettingsPanel model presets: radio-group options with explanations and
// persisted-selection wiring.
import { beforeEach, describe, expect, it } from "vitest";
import DemoSettingsPanel from "../components/settings/DemoSettingsPanel";
import { renderWithProviders } from "./utils";
import { getModelId, setModelId } from "../localBackend/db";

describe("DemoSettingsPanel model presets", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    const checkedValue = (container) =>
        container.querySelector("input[type='radio']:checked")?.value;

    it("lists every preset with its explanation", () => {
        const { container } = renderWithProviders(<DemoSettingsPanel />);
        for (const label of [
            "phlox-0.8B · WebLLM (tuned, fast)",
            "phlox-0.8B · tuned (transformers.js)",
            "4B · best",
            "Custom…",
        ]) {
            expect(container.textContent).toContain(label);
        }
        // The old select had no per-option explanations; the radios carry them.
        expect(container.textContent).toContain("other browsers fall back automatically");
        expect(container.textContent).toContain("runs everywhere including Safari");
        expect(container.textContent).not.toContain("base (hub)");
        expect(container.textContent).not.toContain("2B · balanced");
    });

    it("checks the persisted preset", () => {
        setModelId("onnx-community/Qwen3.5-4B-ONNX-OPT");
        const { container } = renderWithProviders(<DemoSettingsPanel />);
        expect(checkedValue(container)).toBe("onnx-community/Qwen3.5-4B-ONNX-OPT");
        // (Click-through isn't simulated here: zag's hidden-input event wiring
        // needs real browser pointer activation; RTL's synthetic events don't
        // reach its handler in jsdom.)
    });
});
