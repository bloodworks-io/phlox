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
        for (const label of ["phlox-0.8B · tuned (fast)", "phlox-2B · tuned (strongest)", "Custom…"]) {
            expect(container.textContent).toContain(label);
        }
        // The old select had no per-option explanations; the radios carry them.
        expect(container.textContent).toContain("Fastest letters");
        expect(container.textContent).toContain("Higher-quality letters");
        // Engine choice is not surfaced — it's a silent fallback.
        expect(container.textContent).not.toContain("WebLLM (");
        expect(container.textContent).not.toContain("(transformers.js)");
    });

    it("checks the persisted preset", () => {
        setModelId("phlox-2b");
        const { container } = renderWithProviders(<DemoSettingsPanel />);
        expect(checkedValue(container)).toBe("phlox-2b");
        // (Click-through isn't simulated here: zag's hidden-input event wiring
        // needs real browser pointer activation; RTL's synthetic events don't
        // reach its handler in jsdom.)
    });

    it("normalizes legacy engine-flavoured preset ids", () => {
        setModelId("phlox-0.8b-webllm");
        const { container } = renderWithProviders(<DemoSettingsPanel />);
        expect(getModelId()).toBe("phlox-0.8b");
        expect(checkedValue(container)).toBe("phlox-0.8b");
    });
});
