// recommendedModelId: any WebLLM-capable adapter (fp16 + storage-buffer gate)
// defaults to the 2B; everything else to the 0.8B. Drives the REAL probe
// code by stubbing navigator.gpu.requestAdapter; describeGpu is memoized per
// module instance, so each case re-imports the module fresh.
import { beforeEach, describe, expect, it, vi } from "vitest";

const installAdapter = ({ f16 = true, storageBuffers = 12, present = true }) => {
    if (!present) {
        delete navigator.gpu;
        return;
    }
    Object.defineProperty(navigator, "gpu", {
        configurable: true,
        value: {
            requestAdapter: async () => ({
                features: new Set(f16 ? ["shader-f16"] : []),
                info: { vendor: "stub", architecture: "stub-gpu" },
                limits: { maxStorageBuffersPerShaderStage: storageBuffers },
            }),
        },
    });
};

const recommend = () => import("../localBackend/llm").then((m) => m.recommendedModelId());

describe("recommendedModelId", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it("picks the 2B on any adapter that passes the WebLLM gate", async () => {
        installAdapter({});
        expect(await recommend()).toBe("phlox-2b");
    });

    it("downgrades to the 0.8B without WebGPU", async () => {
        installAdapter({ present: false });
        expect(await recommend()).toBe("phlox-0.8b");
    });

    it("downgrades to the 0.8B without fp16 shaders", async () => {
        installAdapter({ f16: false });
        expect(await recommend()).toBe("phlox-0.8b");
    });

    it("downgrades to the 0.8B when the adapter fails the WebLLM buffer gate", async () => {
        installAdapter({ storageBuffers: 9 });
        expect(await recommend()).toBe("phlox-0.8b");
    });
});
