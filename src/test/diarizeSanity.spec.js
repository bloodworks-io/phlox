// @vitest-environment node
// CAM++ diarization sanity: validates the JS fbank preprocessing against the
// vendored campplus-zh-en.onnx using two distinct TTS voices. Fixtures are
// generated on macOS with:
//   say -v Daniel    -o /tmp/diarize-sanity/d1.wav --data-format=LEI16@16000 "..."
//   say -v Samantha  -o /tmp/diarize-sanity/s1.wav --data-format=LEI16@16000 "..."
// (skipped when the fixtures are absent, e.g. CI).
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { computeFbank } from "../localBackend/fbank";
import { wavBytesToSamples, cosine } from "../localBackend/speakers";

const FIXTURE_DIR = "/tmp/diarize-sanity";
const FIXTURES = ["d1", "d2", "s1", "s2"];
const haveFixtures = FIXTURES.every((name) => existsSync(`${FIXTURE_DIR}/${name}.wav`));

describe.skipIf(!haveFixtures)("CAM++ diarization sanity (macOS say fixtures)", () => {
    it("separates the two voices under the chosen preprocessing", async () => {
        const ort = await import("onnxruntime-web");
        const modelBytes = readFileSync("public/models/campplus-zh-en.onnx");
        const session = await ort.InferenceSession.create(new Uint8Array(modelBytes), {
            executionProviders: ["wasm"],
        });

        const embed = async (file, fbankOptions) => {
            const buffer = readFileSync(file);
            const samples = wavBytesToSamples(
                buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
            );
            expect(samples).not.toBeNull();
            const { feats, numFrames, numBins } = computeFbank(samples, fbankOptions);
            expect(numBins).toBe(80);
            const input = new ort.Tensor("float32", feats, [1, numFrames, numBins]);
            const output = await session.run({ [session.inputNames[0]]: input });
            const embedding = output[session.outputNames[0]];
            expect(embedding.dims.at(-1)).toBe(192);
            return embedding.data;
        };

        const report = {};
        for (const cmvn of [false, true]) {
            const [d1, d2, s1, s2] = await Promise.all(
                FIXTURES.map((name) => embed(`${FIXTURE_DIR}/${name}.wav`, { cmvn })),
            );
            const same = [cosine(d1, d2), cosine(s1, s2)];
            const cross = [cosine(d1, s1), cosine(d1, s2), cosine(d2, s1), cosine(d2, s2)];
            const sameMean = same.reduce((a, b) => a + b, 0) / same.length;
            const crossMean = cross.reduce((a, b) => a + b, 0) / cross.length;
            report[`cmvn=${cmvn}`] = {
                sameVoice: same.map((v) => v.toFixed(3)).join("/"),
                crossVoice: cross.map((v) => v.toFixed(3)).join("/"),
                margin: (sameMean - crossMean).toFixed(3),
            };
        }
        console.info("[diarize sanity]", JSON.stringify(report, null, 2));

        // The shipped preprocessing (CMVN on) must separate the two voices.
        const [d1, d2, s1, s2] = await Promise.all(
            FIXTURES.map((name) => embed(`${FIXTURE_DIR}/${name}.wav`, { cmvn: true })),
        );
        const sameMin = Math.min(cosine(d1, d2), cosine(s1, s2));
        const crossMax = Math.max(cosine(d1, s1), cosine(d1, s2), cosine(d2, s1), cosine(d2, s2));
        expect(sameMin).toBeGreaterThan(crossMax);
        expect(sameMin).toBeGreaterThan(0.5);
        expect(crossMax).toBeLessThan(0.5);
    });
});
