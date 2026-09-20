// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import createVADModule from "../audio/ten-vad/ten_vad.js";
import {
    LinearResampler,
    TenVadEngine,
    VadPipeline,
    floatToInt16,
} from "../audio/vadPipeline";

const NATIVE_RATE = 48000;

// Speech-ish test tone: 440/880 Hz carriers with a 4 Hz amplitude
// modulation envelope, scaled to [-1, 1].
function speechishSignal(seconds, rate = NATIVE_RATE) {
    const n = Math.round(seconds * rate);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const t = i / rate;
        const env = 0.6 + 0.4 * Math.sin(2 * Math.PI * 4 * t);
        out[i] =
            (0.3 * env * (Math.sin(2 * Math.PI * 440 * t) +
                0.5 * Math.sin(2 * Math.PI * 880 * t))) /
            1.5;
    }
    return out;
}

describe("LinearResampler", () => {
    it("produces the expected output length", () => {
        const r = new LinearResampler(48000, 16000);
        const out = r.process(new Float32Array(4800));
        expect(out.length).toBe(Math.floor((4800 * 16000) / 48000));
    });

    it("is identical when fed in small chunks vs one shot", () => {
        const ramp = new Float32Array(5001);
        for (let i = 0; i < ramp.length; i++) ramp[i] = Math.sin(i / 97.3);

        const oneShot = new LinearResampler(48000, 16000);
        const whole = oneShot.process(ramp);

        const chunked = new LinearResampler(48000, 16000);
        const pieces = [];
        let offset = 0;
        const sizes = [1, 7, 4096, 3, 128, 65536, 5];
        for (let i = 0; offset < ramp.length; i++) {
            const size = Math.min(sizes[i % sizes.length], ramp.length - offset);
            pieces.push(chunked.process(ramp.subarray(offset, offset + size)));
            offset += size;
        }
        const joined = new Float32Array(pieces.reduce((a, p) => a + p.length, 0));
        let pos = 0;
        for (const p of pieces) {
            joined.set(p, pos);
            pos += p.length;
        }

        expect(joined.length).toBe(whole.length);
        for (let i = 0; i < whole.length; i++) {
            expect(joined[i]).toBe(whole[i]);
        }
    });

    it("passes through unchanged when rates match", () => {
        const r = new LinearResampler(16000, 16000);
        const input = Float32Array.from([0.1, -0.2, 0.3]);
        const out = r.process(input);
        expect(out.length).toBe(3);
        for (let i = 0; i < 3; i++) {
            expect(out[i]).toBeCloseTo(input[i], 5);
        }
    });
});

describe("floatToInt16", () => {
    it("clamps and scales (truncating to int)", () => {
        const out = floatToInt16(Float32Array.from([0, 0.5, -0.5, 2, -2]));
        expect(out[0]).toBe(0);
        expect(out[1]).toBe(Math.trunc(0.5 * 0x7fff));
        expect(out[2]).toBe(Math.trunc(-0.5 * 0x8000));
        expect(out[3]).toBe(0x7fff);
        expect(out[4]).toBe(-0x8000);
    });
});

describe("TenVadEngine (real wasm)", () => {
    let module;

    beforeAll(async () => {
        const wasmPath = fileURLToPath(
            new URL("../audio/ten-vad/ten_vad.wasm", import.meta.url),
        );
        module = await createVADModule({
            wasmBinary: readFileSync(wasmPath),
        });
    });

    afterAll(() => {
        // Emscripten has no explicit shutdown; let the process reclaim it.
    });

    it("reports a version string", () => {
        const engine = new TenVadEngine(module);
        expect(engine.version().length).toBeGreaterThan(0);
        engine.destroy();
    });

    it("returns bounded probabilities and distinguishes tone from silence", () => {
        const engine = new TenVadEngine(module);
        const tone = speechishSignal(1, 16000);
        const silence = new Float32Array(16000);

        let toneMaxProb = 0;
        for (let i = 0; i + 256 <= tone.length; i += 256) {
            const { probability } = engine.process(
                floatToInt16(tone.subarray(i, i + 256)),
            );
            expect(probability).toBeGreaterThanOrEqual(0);
            expect(probability).toBeLessThanOrEqual(1);
            toneMaxProb = Math.max(toneMaxProb, probability);
        }

        let silenceMaxProb = 0;
        for (let i = 0; i + 256 <= silence.length; i += 256) {
            const { probability } = engine.process(new Int16Array(256));
            silenceMaxProb = Math.max(silenceMaxProb, probability);
        }

        expect(toneMaxProb).toBeGreaterThan(0.5);
        expect(toneMaxProb).toBeGreaterThan(silenceMaxProb);
        engine.destroy();
    });

    it("reset() keeps the engine usable", () => {
        const engine = new TenVadEngine(module);
        engine.process(new Int16Array(256));
        engine.reset();
        const { probability } = engine.process(new Int16Array(256));
        expect(probability).toBeGreaterThanOrEqual(0);
        engine.destroy();
    });
});

describe("VadPipeline (real wasm)", () => {
    let module;

    beforeAll(async () => {
        const wasmPath = fileURLToPath(
            new URL("../audio/ten-vad/ten_vad.wasm", import.meta.url),
        );
        module = await createVADModule({
            wasmBinary: readFileSync(wasmPath),
        });
    });

    const feedAll = (pipeline, signal) => {
        const segments = [];
        for (let offset = 0; offset < signal.length; offset += 4096) {
            segments.push(
                ...pipeline.process(signal.subarray(offset, offset + 4096)),
            );
        }
        return segments;
    };

    it("emits no segments for silence", () => {
        const pipeline = new VadPipeline({
            sampleRate: NATIVE_RATE,
            module,
        });
        expect(pipeline.version().length).toBeGreaterThan(0);
        expect(feedAll(pipeline, new Float32Array(NATIVE_RATE * 2))).toHaveLength(0);
        expect(pipeline.flush()).toBeNull();
    });

    it("emits one utterance for a tone followed by silence, and flushes an open tail", () => {
        // NOTE: TEN VAD probabilities decay for ~15 hops after speech ends
        // and settle at a ~0.14 floor on silence, so speechOffProb must sit
        // above that floor for end-of-utterance detection to work.
        const closed = new VadPipeline({
            sampleRate: NATIVE_RATE,
            module,
            segmenterOptions: {
                speechOnProb: 0.4,
                speechOffProb: 0.3,
                speechStartMs: 100,
                silenceEndMs: 400,
            },
        });
        const withTail = new Float32Array(NATIVE_RATE * 2); // 1s tone + 1s silence
        withTail.set(speechishSignal(1), 0);
        const segments = feedAll(closed, withTail);
        expect(segments).toHaveLength(1);
        expect(segments[0].length).toBeGreaterThan(16000 * 0.5); // ≥ 0.5s
        expect(closed.flush()).toBeNull();

        const open = new VadPipeline({
            sampleRate: NATIVE_RATE,
            module,
            segmenterOptions: {
                speechOnProb: 0.4,
                speechOffProb: 0.3,
                speechStartMs: 100,
            },
        });
        expect(feedAll(open, speechishSignal(1.5))).toHaveLength(0);
        const tail = open.flush();
        expect(tail).toBeInstanceOf(Float32Array);
        expect(tail.length).toBeGreaterThan(16000 * 0.5);
    });
});
