// Kaldi-style 80-bin fbank features for the CAM++ speaker embedding model.
// Browser stand-in for the kaldifeat preprocessing that sherpa-onnx performs
// for server/transcription/speakers.py: 25 ms frames / 10 ms shift, Povey
// window, preemphasis 0.97, DC removal, log mel, optional per-utterance CMVN.

export interface FbankOptions {
  sampleRate?: number;
  frameLengthMs?: number;
  frameShiftMs?: number;
  numBins?: number;
  fftSize?: number;
  removeDcOffset?: boolean;
  preemphCoeff?: number;
  snipEdges?: boolean;
  /** Lowest mel-filter edge in Hz (Kaldi default 20). */
  lowFreq?: number;
  /** Highest mel-filter edge in Hz; 0 maps to Nyquist (Kaldi default). */
  highFreq?: number;
  /** Per-utterance mean normalization over frames (Kaldi CMVN, deltas-free). */
  cmvn?: boolean;
}

export interface FbankResult {
  /** Row-major [numFrames * numBins] log-mel features. */
  feats: Float32Array;
  numFrames: number;
  numBins: number;
}

/** HTK/Kaldi mel scale: 2595·log10(1 + f/700). */
function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700);
}

function melToHz(mel: number): number {
  return 700 * (10 ** (mel / 2595) - 1);
}

/**
 * Triangular mel filterbank over FFT power bins, one triangle per feature
 * bin, edges evenly spaced on the mel scale (Kaldi MelBanks layout).
 */
function buildMelBanks(numBins: number, fftSize: number, sampleRate: number, lowFreq: number, highFreqHz: number): Float32Array[] {
  const numFftBins = fftSize / 2 + 1;
  const nyquist = sampleRate / 2;
  const highFreq = highFreqHz > 0 ? Math.min(highFreqHz, nyquist) : nyquist;
  const melLow = hzToMel(lowFreq);
  const melHigh = hzToMel(highFreq);
  const melStep = (melHigh - melLow) / (numBins + 1);

  const binToHz = (bin: number) => (bin * sampleRate) / fftSize;

  const banks: Float32Array[] = [];
  for (let b = 0; b < numBins; b++) {
    const left = melToHz(melLow + b * melStep);
    const center = melToHz(melLow + (b + 1) * melStep);
    const right = melToHz(melLow + (b + 2) * melStep);
    const weights = new Float32Array(numFftBins);
    for (let k = 0; k < numFftBins; k++) {
      const hz = binToHz(k);
      if (hz <= left || hz >= right) continue;
      weights[k] = hz <= center ? (hz - left) / (center - left) : (right - hz) / (right - center);
    }
    banks.push(weights);
  }
  return banks;
}

/** In-place iterative radix-2 complex FFT. Length must be a power of two. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

const ENERGY_FLOOR = 1e-10; // clamp before log (Kaldi log-energy floor spirit)

export function computeFbank(samples: Float32Array, options: FbankOptions = {}): FbankResult {
  const {
    sampleRate = 16000,
    frameLengthMs = 25,
    frameShiftMs = 10,
    numBins = 80,
    fftSize = 512,
    removeDcOffset = true,
    preemphCoeff = 0.97,
    snipEdges = true,
    lowFreq = 20,
    highFreq = 0,
    cmvn = true,
  } = options;

  const frameLength = Math.round((sampleRate * frameLengthMs) / 1000); // 400
  const frameShift = Math.round((sampleRate * frameShiftMs) / 1000); // 160
  if (samples.length < frameLength) return { feats: new Float32Array(0), numFrames: 0, numBins };

  const numFrames = snipEdges
    ? 1 + Math.floor((samples.length - frameLength) / frameShift)
    : Math.ceil(samples.length / frameShift);

  const banks = buildMelBanks(numBins, fftSize, sampleRate, lowFreq, highFreq);
  const numFftBins = fftSize / 2 + 1;
  const feats = new Float32Array(numFrames * numBins);

  // Povey window: Hann^0.85 (Kaldi default window type).
  const window = new Float64Array(frameLength);
  for (let i = 0; i < frameLength; i++) {
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frameLength - 1));
    window[i] = hann ** 0.85;
  }

  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const power = new Float64Array(numFftBins);

  for (let t = 0; t < numFrames; t++) {
    const start = t * frameShift;
    // DC removal + preemphasis + window, per Kaldi frame ordering.
    let mean = 0;
    if (removeDcOffset) {
      for (let i = 0; i < frameLength; i++) mean += samples[start + i];
      mean /= frameLength;
    }
    let prev = samples[start] - mean; // first sample preemphasizes against itself
    for (let i = 0; i < frameLength; i++) {
      const cur = samples[start + i] - mean;
      const emph = i === 0 ? cur : cur - preemphCoeff * prev;
      prev = cur;
      re[i] = emph * window[i];
      im[i] = 0;
    }
    for (let i = frameLength; i < fftSize; i++) {
      re[i] = 0;
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < numFftBins; k++) power[k] = re[k] * re[k] + im[k] * im[k];

    for (let b = 0; b < numBins; b++) {
      const bank = banks[b];
      let energy = 0;
      for (let k = 0; k < numFftBins; k++) energy += power[k] * bank[k];
      feats[t * numBins + b] = Math.log(Math.max(energy, ENERGY_FLOOR));
    }
  }

  if (cmvn && numFrames > 0) {
    // Mean normalization per bin over the utterance.
    const means = new Float64Array(numBins);
    for (let t = 0; t < numFrames; t++) {
      for (let b = 0; b < numBins; b++) means[b] += feats[t * numBins + b];
    }
    for (let b = 0; b < numBins; b++) means[b] /= numFrames;
    for (let t = 0; t < numFrames; t++) {
      for (let b = 0; b < numBins; b++) feats[t * numBins + b] -= means[b];
    }
  }

  return { feats, numFrames, numBins };
}
