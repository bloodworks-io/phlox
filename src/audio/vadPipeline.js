// Streaming VAD pipeline: native-rate PCM in, complete utterances (16 kHz
// Float32) out. Designed to run inside a web worker (vad-worker.js) but has
// no browser dependencies, so it also runs under Node in tests.
//
// The TEN VAD wasm artifacts in ./ten-vad/ are vendored from
// TEN-framework/ten-vad @ v1.0 (Apache-2.0 with additional conditions).

import { UtteranceSegmenter, concatFloat32 } from "../utils/audioSegmenter";

export const TEN_VAD_HOP = 256; // samples @ 16 kHz = 16 ms
export const TEN_VAD_SAMPLE_RATE = 16000;

/**
 * Streaming linear resampler with carry-over state across chunks, so
 * feeding a stream in many small chunks yields bit-identical output to
 * resampling it in one shot.
 */
export class LinearResampler {
    constructor(fromRate, toRate) {
        if (
            !Number.isFinite(fromRate) ||
            !Number.isFinite(toRate) ||
            fromRate <= 0 ||
            toRate <= 0
        ) {
            throw new Error("Invalid sample rates");
        }
        this._step = fromRate / toRate; // input samples per output sample
        this._passthrough = fromRate === toRate;
        this._nextPos = 0; // absolute input position of the next output
        // Two most recent input samples (absolute index + value); two are
        // needed because an output at a chunk boundary may interpolate
        // between the last two samples of the previous chunk.
        this._hist = [];
    }

    process(chunk) {
        if (!chunk || chunk.length === 0) return new Float32Array(0);
        if (this._passthrough) return new Float32Array(chunk);

        const start = this._hist.length
            ? this._hist[this._hist.length - 1].index + 1
            : 0;
        const end = start + chunk.length - 1;

        const out = [];
        while (this._nextPos + 1 <= end) {
            const i0 = Math.floor(this._nextPos);
            const frac = this._nextPos - i0;
            const a = this._sampleAt(i0, start, chunk);
            const b = this._sampleAt(i0 + 1, start, chunk);
            out.push(a + (b - a) * frac);
            this._nextPos += this._step;
        }

        this._hist = [
            { index: end - 1, value: chunk[chunk.length - 2] },
            { index: end, value: chunk[chunk.length - 1] },
        ];
        return Float32Array.from(out);
    }

    _sampleAt(absIndex, start, chunk) {
        for (const h of this._hist) {
            if (h.index === absIndex) return h.value;
        }
        return chunk[absIndex - start];
    }
}

export class TenVadEngine {
    constructor(module, { hopSize = TEN_VAD_HOP, threshold = 0.5 } = {}) {
        this._m = module;
        this._hop = hopSize;
        this._handlePtr = module._malloc(4);
        if (module._ten_vad_create(this._handlePtr, hopSize, threshold) !== 0) {
            module._free(this._handlePtr);
            throw new Error("ten_vad_create failed");
        }
        this._handle = module.HEAP32[this._handlePtr >> 2];
        this._audioPtr = module._malloc(hopSize * 2);
        this._probPtr = module._malloc(4);
        this._flagPtr = module._malloc(4);
    }

    /** Feed one Int16Array frame of exactly hopSize samples. */
    process(int16Frame) {
        if (int16Frame.length !== this._hop) {
            throw new Error(`Expected ${this._hop} samples, got ${int16Frame.length}`);
        }
        this._m.HEAP16.set(int16Frame, this._audioPtr >> 1);
        const rc = this._m._ten_vad_process(
            this._handle,
            this._audioPtr,
            this._hop,
            this._probPtr,
            this._flagPtr,
        );
        if (rc !== 0) return { probability: 0, isVoice: false };
        return {
            probability: this._m.HEAPF32[this._probPtr >> 2],
            isVoice: this._m.HEAP32[this._flagPtr >> 2] === 1,
        };
    }

    /** Fresh internal state (used at utterance boundaries). */
    reset() {
        this._m._ten_vad_destroy(this._handlePtr);
        if (this._m._ten_vad_create(this._handlePtr, this._hop, 0.5) !== 0) {
            throw new Error("ten_vad_create failed on reset");
        }
        this._handle = this._m.HEAP32[this._handlePtr >> 2];
    }

    version() {
        const ptr = this._m._ten_vad_get_version();
        let end = ptr;
        while (this._m.HEAPU8[end]) end++;
        let out = "";
        for (let i = ptr; i < end; i++) {
            out += String.fromCharCode(this._m.HEAPU8[i]);
        }
        return out;
    }

    destroy() {
        this._m._ten_vad_destroy(this._handlePtr);
        this._m._free(this._handlePtr);
        this._m._free(this._audioPtr);
        this._m._free(this._probPtr);
        this._m._free(this._flagPtr);
    }
}

export function floatToInt16(samples) {
    const out = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
}

/**
 * Resamples native-rate chunks to 16 kHz, frames them into hopSize hops,
 * classifies each hop with TEN VAD, and feeds (frame, probability) pairs
 * into an UtteranceSegmenter. Emits complete utterances at 16 kHz.
 */
export class VadPipeline {
    constructor({ sampleRate, module, segmenterOptions = {} }) {
        this._engine = new TenVadEngine(module);
        this._resampler = new LinearResampler(sampleRate, TEN_VAD_SAMPLE_RATE);
        this._segmenter = new UtteranceSegmenter(
            TEN_VAD_SAMPLE_RATE,
            segmenterOptions,
        );
        this._hop = TEN_VAD_HOP;
        this._pending = new Float32Array(0);
    }

    /** Feed a chunk of PCM at the native sample rate; returns completed utterances. */
    process(nativeChunk) {
        const resampled = this._resampler.process(nativeChunk);
        this._pending = concatFloat32([this._pending, resampled]);

        const segments = [];
        let offset = 0;
        while (this._pending.length - offset >= this._hop) {
            const frame = this._pending.slice(offset, offset + this._hop);
            offset += this._hop;
            const { probability } = this._engine.process(floatToInt16(frame));
            const segment = this._segmenter.process(frame, probability);
            if (segment) {
                segments.push(segment);
                // Fresh VAD state for the next utterance.
                this._engine.reset();
            }
        }
        if (offset > 0) {
            this._pending = this._pending.slice(offset);
        }
        return segments;
    }

    /** Force-close any open utterance (e.g. when the session stops). */
    flush() {
        const tail = this._segmenter.flush();
        if (tail) this._engine.reset();
        return tail;
    }

    /** TEN VAD library version string (for diagnostics). */
    version() {
        return this._engine.version();
    }

    destroy() {
        this._engine.destroy();
    }
}
