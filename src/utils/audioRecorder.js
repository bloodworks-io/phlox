// Audio capture via WebAudio API.

const TARGET_SAMPLE_RATE = 16000;
const PROCESSOR_BUFFER_SIZE = 4096;

export class AudioRecorder {
    constructor() {
        this.audioContext = null;
        this.source = null;
        this.processor = null;
        this.stream = null;
        this.chunks = [];
        this.isRecording = false;
        this.isPaused = false;
    }

    async start() {
        if (this.isRecording) {
            throw new Error("Already recording");
        }

        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
            },
        });

        this.audioContext = new AudioContext();
        this.source = this.audioContext.createMediaStreamSource(this.stream);

        this.processor = this.audioContext.createScriptProcessor(
            PROCESSOR_BUFFER_SIZE,
            1,
            1,
        );
        this.processor.onaudioprocess = (event) => {
            if (!this.isRecording || this.isPaused) return;
            const input = event.inputBuffer.getChannelData(0);
            this.chunks.push(new Float32Array(input));
        };

        this.source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);

        this.isRecording = true;
        this.isPaused = false;
    }

    pause() {
        if (!this.isRecording) return;
        this.isPaused = true;
    }

    resume() {
        this.isPaused = false;
    }

    async stop() {
        if (!this.isRecording) {
            throw new Error("Not recording");
        }
        this.isRecording = false;
        this.isPaused = false;

        // Tear down the WebAudio graph before we touch chunks.
        this.processor.onaudioprocess = null;
        try {
            this.source.disconnect();
            this.processor.disconnect();
        } catch {
            // disconnect() throws if already disconnected — ignore.
        }
        this.stream.getTracks().forEach((track) => track.stop());

        const nativeSampleRate = this.audioContext.sampleRate;
        await this.audioContext.close();

        const flat = flattenFloat32(this.chunks);
        this.chunks = [];

        const final =
            nativeSampleRate === TARGET_SAMPLE_RATE
                ? flat
                : resampleLinear(flat, nativeSampleRate, TARGET_SAMPLE_RATE);

        const wav = encodeWav(final, TARGET_SAMPLE_RATE);
        return new Blob([wav], { type: "audio/wav" });
    }
}


function flattenFloat32(chunks) {
    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const flat = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        flat.set(chunk, offset);
        offset += chunk.length;
    }
    return flat;
}


function resampleLinear(input, fromRate, toRate) {
    if (fromRate === toRate) return input;
    const ratio = toRate / fromRate;
    const outputLength = Math.floor(input.length * ratio);
    const output = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
        const srcIdx = i / ratio;
        const idx0 = Math.floor(srcIdx);
        const idx1 = Math.min(idx0 + 1, input.length - 1);
        const frac = srcIdx - idx0;
        output[i] = input[idx0] * (1 - frac) + input[idx1] * frac;
    }
    return output;
}

/// Write a standard 16-bit PCM WAV header + samples from Float32 in [-1, 1].
function encodeWav(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset, str) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    // RIFF chunk
    writeString(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, "WAVE");

    // fmt subchunk
    writeString(12, "fmt ");
    view.setUint32(16, 16, true); // subchunk size
    view.setUint16(20, 1, true); // audio format = PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample

    // data subchunk
    writeString(36, "data");
    view.setUint32(40, samples.length * 2, true);

    // Float32 [-1, 1] → Int16 [-32768, 32767]
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
    }

    return buffer;
}
