// Web worker hosting the TEN VAD pipeline: receives native-rate PCM chunks
// from the recorder, posts back complete utterances (16 kHz Float32).

import createVADModule from "./ten-vad/ten_vad.js";
import { VadPipeline } from "./vadPipeline";

let pipeline = null;

self.onmessage = async (event) => {
    const msg = event.data;
    try {
        if (msg.type === "init") {
            // Bare call: the glue resolves ten_vad.wasm relative to its own
            // URL, which Vite rewrites to the emitted asset in both dev and
            // build (with an ArrayBuffer fallback if streaming fails).
            const module = await createVADModule();
            pipeline = new VadPipeline({
                sampleRate: msg.sampleRate,
                segmenterOptions: msg.segmenterOptions,
                module,
            });
            self.postMessage({ type: "ready", version: pipeline.version() });
        } else if (msg.type === "audio") {
            const segments = pipeline.process(msg.samples);
            for (const segment of segments) {
                self.postMessage(
                    { type: "segment", samples: segment },
                    [segment.buffer],
                );
            }
        } else if (msg.type === "flush") {
            const tail = pipeline ? pipeline.flush() : null;
            if (tail) {
                self.postMessage(
                    { type: "flushed", segment: tail },
                    [tail.buffer],
                );
            } else {
                self.postMessage({ type: "flushed", segment: null });
            }
        }
    } catch (error) {
        self.postMessage({
            type: "error",
            message: String(error && error.message ? error.message : error),
        });
    }
};
