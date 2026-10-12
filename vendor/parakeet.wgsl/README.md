# parakeet.wgsl

High-performance inference of NVIDIA's [Parakeet TDT 0.6B V2](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2) English transcription model, in the browser.

A fully custom, dependancy-free implementation with raw WebGPU compute shaders and SIMD WebAssembly audio frontend.

1 hour of audio transcribed in 8.4 seconds (Apple M5 Max, Safari 26.6).

Scores 1.69% and 3.19% WER on LibriSpeech `test-clean` and `test-other`,
respectively, matching
[NVIDIA's reported results](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2#performance)

Try the [live demo](https://parakeet.narcotic.sh/)

## Installation & Usage

```bash
npm install parakeet.wgsl
```

The package is ESM-only and requires a WebGPU-capable browser in a secure
context (HTTPS or localhost).

Save the following as `index.html`:

```html
<!doctype html>
<html lang="en">
  <head><title>parakeet.wgsl</title></head>
  <body>
    <input id="audio" type="file" />
    <button id="transcribe" type="button">Transcribe</button>
    <pre id="output" style="white-space: pre-wrap"></pre>
    <script type="module">
      import { createTranscriber } from "parakeet.wgsl";

      const output = document.querySelector("#output");
      const transcriber = createTranscriber({
        onLoadProgress: ({ phase, fraction }) => {
          if (phase === "weights") {
            output.textContent = `Loading model... ${Math.round(100 * fraction)}%`;
          }
        },
      });

      document.querySelector("#transcribe").onclick = async () => {
        output.textContent = "Transcribing...";
        const result = await transcriber.transcribe(
          document.querySelector("#audio").files[0],
          {
            onProgress: ({ fraction }) => {
              output.textContent = `Transcribing... ${Math.round(100 * fraction)}%`;
            },
          },
        );
        output.textContent = `Transcription time: ${(
          result.metrics.totalMs / 1000
        ).toFixed(2)} seconds\n\n${result.text}`;
      };
    </script>
  </body>
</html>
```

Run:

```bash
npx vite --open
```

See
[DOCS.md](https://github.com/narcotic-sh/parakeet.wgsl/blob/main/DOCS.md) for
the complete API, including progress and live transcripts, cancellation,
model-cache management, timestamp rendering, and self-hosting.

The repository also includes a complete
[local demo](https://github.com/narcotic-sh/parakeet.wgsl/tree/main/demo) that
consumes the built package through the same boundary as an external
application.

## Audio support

`transcribe()` accepts an audio `File` or `Blob`. Its canonical input format is
a 16 kHz mono signed PCM16 WAV.

Other supported inputs are decoded, downmixed, and resampled by the package's
reduced, audio-only FFmpeg core. Supported inputs include:

- MP3
- AAC or ALAC in M4A, MP4, or CAF
- Opus or Vorbis in WebM, Matroska, or Ogg
- FLAC
- WAV, AIFF, AIFF-C, and CAF PCM
- WavPack

These inputs require the Origin Private File System (OPFS) and sufficient
temporary origin storage for the decoded audio.

## Technical details

Model inference is implemented with custom WebGPU compute shaders.
A purpose-built WebAssembly frontend performs filter-bank extraction.

Canonical WAV files stream directly into the inference frontend.
For noncanonical inputs, audio decoding and model inference run in a pipelined
fashion. FFmpeg decodes the recording into bounded, immutable PCM segments in
OPFS, and each completed segment is made available to inference as soon as it
is ready. Temporary segments are removed when the operation finishes.

WebGPU capability selection is automatic. An adapter with `shader-f16` uses
the FP16 model; all others use FP32. Compatible fixed-width subgroups use the
subgroup kernels, while other supported adapters use portable workgroup
kernels. These decisions are fixed for a transcriber's lifetime, and only the
selected model package is downloaded.

Inference currently runs fastest in Chrome and Safari. Firefox is supported
but substantially slower (at least on Mac), and performance in other browsers
may vary. This is likely explained by differences in WebGPU implementations of
browsers.

A cold initialization downloads approximately 405 MB for FP16 or 441 MB for
FP32. The packages reach these sizes with a custom k-means palette format,
informed by FluidInference's
[Möbius](https://github.com/FluidInference/mobius) model-conversion work.
Most model weights are stored as bit-packed 5- or 6-bit indices with
precision-specific lookup tables.

Model weights are loaded incrementally into GPU buffers and verified before
use. Cache Storage can retain verified model assets for later visits, while
later transcriptions on the same transcriber reuse the GPU-resident model.

The long-form transcription policy is derived from the excellent
[FluidAudio](https://github.com/FluidInference/FluidAudio) project. It uses
fixed inference windows, timestamp-aware overlap merging, adaptive
speech-energy gating, and bounded seam repair.

## Accuracy benchmark

The reproducible
[LibriSpeech benchmark](https://github.com/narcotic-sh/parakeet.wgsl/tree/main/benchmark)
evaluates the complete `test-clean` and `test-other` splits with a pinned
dataset and scorers.

## Development

```bash
pnpm install
pnpm test
pnpm build
pnpm verify:package
pnpm demo
```

See [model/README.md](https://github.com/narcotic-sh/parakeet.wgsl/blob/main/model/README.md)
to reproduce or mirror the canonical model packages.

Native audio component
architecture and rebuild instructions are in
[src/cpp/README.md](https://github.com/narcotic-sh/parakeet.wgsl/blob/main/src/cpp/README.md).

## License

The project's source is MIT licensed. The separately hosted model packages are
modified forms of NVIDIA Parakeet TDT 0.6B v2 under CC BY 4.0. Complete
third-party attribution and license terms are in
[THIRD_PARTY_LICENSES](https://github.com/narcotic-sh/parakeet.wgsl/blob/main/THIRD_PARTY_LICENSES).

## Acknowledgements
Thank you to my friend [Akki](https://tcombinator.dev/) for running and sharing the result of the 1 hr audio benchmark on his Apple M5 MacBook.
