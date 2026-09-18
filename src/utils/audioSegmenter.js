// Utterance segmentation via RMS energy voice-activity detection.

const DEFAULTS = {
    // Low threshold: noiseSuppression runs upstream.
    threshold: 0.012,
    speechStartMs: 250,
    silenceEndMs: 600,
    minSpeechMs: 300,
    // Force-close mid-speech so segments stay small for live streaming.
    maxSegmentMs: 15000,
};

export class UtteranceSegmenter {
    constructor(sampleRate, options = {}) {
        this.sampleRate = sampleRate;
        this.options = { ...DEFAULTS, ...options };

        this._buffers = []; // Float32Array chunks of the current utterance
        this._preRoll = []; // loud chunks buffered while opening an utterance
        this._speechSamples = 0;
        this._loudStreak = 0;
        this._quietStreak = 0;
        this._totalSamples = 0;
        this._speaking = false;
    }

    _msToBuffers(ms) {
        return Math.max(1, Math.round((ms / 1000) * this.sampleRate));
    }

    /**
     * Feed one chunk of PCM samples.
     * Returns a Float32Array of the complete utterance when one closes,
     * or null while an utterance is still open / nothing was said.
     */
    process(chunk) {
        if (chunk && chunk.length > 0) {
            chunk = new Float32Array(chunk);
        }
        const rms = computeRms(chunk);
        const opts = this.options;

        if (!this._speaking) {
            if (rms >= opts.threshold) {
                this._loudStreak += chunk.length;
                this._preRoll.push(chunk);
                if (this._loudStreak >= this._msToBuffers(opts.speechStartMs)) {
                    this._speaking = true;
                    this._buffers.push(...this._preRoll);
                    this._preRoll = [];
                    this._speechSamples = this._loudStreak;
                    this._totalSamples = this._loudStreak;
                    this._quietStreak = 0;
                }
            } else {
                this._loudStreak = 0;
                this._preRoll = [];
            }
            return null;
        }

        // Speaking: accumulate while deciding whether to close.
        this._buffers.push(chunk);
        this._totalSamples += chunk.length;

        if (rms >= opts.threshold) {
            this._speechSamples += chunk.length;
            this._quietStreak = 0;
        } else {
            this._quietStreak += chunk.length;
        }

        const closedBySilence =
            this._quietStreak >= this._msToBuffers(opts.silenceEndMs);
        const closedByLength =
            this._totalSamples >= this._msToBuffers(opts.maxSegmentMs);

        if (closedBySilence || closedByLength) {
            const segment = this._emit();
            // Length-capped segments resume immediately (mid-speech); the
            // closing chunk was already emitted, so start a fresh buffer.
            if (closedByLength && !closedBySilence) {
                this._speaking = true;
                this._buffers = [];
                this._speechSamples = 0;
                this._totalSamples = 0;
                this._quietStreak = 0;
                this._loudStreak = 0;
            }
            return segment;
        }
        return null;
    }

    /** Force-close any open utterance (e.g. when recording stops). */
    flush() {
        if (!this._speaking) return null;
        return this._emit();
    }

    _emit() {
        this._speaking = false;
        const hadEnough =
            this._speechSamples >= this._msToBuffers(this.options.minSpeechMs);
        const buffers = this._buffers;
        this._buffers = [];
        this._preRoll = [];
        this._speechSamples = 0;
        this._totalSamples = 0;
        this._loudStreak = 0;
        this._quietStreak = 0;
        if (!hadEnough) return null;
        return concatFloat32(buffers);
    }
}

export function computeRms(chunk) {
    if (!chunk || chunk.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < chunk.length; i++) {
        sum += chunk[i] * chunk[i];
    }
    return Math.sqrt(sum / chunk.length);
}

export function concatFloat32(chunks) {
    const total = chunks.reduce((acc, c) => acc + c.length, 0);
    const out = new Float32Array(total);
    let offset = 0;
    for (const c of chunks) {
        out.set(c, offset);
        offset += c.length;
    }
    return out;
}
