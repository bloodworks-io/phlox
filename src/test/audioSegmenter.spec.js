import { describe, it, expect } from "vitest";
import { UtteranceSegmenter, concatFloat32 } from "../utils/audioSegmenter";

const SR = 16000;

// One 16 ms hop at 16 kHz, matching the TEN VAD frame size.
const frame = (value = 0) => new Float32Array(256).fill(value);
const feed = (seg, n, prob) => {
    let last = null;
    for (let i = 0; i < n; i++) last = seg.process(frame(), prob);
    return last;
};

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
        expect(feed(seg, 50, 0.1)).toBeNull();
        expect(seg.flush()).toBeNull();
    });

    it("opens on sustained speech probability and closes on silence (pre-roll kept)", () => {
        const seg = new UtteranceSegmenter(SR);
        // 250ms / 16ms = 16 hops to open; 400ms / 16ms = 25 hops to close.
        // 37 speech hops ≈ 592ms, comfortably above minSpeechMs (300ms).
        expect(feed(seg, 37, 0.9)).toBeNull(); // opens at hop 16, keeps going
        expect(feed(seg, 24, 0.1)).toBeNull();
        const emitted = feed(seg, 1, 0.1); // 25th silence hop closes
        expect(emitted).toBeInstanceOf(Float32Array);
        // 37 speech hops (incl. pre-roll) + 1600 samples of kept silence
        // tail (25 hops closed on, tailKeepMs=100 → trim 4800 samples).
        expect(emitted.length).toBe(37 * 256 + 1600);
    });

    it("treats sub-threshold probabilities as silence while not speaking", () => {
        const seg = new UtteranceSegmenter(SR);
        expect(feed(seg, 50, 0.4)).toBeNull(); // 0.4 < speechOnProb (0.5)
        expect(seg.flush()).toBeNull();
    });

    it("keeps the utterance open through mid-speech dips (hysteresis)", () => {
        const seg = new UtteranceSegmenter(SR);
        feed(seg, 16, 0.9); // open
        // 0.4 sits between speechOffProb (0.35) and speechOnProb (0.5):
        // inside an open utterance it still counts as speech.
        expect(feed(seg, 100, 0.4)).toBeNull();
        const emitted = feed(seg, 25, 0.05); // only true silence closes
        expect(emitted).toBeInstanceOf(Float32Array);
        expect(emitted.length).toBe((16 + 100) * 256 + 1600);
    });

    it("discards utterances whose speech never reaches minSpeechMs", () => {
        const seg = new UtteranceSegmenter(SR, {
            speechStartMs: 100,
            minSpeechMs: 400,
        });
        // 20 hops ≈ 320ms: opens (> 100ms) but under minSpeechMs (400ms).
        expect(feed(seg, 20, 0.9)).toBeNull();
        const emitted = feed(seg, 25, 0.1); // silence closes it
        expect(emitted).toBeNull(); // discarded: too little speech
        expect(seg.flush()).toBeNull();
    });

    it("force-emits at maxSegmentMs and keeps speaking", () => {
        const seg = new UtteranceSegmenter(SR, { maxSegmentMs: 1000 });
        const emitted = [];
        for (let i = 0; i < 70; i++) {
            // 70 hops * 16ms = 1120ms > 1000ms cap.
            const out = seg.process(frame(), 0.9);
            if (out) emitted.push(out);
        }
        expect(emitted).toHaveLength(1);
        // Opens at hop 16; cap (1000ms = 62.5 hops) reached at hop 63.
        expect(emitted[0].length).toBe(63 * 256);
        // Speech continues after the cap; enough speech (7 in-loop + 12
        // more hops = 19 hops ≥ minSpeechMs) + trailing silence closes #2.
        feed(seg, 12, 0.9);
        expect(feed(seg, 25, 0.1)).toBeInstanceOf(Float32Array);
    });

    it("flush emits in-progress speech", () => {
        const seg = new UtteranceSegmenter(SR);
        feed(seg, 37, 0.9); // speaking, ~592ms, no trailing silence yet
        const tail = seg.flush();
        expect(tail).toBeInstanceOf(Float32Array);
        expect(tail.length).toBe(37 * 256);
        expect(seg.flush()).toBeNull(); // nothing left
    });

    it("is immune to caller-side buffer recycling", () => {
        const seg = new UtteranceSegmenter(SR);
        const recycled = new Float32Array(256);
        const push = (prob) => {
            const out = seg.process(recycled, prob);
            recycled.fill(0); // caller reuses the memory between calls
            return out;
        };

        for (let i = 0; i < 37; i++) expect(push(0.9)).toBeNull(); // opens
        for (let i = 0; i < 24; i++) expect(push(0.1)).toBeNull();
        const emitted = push(0.1); // 25th silence hop closes
        expect(emitted).toBeInstanceOf(Float32Array);
        expect(emitted.length).toBe(37 * 256 + 1600);
    });

    it("splits fast speaker handovers into separate utterances", () => {
        const seg = new UtteranceSegmenter(SR);
        const segments = [];
        const run = (n, prob) => {
            for (let i = 0; i < n; i++) {
                const out = seg.process(frame(), prob);
                if (out) segments.push(out);
            }
        };
        run(37, 0.9); // first speaker ~592ms
        run(29, 0.1); // 464ms gap — over silenceEndMs, closes mid-loop
        run(37, 0.9); // second speaker
        run(29, 0.1); // closes again
        expect(segments).toHaveLength(2);
        // 37 speech hops (incl. pre-roll) + kept 1600-sample silence tail.
        expect(segments[0].length).toBe(37 * 256 + 1600);
        expect(segments[1].length).toBe(37 * 256 + 1600);
    });
});
