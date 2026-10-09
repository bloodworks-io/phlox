// Port of server/transcription/speakers.py: best-effort speaker
// diarization for live utterance streams. The Python module delegates
// embedding extraction to sherpa-onnx (CAM++); here the vendored
// public/models/campplus-zh-en.onnx runs through onnxruntime-web with the
// Kaldi fbank frontend in ./fbank.

import { computeFbank } from "./fbank";

// "S1: ", "S12: ", "S?: " ... at the start of a transcript line. "S?" marks
// an utterance the diarizer saw but could not attribute (see SessionSpeakers).
export const SPEAKER_LINE_RE = /^(S[1-9]\d*|S\?):\s/;
export const UNKNOWN_SPEAKER = "S?";

export const SAMPLE_RATE = 16000;

// Strict match bar: CAM++ cross-speaker cosine on room mics can reach
// ~0.5, so 0.62 keeps a second voice from folding into an existing label
export const DEFAULT_THRESHOLD = 0.62;
// Below this, inherit the previous speaker: CAM++ embeddings of very short
// clips are unreliable, but 0.5s still labels quick back-channels.
export const MIN_UTTERANCE_SECONDS = 0.5;
export const MAX_SPEAKERS = 4;

// Recency weight for centroid updates
export const CENTROID_EMA_ALPHA = 0.3;

// Below this cosine a new voice is unambiguous
export const DISTANT_MINT_THRESHOLD = 0.3;

export const MODEL_URL = `${import.meta.env.BASE_URL}models/campplus-zh-en.onnx`;

export function formatSegment(speaker: string | null, text: string): string {
  return speaker ? `${speaker}: ${text}` : text;
}

export function splitSpeakerSegment(segment: string): { speaker: string | null; text: string } {
  const match = SPEAKER_LINE_RE.exec(segment);
  if (match) {
    return { speaker: match[1], text: segment.slice(match[0].length) };
  }
  return { speaker: null, text: segment };
}

export function hasSpeakerPrefixes(text: string): boolean {
  return text.split("\n").some((line) => SPEAKER_LINE_RE.test(line));
}

export function stripSpeakerPrefixes(text: string): string {
  return text.split("\n").map((line) => splitSpeakerSegment(line).text).join("\n");
}

export function speakerLegendHint(text: string): string {
  // Prompt legend explaining the labels, when the transcript has any.
  //
  // Kept quote-free so small models do not echo examples back.
  if (!hasSpeakerPrefixes(text)) return "";
  return (
    "Transcript lines are prefixed with speaker labels like S1 or S2 from " +
    "best-effort automatic diarization; the labels can be wrong or " +
    "missing, and S? marks an unattributed utterance. Use them only as " +
    "hints about who said what and never include the labels in your " +
    "output."
  );
}

/** Parse 16-bit PCM mono 16 kHz WAV bytes to Float32 samples in [-1, 1]. */
export function wavBytesToSamples(data: ArrayBuffer): Float32Array | null {
  try {
    const view = new DataView(data);
    if (data.byteLength < 44 || view.getUint32(0, true) !== 0x46464952) return null; // "RIFF"
    if (view.getUint32(8, true) !== 0x45564157) return null; // "WAVE"
    // Walk subchunks to the fmt/data pair (encodeWav output is minimal, but
    // do not assume ordering).
    let offset = 12;
    let format: number | null = null;
    let channels: number | null = null;
    let rate: number | null = null;
    let bits: number | null = null;
    let samples: Float32Array | null = null;
    while (offset + 8 <= data.byteLength) {
      const chunkId = view.getUint32(offset, true);
      const chunkSize = view.getUint32(offset + 4, true);
      const body = offset + 8;
      if (chunkId === 0x20746d66 && chunkSize >= 16) {
        // "fmt "
        format = view.getUint16(body, true);
        channels = view.getUint16(body + 2, true);
        rate = view.getUint32(body + 4, true);
        bits = view.getUint16(body + 14, true);
      } else if (chunkId === 0x61746164) {
        // "data"
        const bytes = Math.min(chunkSize, data.byteLength - body);
        const count = bytes >> 1;
        const out = new Float32Array(count);
        for (let i = 0; i < count; i++) out[i] = view.getInt16(body + i * 2, true) / 32768;
        samples = out;
      }
      offset = body + chunkSize + (chunkSize & 1);
    }
    if (format !== 1 || channels !== 1 || rate !== SAMPLE_RATE || bits !== 16) return null;
    return samples;
  } catch {
    return null;
  }
}

/**
 * Singleton wrapper around the CAM++ ONNX embedding extractor
 * (browser stand-in for the sherpa-onnx Diarizer in speakers.py).
 */
export class Diarizer {
  private session: unknown | null = null;
  private failed = false;
  private loading: Promise<unknown | null> | null = null;

  private load(): Promise<unknown | null> {
    if (this.session !== null || this.failed) return Promise.resolve(this.session);
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const ort = await import("onnxruntime-web");
        ort.env.wasm.wasmPaths = `${import.meta.env.BASE_URL}ort/`;
        const response = await fetch(MODEL_URL);
        if (!response.ok) throw new Error(`speaker model fetch failed (${response.status})`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        const session = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] });
        this.session = session;
        console.info("[speakers] diarization ready (model=campplus-zh-en.onnx)");
        return session;
      } catch (error) {
        this.failed = true;
        console.info(`[speakers] diarization unavailable: ${error}`);
        return null;
      } finally {
        this.loading = null;
      }
    })();
    return this.loading;
  }

  /** CAM++ embedding for one utterance of 16 kHz floats, or null. */
  async embed(samples: Float32Array): Promise<Float32Array | null> {
    const session = (await this.load()) as {
      run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array; dims: number[] }>>;
      inputNames: string[];
      outputNames: string[];
    } | null;
    if (session === null) return null;
    try {
      const { feats, numFrames, numBins } = computeFbank(samples);
      if (numFrames === 0) return null;
      const ort = await import("onnxruntime-web");
      // Input contract: x [N=1, T, 80] fbank → embedding [1, 192].
      const input = new ort.Tensor("float32", feats, [1, numFrames, numBins]);
      const output = await session.run({ [session.inputNames[0]]: input });
      const embedding = output[session.outputNames[0]];
      if (!embedding || embedding.dims.at(-1) !== 192) return null;
      return embedding.data;
    } catch (error) {
      console.warn(`[speakers] embedding failed: ${error}`);
      return null;
    }
  }
}

let diarizer: Diarizer | null = null;

export function getDiarizer(): Diarizer {
  if (diarizer === null) diarizer = new Diarizer();
  return diarizer;
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const norm = Math.sqrt(normA * normB);
  return norm ? dot / norm : 0;
}

/** Per-session anonymous speaker registry via centroid matching. */
export class SessionSpeakers {
  threshold: number;
  minDuration: number;
  maxSpeakers: number;
  emaAlpha: number;
  private centroids = new Map<string, Float32Array>();
  private lastLabel: string | null = null;
  // Unconfirmed new-voice candidate: minted as a label only when a later utterance matches it
  private pending: Float32Array | null = null;

  constructor(
    threshold: number = DEFAULT_THRESHOLD,
    minDuration: number = MIN_UTTERANCE_SECONDS,
    maxSpeakers: number = MAX_SPEAKERS,
    emaAlpha: number = CENTROID_EMA_ALPHA,
  ) {
    this.threshold = threshold;
    this.minDuration = minDuration;
    this.maxSpeakers = maxSpeakers;
    this.emaAlpha = emaAlpha;
  }

  get speakerCount(): number {
    return this.centroids.size;
  }

  /**
   * Label one utterance.
   *
   * Returns "S1".."S4", UNKNOWN_SPEAKER while a new voice is heard but
   * not yet confirmed, or null when diarization cannot contribute.
   */
  async assign(audioBytes: ArrayBuffer): Promise<string | null> {
    const samples = wavBytesToSamples(audioBytes);
    if (samples === null) return this.inherit();
    if (samples.length < this.minDuration * SAMPLE_RATE) return this.inherit();

    const embedding = await getDiarizer().embed(samples);
    if (embedding === null) return this.inherit();

    const [bestLabel, score] = this.bestMatch(embedding);
    const durationS = samples.length / SAMPLE_RATE;
    let label: string;
    let distantMint = false;
    if (this.centroids.size === 0) {
      label = `S${this.centroids.size + 1}`;
    } else if (score >= this.threshold && bestLabel !== null) {
      label = bestLabel;
    } else if (
      this.pending !== null &&
      cosine(embedding, this.pending) >= this.threshold &&
      this.centroids.size < this.maxSpeakers
    ) {
      // Second utterance consistent with the pending candidate:
      // confirmed — mint the label seeded from both embeddings.
      label = `S${this.centroids.size + 1}`;
      this.record(label, this.pending);
      this.pending = null;
    } else if (
      score < DISTANT_MINT_THRESHOLD &&
      this.centroids.size < this.maxSpeakers &&
      !(this.pending !== null && cosine(embedding, this.pending) >= DISTANT_MINT_THRESHOLD)
    ) {
      // Markedly different from every known voice: attribute now.
      label = `S${this.centroids.size + 1}`;
      distantMint = true;
    } else if (this.centroids.size >= this.maxSpeakers) {
      // Cap reached: keep the closest existing centroid (best effort)
      // rather than minting an implausible fifth speaker. The registry
      // is never empty here (cap >= 1), so the fallback is safe.
      label = bestLabel ?? `S${this.centroids.size + 1}`;
    } else {
      // Borderline: hold as pending (a newer outlier replaces a
      // stale one) and mark unattributed.
      this.pending = embedding;
      console.info(
        `Diarize ${durationS.toFixed(1)}s: best=${bestLabel} score=${score.toFixed(3)} threshold=${this.threshold.toFixed(2)} -> S? (pending)`,
      );
      return UNKNOWN_SPEAKER;
    }
    console.info(
      `Diarize ${durationS.toFixed(1)}s: best=${bestLabel} score=${score.toFixed(3)} threshold=${this.threshold.toFixed(2)} -> ${label}${distantMint ? " (distant)" : ""}`,
    );
    this.record(label, embedding);
    this.lastLabel = label;
    return label;
  }

  /** Short/unusable audio: assume the previous speaker said it. */
  private inherit(): string | null {
    return this.lastLabel;
  }

  private bestMatch(embedding: Float32Array): [string | null, number] {
    let bestLabel: string | null = null;
    let bestScore = -1;
    for (const [label, centroid] of this.centroids) {
      const score = cosine(embedding, centroid);
      if (score > bestScore) {
        bestLabel = label;
        bestScore = score;
      }
    }
    return [bestLabel, bestScore];
  }

  private record(label: string, embedding: Float32Array): void {
    const centroid = this.centroids.get(label);
    if (centroid === undefined) {
      this.centroids.set(label, Float32Array.from(embedding));
      return;
    }
    const alpha = this.emaAlpha;
    const updated = new Float32Array(centroid.length);
    for (let i = 0; i < centroid.length; i++) {
      updated[i] = (1 - alpha) * centroid[i] + alpha * embedding[i];
    }
    this.centroids.set(label, updated);
  }
}

/** Default session registry factory (mirrors speakers.py:create_session_speakers). */
export function createSessionSpeakers(): SessionSpeakers {
  return new SessionSpeakers();
}
