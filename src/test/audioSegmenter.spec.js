import { describe, it, expect } from "vitest";
import {
    UtteranceSegmenter,
    computeRms,
    concatFloat32,
} from "../utils/audioSegmenter";

const SR = 16000;

// A chunk of `ms` milliseconds of loud / quiet speech-level PCM.
const loud = (ms = 200) =>
    new Float32Array(Math.round((SR * ms) / 1000)).fill(0.3);
const quiet = (ms = 200) =>
    new Float32Array(Math.round((SR * ms) / 1000)).fill(0.001);

describe("computeRms", () => {
    it("returns 0 for empty input", () => {
        expect(computeRms(new Float32Array(0))).toBe(0);
        expect(computeRms(null)).toBe(0);
    });

    it("computes RMS of constant signals", () => {
        expect(computeRms(new Float32Array(100).fill(0.5))).toBeCloseTo(0.5, 5);
    });
});

describe("concatFloat32", () => {
    it("concatenates chunks in order", () => {
        const out = concatFloat32([
            Float32Array.from([1, 2]),
            Float32Array.from([3]),
        ]);
        expect(Array.from(out)).toEqual([1, 2, 3]);
    });
});

describe("UtteranceSegmenter", () => {
    it("returns nothing while silent", () => {
        const seg = new UtteranceSegmenter(SR);
        for (let i = 0; i < 10; i++) expect(seg.process(quiet())).toBeNull();
        expect(seg.flush()).toBeNull();
    });

    it("emits an utterance after trailing silence (with pre-roll)", () => {
        const seg = new UtteranceSegmenter(SR);
        expect(seg.process(loud())).toBeNull(); // streak 200ms < 250ms
        expect(seg.process(loud())).toBeNull(); // speech opens (pre-roll kept)
        expect(seg.process(loud())).toBeNull(); // 600ms of speech now
        expect(seg.process(quiet())).toBeNull(); // 200ms silence
        expect(seg.process(quiet())).toBeNull(); // 400ms silence
        const emitted = seg.process(quiet()); // 600ms silence closes it
        expect(emitted).toBeInstanceOf(Float32Array);
        // 3 loud + 3 quiet chunks (trailing silence aids STT).
        expect(emitted.length).toBe(6 * loud().length);
        expect(seg.flush()).toBeNull();
    });

    it("discards noise bursts shorter than minSpeechMs", () => {
        const seg = new UtteranceSegmenter(SR, {
            speechStartMs: 100,
            minSpeechMs: 400,
        });
        expect(seg.process(loud(300))).toBeNull(); // speech opens (300ms)
        expect(seg.process(quiet())).toBeNull();
        expect(seg.process(quiet())).toBeNull();
        expect(seg.process(quiet())).toBeNull(); // closes; too short
        expect(seg.flush()).toBeNull();
    });

    it("force-emits at maxSegmentMs and keeps speaking", () => {
        const seg = new UtteranceSegmenter(SR, { maxSegmentMs: 1000 });
        const emitted = [];
        for (let i = 0; i < 6; i++) {
            const result = seg.process(loud()); // 200ms each
            if (result) emitted.push(result);
        }
        // Total crosses 1000ms during the loop -> mid-speech emit happened.
        expect(emitted).toHaveLength(1);
        expect(emitted[0]).toBeInstanceOf(Float32Array);
        expect(emitted[0].length).toBe(5 * loud().length); // b1..b5
        // Speech continues after the cap; enough speech + trailing silence
        // closes segment #2.
        seg.process(loud());
        seg.process(quiet());
        seg.process(quiet());
        const second = seg.process(quiet());
        expect(second).toBeInstanceOf(Float32Array);
        // b6, b7 and the three closing silence chunks.
        expect(second.length).toBe(5 * loud().length);
    });

    it("flush emits in-progress speech", () => {
        const seg = new UtteranceSegmenter(SR);
        seg.process(loud());
        seg.process(loud());
        seg.process(loud()); // speaking, 600ms, no trailing silence yet
        const tail = seg.flush();
        expect(tail).toBeInstanceOf(Float32Array);
        expect(tail.length).toBe(3 * loud().length);
        expect(seg.flush()).toBeNull(); // nothing left
    });

    it("is immune to caller-side buffer recycling (WebKit ScriptProcessor)", () => {
        const seg = new UtteranceSegmenter(SR);
        const recycled = new Float32Array(Math.round((SR * 200) / 1000));
        const push = (value) => {
            recycled.fill(value);
            const out = seg.process(recycled);
            recycled.fill(0); // engine reuses the memory for the next callback
            return out;
        };

        expect(push(0.3)).toBeNull(); // streak 200ms < 250ms start
        expect(push(0.3)).toBeNull(); // speech opens
        expect(push(0.3)).toBeNull();
        expect(push(0.001)).toBeNull();
        expect(push(0.001)).toBeNull();
        const emitted = push(0.001); // 600ms silence closes it
        expect(emitted).toBeInstanceOf(Float32Array);
        // The segment must keep the loud speech captured earlier, not the
        // recycled (zeroed) memory contents at emit time.
        expect(emitted[0]).toBeCloseTo(0.3, 5);
        expect(emitted[Math.round((SR * 200) / 1000) - 1]).toBeCloseTo(0.3, 5);
    });
});
