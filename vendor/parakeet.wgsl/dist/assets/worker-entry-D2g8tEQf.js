var ue = class extends Error {
	constructor(e) {
		super(e), this.name = "WavFormatError";
	}
}, zu = class {
	blob;
	size;
	reusableReadBufferBytes = 32e4;
	reusable = /* @__PURE__ */ new Uint8Array(32e4);
	consumeTail = Promise.resolve();
	constructor(e) {
		this.blob = e, this.size = e.size;
	}
	async read(e, t) {
		return Ya(e, t, this.size, "byte"), this.blob.slice(e, e + t).arrayBuffer();
	}
	consume(e, t, r) {
		Ya(e, t, this.size, "byte");
		const a = this.consumeTail.then(() => this.consumeUnlocked(e, t, r));
		return this.consumeTail = a.catch(() => {}), a;
	}
	async consumeUnlocked(e, t, r) {
		if (t === 0) return;
		const a = this.blob.slice(e, e + t).stream().getReader({ mode: "byob" });
		let n = 0, o;
		try {
			for (; n < t;) {
				const s = await a.read(this.reusable), i = s.value;
				if (s.done || i === void 0 || i.byteLength === 0) throw new ue(`short Blob read: expected ${t} bytes, got ${n}`);
				if (i.byteOffset !== 0 || i.buffer.byteLength !== this.reusableReadBufferBytes || i.byteLength > t - n) throw new ue("unexpected Blob BYOB backing-store behavior");
				r(i), n += i.byteLength, this.reusable = new Uint8Array(i.buffer);
			}
		} catch (s) {
			o = { error: s };
		}
		try {
			o === void 0 ? await a.cancel() : await a.cancel(o.error);
		} catch (s) {
			o ??= { error: s };
		}
		try {
			a.releaseLock();
		} catch (s) {
			o ??= { error: s };
		}
		if (this.reusable.byteLength === 0 && (this.reusable = /* @__PURE__ */ new Uint8Array(32e4)), o !== void 0) throw o.error;
	}
}, ju = class As {
	source;
	info;
	constructor(t, r) {
		this.source = t, this.info = r;
	}
	static async open(t) {
		const r = Zu(t) ? t : new zu(t);
		return new As(r, await Ku(r));
	}
	get sampleRate() {
		return this.info.sampleRate;
	}
	get sampleCount() {
		return this.info.sampleCount;
	}
	get reusableReadBufferBytes() {
		return to(this.source) ? this.source.reusableReadBufferBytes : 0;
	}
	async readSamplesInto(t, r, a = 0, n = r.length - a) {
		if (Xu(t, n), !Number.isSafeInteger(a) || a < 0) throw new RangeError("targetOffset must be a non-negative safe integer");
		if (a + n > r.length) throw new RangeError("target range exceeds the destination array");
		const o = Qu(t, n, this.info.sampleCount);
		if (o === 0) return 0;
		const s = this.info.dataOffset + t * 2;
		if (to(this.source)) return await Hu(this.source, s, o, r, a), o;
		let i = 0;
		for (; i < o;) {
			const u = Math.min(16e4, o - i), l = u * 2, c = await this.source.read(s + i * 2, l);
			if (c.byteLength !== l) throw new ue(`short WAV read: expected ${l} bytes, got ${c.byteLength}`);
			Vu(new Uint8Array(c), r, a + i), i += u;
		}
		return i;
	}
};
async function Hu(e, t, r, a, n) {
	let o = 0, s;
	if (await e.consume(t, r * 2, (i) => {
		let u = 0;
		if (s !== void 0) {
			const d = s | i[0] << 8;
			a[n + o] = (d >= 32768 ? d - 65536 : d) / 32768, o += 1, s = void 0, u = 1;
		}
		const l = i.byteLength - (i.byteLength - u & 1), c = new DataView(i.buffer, i.byteOffset, i.byteLength);
		for (; u < l; u += 2) a[n + o] = c.getInt16(u, !0) / 32768, o += 1;
		u < i.byteLength && (s = i[u]);
	}), s !== void 0 || o !== r) throw new ue(`reusable WAV read decoded ${o}/${r} samples`);
}
function Vu(e, t, r) {
	if ((e.byteLength & 1) !== 0) throw new ue("PCM16 byte range has an odd length");
	const a = new DataView(e.buffer, e.byteOffset, e.byteLength);
	for (let n = 0; n < e.byteLength; n += 2) t[r + n / 2] = a.getInt16(n, !0) / 32768;
}
async function Ku(e) {
	if (!Number.isSafeInteger(e.size) || e.size < 12) throw new ue("WAV is too small to contain a RIFF header");
	const t = await Ta(e, 0, 12);
	if (La(t, 0) !== "RIFF" || La(t, 8) !== "WAVE") throw new ue("expected a RIFF/WAVE file");
	const r = t.getUint32(4, !0) + 8;
	if (r > e.size) throw new ue("RIFF container extends past EOF");
	const a = Math.min(e.size, r);
	let n, o, s, i = 12, u = 0;
	for (; i + 8 <= a;) {
		if (u += 1, u > 1e6) throw new ue("unreasonable number of RIFF chunks");
		const c = await Ta(e, i, 8), d = La(c, 0), h = c.getUint32(4, !0), f = i + 8;
		if (h > a - f) throw new ue(`WAV chunk ${d} extends past EOF`);
		if (d === "fmt ") {
			if (h < 16) throw new ue("WAV fmt chunk is shorter than 16 bytes");
			const _ = await Ta(e, f, 16);
			n = {
				audioFormat: _.getUint16(0, !0),
				channels: _.getUint16(2, !0),
				sampleRate: _.getUint32(4, !0),
				byteRate: _.getUint32(8, !0),
				blockAlign: _.getUint16(12, !0),
				bitsPerSample: _.getUint16(14, !0)
			};
		} else d === "data" && o === void 0 && (o = f, s = h);
		if (n !== void 0 && o !== void 0) break;
		const p = f + (h + (h & 1));
		if (!Number.isSafeInteger(p) || p <= i || p > a) throw new ue("invalid RIFF chunk size or padding");
		i = p;
	}
	if (n === void 0 || o === void 0 || s === void 0) throw new ue("WAV must contain fmt and data chunks");
	if (Yu(n), (s & 1) !== 0) throw new ue("PCM16 data chunk has an odd byte length");
	return {
		sampleRate: 16e3,
		channels: 1,
		bitsPerSample: 16,
		sampleCount: s / 2,
		dataOffset: o,
		dataByteLength: s
	};
}
function Yu(e) {
	if (e.audioFormat !== 1) throw new ue(`unsupported WAV encoding ${e.audioFormat}; expected integer PCM`);
	if (e.channels !== 1) throw new ue(`unsupported channel count ${e.channels}; expected mono`);
	if (e.sampleRate !== 16e3) throw new ue(`unsupported sample rate ${e.sampleRate}; expected 16000 Hz`);
	if (e.bitsPerSample !== 16) throw new ue(`unsupported bit depth ${e.bitsPerSample}; expected PCM16`);
	if (e.blockAlign !== 2) throw new ue(`invalid PCM16 block alignment ${e.blockAlign}`);
	if (e.byteRate !== 16e3 * 2) throw new ue(`invalid PCM16 byte rate ${e.byteRate}`);
}
async function Ta(e, t, r) {
	Ya(t, r, e.size, "byte");
	const a = await e.read(t, r);
	if (a.byteLength !== r) throw new ue(`short WAV read: expected ${r} bytes, got ${a.byteLength}`);
	return new DataView(a);
}
function La(e, t) {
	return String.fromCharCode(e.getUint8(t), e.getUint8(t + 1), e.getUint8(t + 2), e.getUint8(t + 3));
}
function Zu(e) {
	return "read" in e && typeof e.read == "function";
}
function to(e) {
	return "consume" in e && typeof e.consume == "function" && "reusableReadBufferBytes" in e && e.reusableReadBufferBytes === 32e4;
}
function Ya(e, t, r, a) {
	if (!Number.isSafeInteger(e) || e < 0) throw new RangeError(`${a} offset must be a non-negative safe integer`);
	if (!Number.isSafeInteger(t) || t < 0) throw new RangeError(`${a} length must be a non-negative safe integer`);
	if (e + t > r) throw new RangeError(`${a} range exceeds source size`);
}
function Xu(e, t) {
	if (!Number.isSafeInteger(e) || e < 0) throw new RangeError("startSample must be a non-negative safe integer");
	if (!Number.isSafeInteger(t) || t < 0) throw new RangeError("sampleCount must be a non-negative safe integer");
}
function Qu(e, t, r) {
	return e >= r ? 0 : Math.min(t, r - e);
}
const ro = Math.floor(24e4 / 1280), Hr = /* @__PURE__ */ new Map();
function tl(e, t) {
	if (oo(t), e === void 0 || (oo(e), e.sampleCount !== t.sampleCount)) return 0;
	const r = t.startSample - e.startSample;
	if (r <= 0 || r >= t.sampleCount || r % 160 !== 0) return 0;
	const a = r / 160;
	return a < Ts(t.validSampleCount ?? t.sampleCount) ? a : 0;
}
function ao(e) {
	if (!Number.isSafeInteger(e) || e < 0) throw new RangeError("sampleCount must be a non-negative safe integer");
	return Math.floor(e / 160) + 1;
}
function Ts(e) {
	if (!Number.isSafeInteger(e) || e < 0) throw new RangeError("sampleCount must be a non-negative safe integer");
	return Math.floor(e / 160);
}
var rl = class oa {
	memoryStats;
	hopSamples;
	exports;
	input;
	output;
	rmsBits;
	activeBatch;
	constructor(t) {
		if (t._initialize(), t.parakeet_fbank_init() !== 1) throw new Error("failed to initialize Parakeet FBank Wasm");
		const r = t.parakeet_fbank_max_batch(), a = t.parakeet_fbank_max_samples(), n = t.parakeet_fbank_max_frames(), o = t.parakeet_fbank_bins(), s = t.parakeet_fbank_sample_rate(), i = t.parakeet_fbank_hop_length(), u = t.parakeet_fbank_rms_frame_samples(), l = t.parakeet_fbank_max_rms_frames();
		if (r !== 40 || a !== 24e4 || n !== 1501 || o !== 128 || s !== 16e3 || i !== 160 || u !== 1280 || l !== ro) throw new Error("Parakeet FBank Wasm constants do not match the TypeScript runtime");
		const c = a, d = n * o;
		this.input = no(t.memory, t.parakeet_fbank_input_ptr(), c, "input"), this.output = no(t.memory, t.parakeet_fbank_output_ptr(), d, "output"), this.rmsBits = nl(t.memory, t.parakeet_fbank_rms_bits_ptr(), l, "RMS-bit"), this.exports = t, this.hopSamples = i, this.memoryStats = {
			heapBytes: t.memory.buffer.byteLength,
			inputCapacitySamples: c,
			outputCapacityValues: d,
			maxBatchSize: r,
			maxInputSamples: a,
			maxFramesPerWindow: n,
			rmsFrameSamples: u,
			maxRmsFramesPerWindow: l
		};
	}
	static async create(t, r) {
		const a = await al(t, r);
		return r?.throwIfAborted(), oa.fromInstance(await WebAssembly.instantiate(a, {}));
	}
	static async fromBytes(t) {
		const r = await WebAssembly.instantiate(t, {}), a = r instanceof WebAssembly.Instance ? r : r.instance;
		return oa.fromInstance(a);
	}
	static fromInstance(t) {
		return new oa(t.exports);
	}
	beginPreparedBatch(t, r) {
		if (this.validateShape(t, r), this.activeBatch !== void 0) throw new Error("Parakeet FBank batch is already active");
		const a = ao(r), n = this.requireExports().parakeet_fbank_begin_batch(t, r);
		if (n !== a) throw new Error(`Parakeet FBank Wasm failed to begin batch (${n}); expected ${a} frames`);
		return this.activeBatch = {
			batchSize: t,
			sampleCount: r,
			frameCount: n,
			nextBatchIndex: 0,
			lastReusedRawFrames: 0
		}, this.requireInput().subarray(0, r);
	}
	computePreparedItem(t, r = {}) {
		const a = this.requireActiveBatch();
		if (!Number.isSafeInteger(t) || t !== a.nextBatchIndex) throw new RangeError(`FBank item index must be ${a.nextBatchIndex}`);
		const n = r.validSampleCount ?? a.sampleCount;
		if (!Number.isSafeInteger(n) || n < 0 || n > a.sampleCount) throw new RangeError("validSampleCount must be in [0, sampleCount]");
		const o = Ts(n), s = r.reusableFrameShift ?? 0;
		if (!Number.isSafeInteger(s) || s < 0 || s !== 0 && s >= o) throw new RangeError("reusableFrameShift must be zero or below the valid frame count");
		const i = this.requireExports(), u = i.parakeet_fbank_compute_item(t, n, s);
		if (u !== a.frameCount) throw new Error(`Parakeet FBank Wasm failed item ${t} (${u}); expected ${a.frameCount} frames`);
		const l = i.parakeet_fbank_last_reused_frames(), c = l - a.lastReusedRawFrames;
		a.lastReusedRawFrames = l, a.nextBatchIndex += 1;
		const d = 128 * u;
		return {
			data: this.requireOutput().subarray(0, d),
			batchIndex: t,
			binCount: 128,
			frameCount: u,
			validFrameCount: o,
			reusedRawFrames: c,
			layout: "feature-frame"
		};
	}
	computeRmsBits(t, r) {
		const a = this.requireActiveBatch();
		if (!Number.isSafeInteger(t) || t < 0 || !Number.isSafeInteger(r) || r < 0 || r > ro || t + r * 1280 > a.sampleCount) throw new RangeError("RMS frame range must fit the active FBank PCM item");
		const n = this.requireExports().parakeet_fbank_compute_rms_bits(t, r);
		if (n !== r) throw new Error(`Parakeet FBank Wasm failed RMS range (${n}); expected ${r} frames`);
		return this.requireRmsBits().subarray(0, r);
	}
	finishPreparedBatch() {
		const t = this.requireActiveBatch();
		if (t.nextBatchIndex !== t.batchSize) throw new Error(`FBank batch has ${t.nextBatchIndex}/${t.batchSize} items`);
		const r = this.requireExports().parakeet_fbank_finish_batch();
		if (r !== t.frameCount) throw new Error(`Parakeet FBank Wasm failed to finish batch (${r})`);
		this.activeBatch = void 0;
	}
	compute(t, r = 0) {
		this.beginPreparedBatch(1, t.length).set(t);
		const a = this.computePreparedItem(0, { reusableFrameShift: r });
		return this.finishPreparedBatch(), a;
	}
	resetReuse() {
		this.requireExports().parakeet_fbank_reset_reuse(), this.activeBatch = void 0;
	}
	dispose() {
		this.exports !== void 0 && (this.exports.parakeet_fbank_dispose(), this.exports = void 0, this.input = void 0, this.output = void 0, this.rmsBits = void 0, this.activeBatch = void 0);
	}
	validateShape(t, r) {
		if (!Number.isSafeInteger(t) || t < 1 || t > this.memoryStats.maxBatchSize) throw new RangeError(`batchSize must be in [1, ${this.memoryStats.maxBatchSize}]`);
		if (!Number.isSafeInteger(r) || r < this.hopSamples || r > this.memoryStats.maxInputSamples) throw new RangeError(`sampleCount must be in [${this.hopSamples}, ${this.memoryStats.maxInputSamples}]`);
		if (ao(r) > this.memoryStats.maxFramesPerWindow) throw new RangeError(`sampleCount produces more than ${this.memoryStats.maxFramesPerWindow} frames`);
	}
	requireExports() {
		if (this.exports === void 0) throw new Error("ParakeetFbankWasm has been disposed");
		return this.exports;
	}
	requireInput() {
		if (this.input === void 0) throw new Error("ParakeetFbankWasm has been disposed");
		return this.input;
	}
	requireOutput() {
		if (this.output === void 0) throw new Error("ParakeetFbankWasm has been disposed");
		return this.output;
	}
	requireRmsBits() {
		if (this.rmsBits === void 0) throw new Error("ParakeetFbankWasm has been disposed");
		return this.rmsBits;
	}
	requireActiveBatch() {
		if (this.requireExports(), this.activeBatch === void 0) throw new Error("Parakeet FBank batch is not active");
		return this.activeBatch;
	}
};
function al(e, t) {
	const r = String(e), a = Hr.get(r);
	if (a !== void 0) return a;
	const n = fetch(r, t === void 0 ? void 0 : { signal: t }).then(async (o) => {
		if (!o.ok) throw new Error(`HTTP ${o.status} fetching Parakeet FBank Wasm`);
		try {
			return await WebAssembly.compileStreaming(o.clone());
		} catch {
			return t?.throwIfAborted(), WebAssembly.compile(await o.arrayBuffer());
		}
	});
	return Hr.set(r, n), n.catch(() => {
		Hr.get(r) === n && Hr.delete(r);
	}), n;
}
function no(e, t, r, a) {
	return Ls(e, t, r, Float32Array.BYTES_PER_ELEMENT, a), new Float32Array(e.buffer, t, r);
}
function nl(e, t, r, a) {
	return Ls(e, t, r, Uint32Array.BYTES_PER_ELEMENT, a), new Uint32Array(e.buffer, t, r);
}
function Ls(e, t, r, a, n) {
	if (!Number.isSafeInteger(t) || t < 0 || t % a) throw new Error(`unaligned Parakeet FBank Wasm ${n} pointer`);
	const o = t + r * a;
	if (!Number.isSafeInteger(r) || r < 0 || o > e.buffer.byteLength) throw new Error(`Parakeet FBank Wasm ${n} arena is outside memory`);
}
function oo(e) {
	if (!Number.isSafeInteger(e.startSample) || e.startSample < 0) throw new RangeError("FBank window startSample must be a non-negative safe integer");
	if (!Number.isSafeInteger(e.sampleCount) || e.sampleCount < 1) throw new RangeError("FBank window sampleCount must be a positive safe integer");
	if (e.validSampleCount !== void 0 && (!Number.isSafeInteger(e.validSampleCount) || e.validSampleCount < 0 || e.validSampleCount > e.sampleCount)) throw new RangeError("FBank window validSampleCount must be in [0, sampleCount]");
}
const ol = new Uint32Array([
	1779033703,
	3144134277,
	1013904242,
	2773480762,
	1359893119,
	2600822924,
	528734635,
	1541459225
]), sl = new Uint32Array([
	1116352408,
	1899447441,
	3049323471,
	3921009573,
	961987163,
	1508970993,
	2453635748,
	2870763221,
	3624381080,
	310598401,
	607225278,
	1426881987,
	1925078388,
	2162078206,
	2614888103,
	3248222580,
	3835390401,
	4022224774,
	264347078,
	604807628,
	770255983,
	1249150122,
	1555081692,
	1996064986,
	2554220882,
	2821834349,
	2952996808,
	3210313671,
	3336571891,
	3584528711,
	113926993,
	338241895,
	666307205,
	773529912,
	1294757372,
	1396182291,
	1695183700,
	1986661051,
	2177026350,
	2456956037,
	2730485921,
	2820302411,
	3259730800,
	3345764771,
	3516065817,
	3600352804,
	4094571909,
	275423344,
	430227734,
	506948616,
	659060556,
	883997877,
	958139571,
	1322822218,
	1537002063,
	1747873779,
	1955562222,
	2024104815,
	2227730452,
	2361852424,
	2428436474,
	2756734187,
	3204031479,
	3329325298
]), hr = 64;
var Cr = class {
	state = ol.slice();
	pending = new Uint8Array(hr);
	schedule = /* @__PURE__ */ new Uint32Array(64);
	pendingBytes = 0;
	totalBytes = 0;
	finished = !1;
	update(e) {
		if (this.finished) throw new Error("SHA-256 digest has already been finalized");
		if (e.byteLength === 0) return this;
		if (this.totalBytes += e.byteLength, !Number.isSafeInteger(this.totalBytes)) throw new RangeError("SHA-256 input is too large");
		let t = 0;
		if (this.pendingBytes > 0) {
			const r = Math.min(hr - this.pendingBytes, e.byteLength);
			this.pending.set(e.subarray(0, r), this.pendingBytes), this.pendingBytes += r, t += r, this.pendingBytes === hr && (this.compress(this.pending, 0), this.pendingBytes = 0);
		}
		for (; t + hr <= e.byteLength;) this.compress(e, t), t += hr;
		if (t < e.byteLength) {
			const r = e.subarray(t);
			this.pending.set(r), this.pendingBytes = r.byteLength;
		}
		return this;
	}
	digestHex() {
		if (this.finished) throw new Error("SHA-256 digest has already been finalized");
		this.finished = !0, this.pending[this.pendingBytes] = 128, this.pending.fill(0, this.pendingBytes + 1), this.pendingBytes >= 56 && (this.compress(this.pending, 0), this.pending.fill(0));
		const e = this.totalBytes * 8, t = new DataView(this.pending.buffer);
		t.setUint32(56, Math.floor(e / 4294967296), !1), t.setUint32(60, e >>> 0, !1), this.compress(this.pending, 0);
		let r = "";
		for (const a of this.state) r += a.toString(16).padStart(8, "0");
		return r;
	}
	compress(e, t) {
		const r = this.schedule;
		for (let d = 0; d < 16; d += 1) {
			const h = t + d * 4;
			r[d] = (e[h] << 24 | e[h + 1] << 16 | e[h + 2] << 8 | e[h + 3]) >>> 0;
		}
		for (let d = 16; d < 64; d += 1) {
			const h = r[d - 15], f = r[d - 2], p = Ve(h, 7) ^ Ve(h, 18) ^ h >>> 3, _ = Ve(f, 17) ^ Ve(f, 19) ^ f >>> 10;
			r[d] = r[d - 16] + p + r[d - 7] + _ >>> 0;
		}
		let a = this.state[0], n = this.state[1], o = this.state[2], s = this.state[3], i = this.state[4], u = this.state[5], l = this.state[6], c = this.state[7];
		for (let d = 0; d < 64; d += 1) {
			const h = Ve(i, 6) ^ Ve(i, 11) ^ Ve(i, 25), f = i & u ^ ~i & l, p = c + h + f + sl[d] + r[d] >>> 0, _ = (Ve(a, 2) ^ Ve(a, 13) ^ Ve(a, 22)) + (a & n ^ a & o ^ n & o) >>> 0;
			c = l, l = u, u = i, i = s + p >>> 0, s = o, o = n, n = a, a = p + _ >>> 0;
		}
		this.state[0] = this.state[0] + a >>> 0, this.state[1] = this.state[1] + n >>> 0, this.state[2] = this.state[2] + o >>> 0, this.state[3] = this.state[3] + s >>> 0, this.state[4] = this.state[4] + i >>> 0, this.state[5] = this.state[5] + u >>> 0, this.state[6] = this.state[6] + l >>> 0, this.state[7] = this.state[7] + c >>> 0;
	}
};
function Ve(e, t) {
	return (e >>> t | e << 32 - t) >>> 0;
}
const il = "parakeet-webgpu-v1", ul = "parakeet-webgpu-fp32-v1", Ms = "mixed-palette5-o-proj-palette6-fp16-lut", Cs = "mixed-palette5-o-proj-palette6-fp32-lut", ll = "11a359db3d050fd82b002c745b24a5280f3ff13a76834b548df671c95c786c65", Is = "28dee836aefc2bfb01236fda6d10e1df7447724d2489040168549999ea267b1b", cl = 4096, dl = "ae9ad07059c7c739ffaf932226a8fe64ae2620b0", hl = "parakeet-tdt-0.6b-v2.nemo", fl = 2472222720, pl = "d99e39955c9d3d0350d8fb7c75e40c64a2b2eaeb003883d7c941fd2e8747b28c", _l = "model_weights.ckpt", ml = 2471920514, gl = "fb1cbe2765fb80c02c0f874b6ea2c2bd24048c3618c092584fd086c6366e48a9", xs = "cf535dd1050c9ce42b7785f05c1d0c164d64defc0220d74df4e91d159fc4fe39", bl = "omi-health/omi-med-stt-v1", wl = "dc854cd350873636bf38bdf94b226f5ad7eaa2bd", yl = "omimedstt-v1.nemo", El = 2497627648, Sl = "eaf0ff7258133b4e597aef024f81a4db1779abeb966e53f00a2250bb54e0fbf4", vl = "model_weights.ckpt", kl = 2497321001, Pl = "970580f0128dea97817662a4244bc9e0ea7f78156675e9383d6e11f60d478137";
function Za(e) {
	return e.format === "parakeet-webgpu-v1" ? "fp16" : "fp32";
}
function $l(e) {
	return e === "fp16" ? [ll, xs] : [Is];
}
const Rl = [{
	repository: "nvidia/parakeet-tdt-0.6b-v2",
	revision: dl,
	archiveName: hl,
	archiveByteLength: fl,
	archiveSha256: pl,
	weightsName: _l,
	weightsByteLength: ml,
	weightsSha256: gl
}, {
	repository: bl,
	revision: wl,
	archiveName: yl,
	archiveByteLength: El,
	archiveSha256: Sl,
	weightsName: vl,
	weightsByteLength: kl,
	weightsSha256: Pl
}];
function Bl(e) {
	if (!it(e)) return !1;
	const t = e.archive, r = e.weights;
	return !it(t) || !it(r) ? !1 : Rl.some((a) => e.repository === a.repository && e.revision === a.revision && t.name === a.archiveName && t.byteLength === a.archiveByteLength && t.sha256 === a.archiveSha256 && r.name === a.weightsName && r.byteLength === a.weightsByteLength && r.sha256 === a.weightsSha256 && e.license === "CC-BY-4.0");
}
function Al(e) {
	if (!it(e) || e.format !== "parakeet-webgpu-v1" && e.format !== "parakeet-webgpu-fp32-v1") throw new Error(`Expected ${il} or ${ul} model manifest`);
	const t = e.format === "parakeet-webgpu-v1" ? Ms : Cs;
	if (!it(e.source) || !Bl(e.source)) throw new Error("Invalid Parakeet source metadata");
	if (!it(e.config)) throw new Error("Invalid Parakeet model config");
	if (Tl(e.config, t), !Array.isArray(e.files) || !it(e.tensors)) throw new Error("Invalid Parakeet package tables");
	for (const a of e.files) if (!it(a) || typeof a.name != "string" || !Xa(a.byteLength) || typeof a.sha256 != "string" || !/^[0-9a-f]{64}$/.test(a.sha256)) throw new Error("Invalid Parakeet file record");
	const r = new Set(e.files.map((a) => a.name));
	for (const [a, n] of Object.entries(e.tensors)) if (!it(n) || typeof n.shard != "string" || !r.has(n.shard) || !Ll(n.byteOffset) || n.byteOffset % 256 !== 0 || !Xa(n.byteLength) || n.dtype !== "float16" && n.dtype !== "float32" && n.dtype !== "uint32" || e.format === "parakeet-webgpu-fp32-v1" && n.dtype === "float16" || !so(n.logicalShape) || !so(n.storageShape) || typeof n.layout != "string") throw new Error(`Invalid packed tensor ${a}`);
	return e;
}
function Tl(e, t) {
	for (const [r, a] of Object.entries({
		sampleRate: 16e3,
		windowSamples: 24e4,
		windowSeconds: 15,
		windowOverlapSeconds: 2,
		featureBins: 128,
		fftSize: 512,
		windowSize: 400,
		hopSize: 160,
		preemphasis: .97,
		logZeroGuard: 2 ** -24,
		normalizationEpsilon: 1e-5,
		subsamplingFactor: 8,
		encoderLayers: 24,
		encoderHiddenSize: 1024,
		attentionHeads: 8,
		attentionHeadSize: 128,
		convolutionKernelSize: 9,
		decoderHiddenSize: 640,
		decoderLayers: 2,
		vocabularySize: 1025,
		blankTokenId: 1024,
		jointOutputSize: 1030,
		jointStorageOutputSize: 1032,
		maxSymbolsPerStep: 10
	})) if (e[r] !== a) throw new Error(`Unsupported Parakeet config ${r}=${String(e[r])}`);
	if (!Array.isArray(e.durations) || e.durations.join(",") !== "0,1,2,3,4") throw new Error("Unsupported TDT duration table");
	if (e.encoderAdapter !== void 0 && e.encoderAdapter !== "medical-1d-r128") throw new Error(`Unsupported encoder adapter ${String(e.encoderAdapter)}`);
	if (e.encoderWeightFormat !== t || e.intermediateSize !== 4096) throw new Error("Unsupported Parakeet fixed encoder package contract");
}
function it(e) {
	return typeof e == "object" && e !== null;
}
function Xa(e) {
	return Number.isSafeInteger(e) && e > 0;
}
function Ll(e) {
	return Number.isSafeInteger(e) && e >= 0;
}
function so(e) {
	return Array.isArray(e) && e.every(Xa);
}
const Ml = 128 * 1024 * 1024;
const Cl = 413137152, Il = 413003776, xl = 16999168, Ol = 440517632, Nl = 440384256, Fl = 33558528, Ie = "k-by-output-row-major-f16", Ye = "n256-k32-tile-major-f16", xe = "k-by-output-row-major-f32", Ze = "n128-k32-tile-major-f32";
const Ul = {
	precision: "fp16",
	paletteDtype: "float16",
	paletteElementBytes: 2,
	packedDownloadBytes: Cl,
	retainedRuntimeBytes: Il,
	decoderShardBytes: xl,
	encoderLayerShardBytes: 16386560,
	subsamplingShardBytes: 2727168
}, Gl = {
	precision: "fp32",
	paletteDtype: "float32",
	paletteElementBytes: 4,
	packedDownloadBytes: Ol,
	retainedRuntimeBytes: Nl,
	decoderShardBytes: Fl,
	encoderLayerShardBytes: 16836864,
	subsamplingShardBytes: 2740992
}, io = /* @__PURE__ */ new Set(["preprocessor.window", "preprocessor.mel_filters"]), Ma = /* @__PURE__ */ new Set([
	"encoder.subsampling.layers.3.weight",
	"encoder.subsampling.layers.6.weight",
	"encoder.subsampling.linear.weight",
	"encoder_projector.weight"
]), Os = "output-group-by-palette-lut";
function Ns(e) {
	const t = Wl(e), r = e.files.filter((g) => g.name.endsWith(".bin")), a = new Map(r.map((g) => [g.name, g])), n = new Map(r.filter((g) => g.name !== "preprocessor.bin").map((g) => [g.name, {
		id: jl(g.name),
		label: `parakeet-source-${g.name}`,
		cursor: g.byteLength,
		tensorCount: 0
	}])), o = /* @__PURE__ */ new Map(), s = [], i = /* @__PURE__ */ new Set();
	let u = 0;
	for (const [g, y] of Object.entries(e.tensors).sort(([B], [P]) => B.localeCompare(P))) {
		if (ho(g, y, a), Dl(g, y, t), io.has(g)) {
			if (y.shard !== "preprocessor.bin") throw new Error(`${g} must remain sourced from preprocessor.bin`);
			u += 1;
			continue;
		}
		const B = n.get(y.shard);
		if (B === void 0) throw new Error(`${g} cannot use GPU-unresident ${y.shard}`);
		const P = Te(y.layout);
		if (P !== void 0) {
			const x = `${g}.palette`, A = e.tensors[x];
			if (A === void 0) throw new Error(`${g} is missing ${x}`);
			ho(x, A, a), zl(g, y, x, A, P, t);
			const T = lo(g, y, B);
			co(o, T), s.push(T), i.add(x);
			continue;
		}
		co(o, lo(g, y, B));
	}
	const l = Object.entries(e.tensors).filter(([, g]) => g.layout === Os).map(([g]) => g).filter((g) => !i.has(g));
	if (l.length > 0) throw new Error("Unowned palette LUT tensors: " + l.join(","));
	if (u !== io.size) throw new Error("The package must contain exactly two Wasm-owned preprocessor tensors");
	Vl(n, s, t);
	const c = po([...n.values()].map((g) => wr(g.cursor)));
	if (c !== t.retainedRuntimeBytes) throw new Error(`Retained ${t.precision} runtime package changed: ${c} bytes`);
	const d = o.size;
	if (d !== 939) throw new Error(`Retained runtime tensor count changed: ${d}`);
	const h = [...n.values()].map(Kl);
	for (const g of h) Yl(g);
	const f = [...r].sort(Xl).map((g) => {
		if (g.name === "preprocessor.bin") return {
			file: g,
			hashOnly: !0
		};
		const y = n.get(g.name);
		if (y === void 0) throw new Error(`${g.name} has no resident source buffer`);
		return {
			file: g,
			runtimeBufferId: y.id,
			hashOnly: !1
		};
	});
	Ql(f, h);
	const p = po(r.map((g) => g.byteLength)), _ = 0, b = c + _, w = {
		packedDownloadBytes: p,
		retainedRuntimeBytes: c,
		expandedRuntimeBytes: _,
		runtimeGpuBytes: b,
		largestRuntimeShardBytes: Math.max(...f.filter((g) => !g.hashOnly).map((g) => g.file.byteLength)),
		loaderPeakGpuBytes: b,
		runtimeBufferCount: h.length
	};
	return Zl(w, t), {
		buffers: h,
		tensors: o,
		shards: f,
		memory: w
	};
}
function Wl(e) {
	return Za(e) === "fp16" ? Ul : Gl;
}
function Te(e) {
	if (e === "k-by-output-row-major-palette5-lsb-u32") return 5;
	if (e === "k-by-output-row-major-palette6-lsb-u32") return 6;
}
function wr(e) {
	if (!Number.isSafeInteger(e) || e < 0) throw new RangeError("Runtime tensor offset must be nonnegative");
	return Math.ceil(e / 256) * 256;
}
function ql(e, t) {
	return Fs(e, t, 256);
}
function uo(e, t) {
	return Fs(e, t, 128);
}
function Fs(e, t, r) {
	if (!Number.isSafeInteger(e) || e <= 0 || e % 32 !== 0 || !Number.isSafeInteger(t) || t <= 0 || t % r !== 0) throw new RangeError(`Tile-major runtime weights require K%32=0 and N%${r}=0`);
	return [
		t / r,
		e / 32,
		32,
		r
	];
}
function lo(e, t, r) {
	return Hl(e, t), r.tensorCount += 1, {
		name: e,
		sourceRecord: t,
		runtimeRecord: {
			bufferId: r.id,
			byteOffset: t.byteOffset,
			byteLength: t.byteLength,
			dtype: t.dtype,
			logicalShape: t.logicalShape,
			storageShape: t.storageShape,
			layout: t.layout
		}
	};
}
function Dl(e, t, r) {
	if (r.precision === "fp32" && t.dtype === "float16") throw new Error(`${e} cannot retain float16 storage in the FP32 package`);
}
function zl(e, t, r, a, n, o) {
	if (t.dtype !== "uint32" || t.logicalShape.length !== 2) throw new Error(`${e} has invalid palette indices`);
	const s = t.logicalShape[0], i = t.logicalShape[1], u = n === 5 ? 32 : 16, l = n === 5 ? 5 : 3, c = s * i;
	if (!Number.isSafeInteger(c) || i % u !== 0 || c % u !== 0) throw new Error(`${e} has unaligned palette codes`);
	const d = c / u;
	if (t.storageShape.join(",") !== `${d},${l}` || t.byteLength !== d * l * 4) throw new Error(`${e} has invalid packed palette storage`);
	const h = 1 << n;
	if (a.shard !== t.shard || a.dtype !== o.paletteDtype || a.layout !== Os || a.logicalShape.length !== 2 || a.logicalShape[1] !== h || a.storageShape.join(",") !== a.logicalShape.join(",")) throw new Error(`${r} has invalid palette storage`);
	const f = a.logicalShape[0], p = i / f;
	if (i % f !== 0 || p % u !== 0 || a.byteLength !== f * h * o.paletteElementBytes) throw new Error(`${r} does not partition output columns`);
	return p;
}
function jl(e) {
	return `source-shard-${e}`;
}
function co(e, t) {
	if (e.has(t.name)) throw new Error(`Duplicate runtime tensor ${t.name}`);
	e.set(t.name, t);
}
function ho(e, t, r) {
	const a = r.get(t.shard);
	if (a === void 0) throw new Error(`${e} is not stored in a binary shard`);
	if (t.byteOffset % 256 !== 0 || t.byteLength % 4 !== 0 || t.byteOffset + t.byteLength > a.byteLength) throw new Error(`${e} exceeds its aligned source shard`);
}
function Hl(e, t) {
	if (t.byteOffset % 4 !== 0 || t.byteLength % 4 !== 0) throw new Error(`${e} cannot be copied as GPU words`);
}
function Vl(e, t, r) {
	if (e.size !== 26) throw new Error(`Resident source shard count changed: ${e.size}`);
	const a = e.get("decoder.bin"), n = e.get("encoder-subsampling.bin");
	if (a === void 0 || wr(a.cursor) !== r.decoderShardBytes || n === void 0 || wr(n.cursor) !== r.subsamplingShardBytes) throw new Error(`Resident ${r.precision} common-source shard inventory changed`);
	for (let l = 0; l < 24; l += 1) {
		const c = `encoder-layer-${String(l).padStart(2, "0")}.bin`, d = e.get(c);
		if (d === void 0 || wr(d.cursor) !== r.encoderLayerShardBytes) throw new Error(`Resident ${r.precision} encoder-layer shard inventory changed: ${c}`);
	}
	if (t.length !== 244 || t.some((l) => Te(l.runtimeRecord.layout) === void 0 || l.runtimeRecord.dtype !== "uint32" || (l.name.startsWith("encoder.layers.") ? !l.runtimeRecord.bufferId.startsWith("source-shard-encoder-layer-") : !Ma.has(l.name)))) throw new Error("Packed encoder-layer matrix inventory changed: " + t.length);
	const o = t.filter((l) => Te(l.runtimeRecord.layout) === 5).length, s = t.length - o;
	if (o !== 220 || s !== 24) throw new Error(`Packed palette topology changed: ${o} palette5, ${s} palette6`);
	const i = new Array(24).fill(0);
	for (const l of t) {
		if (Ma.has(l.name)) continue;
		const c = l.name.match(/^encoder\.layers\.(\d+)\./);
		if (c === null) throw new Error(`Packed matrix ${l.name} has no encoder layer`);
		const d = Number(c[1]);
		if (i[d] === void 0) throw new Error(`Packed matrix ${l.name} has invalid encoder layer`);
		i[d] += 1;
	}
	if (i.some((l) => l !== 10)) throw new Error(`Packed encoder layer inventories changed: ${i.join(",")}`);
	const u = t.filter((l) => Ma.has(l.name));
	if (u.length !== 4) throw new Error(`Common packed matrix inventory changed: ${u.length}`);
}
function Kl(e) {
	return {
		id: e.id,
		label: e.label,
		byteLength: wr(e.cursor),
		tensorCount: e.tensorCount
	};
}
function Yl(e) {
	if (e.byteLength <= 0 || e.byteLength > 134217728) throw new Error(`${e.id} exceeds the fixed 128 MiB runtime-buffer boundary`);
}
function Zl(e, t) {
	const r = {
		packedDownloadBytes: t.packedDownloadBytes,
		retainedRuntimeBytes: t.retainedRuntimeBytes,
		expandedRuntimeBytes: 0,
		runtimeGpuBytes: t.retainedRuntimeBytes,
		largestRuntimeShardBytes: t.decoderShardBytes,
		loaderPeakGpuBytes: t.retainedRuntimeBytes,
		runtimeBufferCount: 26
	};
	for (const [a, n] of Object.entries(r)) if (e[a] !== n) throw new Error(`Runtime ${t.precision} package memory ${a} changed: ` + String(e[a]));
}
function Xl(e, t) {
	return fo(e.name) - fo(t.name) || e.name.localeCompare(t.name);
}
function fo(e) {
	return e === "decoder.bin" ? 0 : e === "encoder-subsampling.bin" ? 1 : /^encoder-layer-\d{2}\.bin$/.test(e) ? 2 : 3;
}
function Ql(e, t) {
	const r = new Map(t.map((o) => [o.id, o])), a = /* @__PURE__ */ new Set();
	let n = 0;
	for (const o of e) {
		if (o.hashOnly) {
			if (n += 1, o.file.name !== "preprocessor.bin") throw new Error(`${o.file.name} cannot be a hash-only runtime shard`);
			continue;
		}
		const s = r.get(o.runtimeBufferId);
		if (s === void 0 || s.byteLength !== o.file.byteLength || a.has(o.runtimeBufferId)) throw new Error(`${o.file.name} is not a unique whole runtime shard`);
		a.add(o.runtimeBufferId);
	}
	if (n !== 1 || a.size !== 26 || a.size !== t.length) throw new Error("The fixed package must contain one hash-only preprocessor shard and 26 whole runtime shards");
}
function po(e) {
	return e.reduce((t, r) => t + r, 0);
}
var Jl = class Us {
	buffers;
	memory;
	precision;
	manifestUrl;
	manifestSha256;
	manifestListedBytes;
	manifestValue;
	tokenizerValue;
	tensorPlans;
	destroyed = !1;
	constructor(t, r, a, n, o, s) {
		this.buffers = a, this.manifestValue = t, this.tokenizerValue = n, this.tensorPlans = r, this.memory = o, this.precision = Za(t), this.manifestUrl = s.manifestUrl, this.manifestSha256 = s.manifestSha256, this.manifestListedBytes = t.files.reduce((i, u) => i + u.byteLength, 0);
	}
	get manifest() {
		if (this.manifestValue === void 0) throw new Error("Parakeet model initialization metadata was released");
		return this.manifestValue;
	}
	get tokenizer() {
		if (this.tokenizerValue === void 0) throw new Error("Parakeet tokenizer metadata was released");
		return this.tokenizerValue;
	}
	static async load(t, r, a) {
		const n = a.fetch ?? fetch, o = a.signal === void 0 ? void 0 : { signal: a.signal };
		vt(a.signal), a.onProgress?.({
			phase: "manifest",
			loadedBytes: 0,
			totalBytes: 0
		});
		const s = await n(r, o);
		if (!s.ok) throw new Error(`Model manifest request failed (${s.status} ${s.statusText})`);
		const i = new Uint8Array(await s.arrayBuffer()), u = new Cr().update(i).digestHex();
		if (!$l(a.expectedPrecision).includes(u)) throw new Error(`Selected ${a.expectedPrecision} model manifest SHA-256 changed: ${u}`);
		const l = Al(JSON.parse(new TextDecoder().decode(i))), c = Za(l);
		if (c !== a.expectedPrecision) throw new Error(`Selected ${a.expectedPrecision} execution but received a ${c} model package`);
		await a.onManifest?.(l), vt(a.signal);
		const d = Ns(l);
		tc(t, d);
		const h = await Gs(t, r, l, d, n, o, a);
		return new Us(l, d.tensors, h.buffers, h.tokenizer, d.memory, {
			manifestUrl: r,
			manifestSha256: u
		});
	}
	tensor(t) {
		if (this.destroyed) throw new Error("Parakeet model package was destroyed");
		const r = this.tensorPlans?.get(t);
		if (r === void 0) throw this.tensorPlans === void 0 ? /* @__PURE__ */ new Error("Parakeet tensor metadata was released") : /* @__PURE__ */ new Error(`Unknown runtime tensor ${t}`);
		const a = r.runtimeRecord, n = this.buffers.get(a.bufferId);
		if (n === void 0) throw new Error(`Runtime buffer ${a.bufferId} is not resident`);
		return {
			sourceRecord: r.sourceRecord,
			runtimeRecord: a,
			buffer: n,
			binding: {
				buffer: n,
				offset: a.byteOffset,
				size: a.byteLength
			}
		};
	}
	releaseInitializationMetadata() {
		if (this.destroyed) throw new Error("Parakeet model package was destroyed");
		this.manifestValue = void 0, this.tokenizerValue = void 0, this.tensorPlans = void 0;
	}
	destroy() {
		this.destroyed || (this.destroyed = !0, this.manifestValue = void 0, this.tokenizerValue = void 0, this.tensorPlans = void 0, qs(this.buffers.values()), this.buffers.clear());
	}
};
async function Gs(e, t, r, a, n, o, s) {
	const i = /* @__PURE__ */ new Map(), u = s.onProgress;
	let l = 0;
	try {
		for (const p of a.shards) {
			vt(s.signal);
			const _ = await n(_o(p.file.name, t), o);
			if (!_.ok) throw new Error(`Model shard ${p.file.name} failed (${_.status} ${_.statusText})`);
			const b = u === void 0 ? void 0 : (w) => {
				u({
					phase: "weights",
					file: p.file.name,
					loadedBytes: l + w,
					totalBytes: a.memory.packedDownloadBytes
				});
			};
			if (p.hashOnly) await En(e, _, p.file, void 0, s.signal, b);
			else {
				const w = await Ws(e, _, p, s.signal, b);
				if (i.has(p.runtimeBufferId)) throw w.destroy(), /* @__PURE__ */ new Error(`Runtime buffer ${p.runtimeBufferId} was already allocated`);
				i.set(p.runtimeBufferId, w);
			}
			l += p.file.byteLength;
		}
		ac(a, i);
		const c = nc(r, "tokenizer.json");
		u?.({
			phase: "tokenizer",
			loadedBytes: 0,
			totalBytes: c.byteLength
		});
		const d = await n(_o(c.name, t), o);
		if (!d.ok) throw new Error(`Tokenizer request failed (${d.status})`);
		const h = new Uint8Array(await d.arrayBuffer());
		if (vt(s.signal), h.byteLength !== c.byteLength || new Cr().update(h).digestHex() !== c.sha256) throw new Error("Tokenizer integrity validation failed");
		const f = JSON.parse(new TextDecoder().decode(h));
		return u?.({
			phase: "ready",
			loadedBytes: a.memory.packedDownloadBytes,
			totalBytes: a.memory.packedDownloadBytes
		}), {
			buffers: i,
			tokenizer: f
		};
	} catch (c) {
		throw qs(i.values()), c;
	}
}
async function Ws(e, t, r, a, n) {
	const o = await ec(e, {
		label: `parakeet-source-${r.file.name}`,
		size: r.file.byteLength,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
	}, `${r.file.name} runtime allocation`);
	let s = !1;
	try {
		return await En(e, t, r.file, o, a, n), vt(a), await e.queue.onSubmittedWorkDone(), vt(a), s = !0, o;
	} finally {
		s || o.destroy();
	}
}
async function En(e, t, r, a, n, o) {
	const s = t.headers.get("content-length");
	if (s !== null && Number(s) !== r.byteLength) throw new Error(`${r.name} Content-Length does not match manifest`);
	if (t.body === null) throw new Error(`${r.name} is not streamable`);
	const i = t.body.getReader(), u = new Cr();
	let l = 0, c = 0, d = /* @__PURE__ */ new Uint8Array(0), h = 0;
	const f = () => {
		i.cancel(n?.reason).catch(() => {});
	};
	n?.addEventListener("abort", f, { once: !0 });
	try {
		for (;;) {
			vt(n);
			const p = await i.read();
			if (vt(n), p.done) break;
			const _ = p.value;
			if (l + _.byteLength > r.byteLength) throw new Error(`${r.name} exceeds declared size`);
			if (u.update(_), a !== void 0) {
				let b = 0;
				if (d.byteLength > 0) {
					const g = 4 - d.byteLength;
					if (_.byteLength < g) {
						const B = new Uint8Array(d.byteLength + _.byteLength);
						B.set(d), B.set(_, d.byteLength), d = B, l += _.byteLength;
						continue;
					}
					const y = /* @__PURE__ */ new Uint8Array(4);
					y.set(d), y.set(_.subarray(0, g), d.byteLength), e.queue.writeBuffer(a, c, y), c += 4, b = g, d = /* @__PURE__ */ new Uint8Array(0);
				}
				const w = _.byteLength - b & -4;
				w > 0 && (e.queue.writeBuffer(a, c, _.subarray(b, b + w)), c += w, b += w), b < _.byteLength && (d = _.slice(b));
			}
			l += _.byteLength, o !== void 0 && l - h >= 1024 * 1024 && (h = l, o(l));
		}
		if (l !== r.byteLength || a !== void 0 && (c !== r.byteLength || d.byteLength !== 0)) throw new Error(`${r.name} ended before its aligned declared length`);
		if (u.digestHex() !== r.sha256) throw new Error(`${r.name} SHA-256 validation failed`);
		o?.(l);
	} catch (p) {
		throw i.cancel(p).catch(() => {}), p;
	} finally {
		n?.removeEventListener("abort", f), i.releaseLock();
	}
}
async function ec(e, t, r) {
	e.pushErrorScope("out-of-memory"), e.pushErrorScope("validation");
	let a = !0, n;
	try {
		n = e.createBuffer(t);
		const o = e.popErrorScope(), s = e.popErrorScope();
		a = !1;
		const [i, u] = await Promise.allSettled([o, s]);
		if (i.status === "rejected") throw i.reason;
		if (u.status === "rejected") throw u.reason;
		if (i.value !== null) throw new Error(`${r} failed validation: ` + i.value.message);
		if (u.value !== null) throw new Error(`${r} exhausted GPU memory: ` + u.value.message);
		return n;
	} catch (o) {
		throw a && (await e.popErrorScope().catch(() => null), await e.popErrorScope().catch(() => null), a = !1), n?.destroy(), o;
	}
}
function tc(e, t) {
	for (const r of t.buffers) if (r.byteLength > e.limits.maxBufferSize || r.byteLength > e.limits.maxStorageBufferBindingSize) throw new Error(`${r.id} (${r.byteLength} bytes) exceeds this WebGPU device's limits`);
	for (const r of t.shards) if (!r.hashOnly && (r.file.byteLength > e.limits.maxBufferSize || r.file.byteLength > e.limits.maxStorageBufferBindingSize)) throw new Error(`${r.file.name} runtime shard exceeds this WebGPU device's limits`);
}
function rc(e, t) {
	const r = e.get(t);
	if (r === void 0) throw new Error(`Runtime buffer ${t} was not allocated`);
	return r;
}
function ac(e, t) {
	if (t.size !== e.buffers.length) throw new Error(`Runtime loader materialized ${t.size} of ${e.buffers.length} buffers`);
	for (const r of e.buffers) rc(t, r.id);
}
function qs(e) {
	for (const t of new Set(e)) t.destroy();
}
function vt(e) {
	e?.throwIfAborted();
}
function nc(e, t) {
	const r = e.files.find((a) => a.name === t);
	if (r === void 0) throw new Error(`Model package is missing ${t}`);
	return r;
}
function _o(e, t) {
	const r = new URL(t, globalThis.location?.href ?? "http://localhost/");
	return new URL(e, r).href;
}
Object.freeze({
	loadRuntimeAssets: Gs,
	loadRuntimeShard: Ws,
	streamAndValidateShard: En
});
var er = class extends Error {
	url;
	phase;
	attempt;
	status;
	retryAfterMs;
	retryable;
	detail;
	constructor(e) {
		const t = e.status === void 0 ? "" : ` (HTTP ${e.status})`, r = e.attempt === void 0 ? "" : ` on attempt ${e.attempt}`, a = e.detail === void 0 ? "" : `: ${e.detail}`;
		super(`Model ${e.phase} failed for ${e.url}${t}${r}${a}`, e.cause === void 0 ? void 0 : { cause: e.cause }), this.name = "ModelTransportError", this.url = e.url, this.phase = e.phase, this.attempt = e.attempt, this.status = e.status, this.retryAfterMs = e.retryAfterMs, this.retryable = e.retryable, this.detail = e.detail;
	}
}, oc = class {
	networkFetch;
	options;
	fetch;
	controller = new AbortController();
	activeBodies = /* @__PURE__ */ new Set();
	now;
	cancellation;
	constructor(e, t) {
		this.networkFetch = e, this.options = t, this.now = t.now ?? Date.now, this.fetch = this.fetchModelAsset.bind(this);
	}
	async cancel(e) {
		if (this.cancellation !== void 0) return await this.cancellation;
		this.controller.signal.aborted || this.controller.abort(e), this.cancellation = Promise.allSettled([...this.activeBodies].map((t) => t.cancel(e))).then(() => {}), await this.cancellation;
	}
	async fetchModelAsset(e, t) {
		const r = dc(e), a = lc([
			this.controller.signal,
			this.options.signal,
			e instanceof Request ? e.signal : void 0,
			t?.signal
		]);
		let n;
		try {
			n = await this.networkFetch(e, {
				...t,
				signal: a.signal
			});
		} catch (o) {
			throw a.dispose(), a.signal.aborted ? Vr(a.signal.reason) : new er({
				url: r,
				phase: "request",
				attempt: this.options.attempt,
				retryable: !0,
				detail: zs(o),
				cause: o
			});
		}
		if (a.signal.aborted) {
			try {
				await n.body?.cancel(a.signal.reason);
			} finally {
				a.dispose();
			}
			throw Vr(a.signal.reason);
		}
		if (!n.ok) {
			a.dispose();
			try {
				await n.body?.cancel();
			} catch {}
			const o = uc(n.headers.get("retry-after"), this.now());
			throw new er({
				url: r,
				phase: "response",
				attempt: this.options.attempt,
				status: n.status,
				...o === void 0 ? {} : { retryAfterMs: o },
				retryable: ic(n.status),
				detail: n.statusText || "request was not successful"
			});
		}
		return n.body === null ? (a.dispose(), n) : this.wrapBody(n, r, a);
	}
	wrapBody(e, t, r) {
		const a = e.body.getReader();
		let n = !1, o = !1, s;
		const i = () => {
			n || (n = !0, this.activeBodies.delete(u), r.dispose(), a.releaseLock());
		}, u = { cancel: async (l) => {
			if (!(n || o)) {
				o = !0, s = l;
				try {
					await a.cancel(l);
				} finally {
					i();
				}
			}
		} };
		return this.activeBodies.add(u), cc(e, new ReadableStream({
			pull: async (l) => {
				try {
					const c = await a.read();
					if (o) {
						l.error(Vr(s));
						return;
					}
					if (c.done) {
						i(), l.close();
						return;
					}
					l.enqueue(c.value);
				} catch (c) {
					if (n || i(), r.signal.aborted) {
						l.error(Vr(r.signal.reason));
						return;
					}
					l.error(Ds(t, c, this.options.attempt));
				}
			},
			cancel: async (l) => {
				if (!n) {
					o = !0, s = l;
					try {
						await a.cancel(l);
					} finally {
						i();
					}
				}
			}
		}));
	}
};
function Ds(e, t, r) {
	return t instanceof er ? t : new er({
		url: e,
		phase: "body",
		...r === void 0 ? {} : { attempt: r },
		retryable: !0,
		detail: zs(t),
		cause: t
	});
}
function sc(e, t, r) {
	return new er({
		url: e,
		phase: "body",
		retryable: !0,
		detail: `response ended after ${t} bytes; expected ${r}`
	});
}
function ic(e) {
	return e === 408 || e === 425 || e === 429 || e >= 500 && e <= 599;
}
function uc(e, t) {
	if (e === null) return;
	const r = e.trim();
	if (/^\d+$/.test(r)) {
		const n = Number(r);
		return Number.isSafeInteger(n) ? n * 1e3 : void 0;
	}
	const a = Date.parse(r);
	return Number.isFinite(a) ? Math.max(0, a - t) : void 0;
}
function lc(e) {
	const t = e.filter((n) => n != null);
	if (t.length === 1) return {
		signal: t[0],
		dispose: () => {}
	};
	const r = new AbortController(), a = [];
	for (const n of t) {
		const o = () => {
			r.signal.aborted || r.abort(n.reason);
		};
		if (n.aborted) {
			o();
			break;
		}
		n.addEventListener("abort", o, { once: !0 }), a.push({
			signal: n,
			listener: o
		});
	}
	return {
		signal: r.signal,
		dispose: () => {
			for (const { signal: n, listener: o } of a) n.removeEventListener("abort", o);
		}
	};
}
function cc(e, t) {
	return new Response(t, {
		status: e.status,
		statusText: e.statusText,
		headers: e.headers
	});
}
function dc(e) {
	const t = e instanceof Request ? e.url : e.toString();
	return new URL(t, globalThis.location?.href ?? "http://localhost/").href;
}
function Vr(e) {
	return e ?? new DOMException("The operation was aborted", "AbortError");
}
function zs(e) {
	return e instanceof Error ? e.message : String(e);
}
const fc = `parakeet.wgsl:models:v1:`, js = "x-parakeet-wgsl-cache-format", Hs = "x-parakeet-wgsl-sha256", Vs = "x-parakeet-wgsl-byte-length", Ks = "1";
var Ke = class extends Error {
	code = "MODEL_NOT_CACHED";
	url;
	constructor(e, t) {
		super(t ?? (e === void 0 ? "The selected Parakeet model is not fully cached" : `Parakeet model asset is not cached: ${e}`)), this.name = "ModelNotCachedError", this.url = e;
	}
}, pc = class {
	fetch;
	assets = /* @__PURE__ */ new Map();
	activeNetworkLoads = /* @__PURE__ */ new Set();
	ignoredCacheUrls = /* @__PURE__ */ new Set();
	pendingCacheWrites = /* @__PURE__ */ new Set();
	cachePromise;
	networkFetch;
	cacheOnly;
	cacheCorruptionDetected = !1;
	constructor(e, t = {}) {
		go(e), this.registerAssets([e]), this.cacheOnly = t.cacheOnly === !0, this.networkFetch = t.fetch ?? globalThis.fetch.bind(globalThis);
		const r = t.cacheStorage ?? (typeof globalThis.caches > "u" ? void 0 : globalThis.caches), a = `${fc}${e.sha256.toLowerCase()}`;
		this.cachePromise = r === void 0 ? Promise.resolve(void 0) : this.cacheOnly ? _c(r, a) : r.open(a).catch(() => {}), this.fetch = this.fetchAsset.bind(this);
	}
	registerAssets(e) {
		for (const t of e) {
			go(t);
			const r = ua(t.url), a = {
				url: r,
				byteLength: t.byteLength,
				sha256: t.sha256.toLowerCase()
			}, n = this.assets.get(r);
			if (n !== void 0 && (n.byteLength !== a.byteLength || n.sha256 !== a.sha256)) throw new Error(`Conflicting integrity records for model asset ${r}`);
			this.assets.set(r, a);
		}
	}
	async requireCachedAssets(e) {
		if (this.registerAssets(e), e.length === 0) return;
		const t = await this.cachePromise;
		if (t === void 0) throw new Ke();
		for (const r of e) {
			const a = ua(r.url), n = this.assets.get(a);
			if (this.ignoredCacheUrls.has(a)) throw new Ke(a);
			let o;
			try {
				o = await t.match(a, { ignoreVary: !0 });
			} catch {
				throw new Ke(a, `Could not inspect cached Parakeet model asset ${a}`);
			}
			if (o === void 0 || o.body === null || !mo(o, n)) throw new Ke(a);
		}
	}
	consumeCacheCorruption() {
		const e = this.cacheCorruptionDetected;
		return this.cacheCorruptionDetected = !1, e;
	}
	get maximumCorruptionRetries() {
		return this.assets.size;
	}
	async settle() {
		for (; this.pendingCacheWrites.size > 0;) await Promise.all([...this.pendingCacheWrites]);
	}
	async cancelInFlight(e) {
		await Promise.allSettled([...this.activeNetworkLoads].map((t) => t.cancel(e))), await this.settle();
	}
	async fetchAsset(e, t) {
		const r = mc(e), a = this.assets.get(r);
		if (a === void 0) throw new Error(`Refusing to fetch unpinned model asset ${r}`);
		if (gc(e, t) !== "GET") throw new Error(`Model assets must be fetched with GET: ${r}`);
		const n = await this.cachePromise;
		if (n !== void 0 && !this.ignoredCacheUrls.has(r)) {
			let i;
			try {
				i = await n.match(r, { ignoreVary: !0 });
			} catch {
				if (this.cacheOnly) throw new Ke(r, `Could not inspect cached Parakeet model asset ${r}`);
				i = void 0;
			}
			if (i !== void 0) {
				if (mo(i, a) && i.body !== null) return this.verifiedCacheResponse(n, r, i, a);
				if (this.cacheOnly) throw new Ke(r);
				try {
					await n.delete(r, { ignoreVary: !0 });
				} catch {}
			}
		}
		if (this.cacheOnly) throw new Ke(r);
		const o = n === void 0 ? t : {
			...t,
			cache: "no-store"
		}, s = await this.networkFetch(e, o);
		return s.status !== 200 || s.body === null ? s : this.streamingNetworkResponse(n, r, s, a);
	}
	verifiedCacheResponse(e, t, r, a) {
		const n = r.body.getReader(), o = new Cr();
		let s = 0, i = !1, u = !1;
		const l = () => {
			u || (u = !0, n.releaseLock());
		}, c = async (h) => {
			this.cacheCorruptionDetected = !0, this.ignoredCacheUrls.add(t);
			try {
				await e.delete(t, { ignoreVary: !0 });
			} catch {}
			return this.cacheOnly ? new Ke(t, h) : new Error(h);
		}, d = async (h, f) => {
			const p = await c(f);
			try {
				await n.cancel(p);
			} catch {} finally {
				l();
			}
			h.error(p);
		};
		return Ca(r, new ReadableStream({
			pull: async (h) => {
				let f;
				try {
					f = await n.read();
				} catch {
					if (i) {
						l();
						return;
					}
					await d(h, `Cached model asset ${t} could not be read`);
					return;
				}
				if (i) {
					l();
					return;
				}
				if (f.done) {
					if (s !== a.byteLength) {
						await d(h, `Cached model asset ${t} has ${s} bytes; expected ${a.byteLength}`);
						return;
					}
					const _ = o.digestHex();
					if (_ !== a.sha256) {
						await d(h, `Cached model asset SHA-256 mismatch for ${t}: ${_}`);
						return;
					}
					l(), h.close();
					return;
				}
				const p = f.value;
				if (s += p.byteLength, s > a.byteLength) {
					await d(h, `Cached model asset ${t} is longer than its pinned byte length`);
					return;
				}
				o.update(p), h.enqueue(p);
			},
			cancel: async (h) => {
				i = !0;
				try {
					await n.cancel(h);
				} finally {
					l();
				}
			}
		}), a, !1);
	}
	streamingNetworkResponse(e, t, r, a) {
		const n = r.body.getReader(), o = new TransformStream(), s = e === void 0 ? void 0 : new TransformStream(), i = o.writable.getWriter(), u = s?.writable.getWriter(), l = new Cr();
		let c = 0, d = u !== void 0, h;
		const f = { cancel: (w) => (h ??= Promise.allSettled([
			n.cancel(w),
			i.abort(w),
			...u === void 0 ? [] : [u.abort(w)]
		]).then(() => {}), d = !1, h) };
		this.activeNetworkLoads.add(f);
		const p = e === void 0 || s === void 0 || u === void 0 ? void 0 : e.put(t, Ca(r, s.readable, a, !0)).catch(async (w) => {
			d = !1;
			try {
				await u.abort(w);
			} catch {}
		}), _ = (async () => {
			try {
				for (;;) {
					let g;
					try {
						g = await n.read();
					} catch (B) {
						throw Ds(t, B);
					}
					if (g.done) break;
					const y = g.value;
					if (c += y.byteLength, c > a.byteLength) throw new Error(`Model asset ${t} is longer than its pinned byte length`);
					if (l.update(y), await i.write(y), d && u !== void 0) try {
						await u.write(y);
					} catch {
						d = !1;
					}
				}
				if (c !== a.byteLength) throw sc(t, c, a.byteLength);
				const w = l.digestHex();
				if (w !== a.sha256) throw new Error(`Model asset SHA-256 mismatch for ${t}: ${w}`);
				if (await i.close(), d && u !== void 0) try {
					await u.close();
				} catch {
					d = !1;
				}
			} catch (w) {
				throw await f.cancel(w), w;
			} finally {
				this.activeNetworkLoads.delete(f), n.releaseLock(), i.releaseLock(), u?.releaseLock();
			}
		})(), b = Promise.allSettled([_, ...p === void 0 ? [] : [p]]).then(() => {});
		return this.pendingCacheWrites.add(b), b.then(() => this.pendingCacheWrites.delete(b)), Ca(r, o.readable, a, !1);
	}
};
async function _c(e, t) {
	try {
		return (await e.keys()).includes(t) ? await e.open(t) : void 0;
	} catch {
		return;
	}
}
function mo(e, t) {
	return e.ok && e.headers.get(js) === Ks && e.headers.get(Hs)?.toLowerCase() === t.sha256 && e.headers.get(Vs) === String(t.byteLength);
}
function Ca(e, t, r, a) {
	const n = new Headers(e.headers);
	return n.delete("content-encoding"), n.set("content-length", String(r.byteLength)), a && (n.set(js, Ks), n.set(Hs, r.sha256), n.set(Vs, String(r.byteLength))), new Response(t, {
		status: e.status,
		statusText: e.statusText,
		headers: n
	});
}
function mc(e) {
	return ua(e instanceof Request ? e.url : e.toString());
}
function gc(e, t) {
	return (t?.method ?? (e instanceof Request ? e.method : "GET")).toUpperCase();
}
function ua(e) {
	return new URL(e, globalThis.location?.href ?? "http://localhost/").href;
}
function go(e) {
	if (!Number.isSafeInteger(e.byteLength) || e.byteLength <= 0) throw new TypeError("Model asset byteLength must be a positive integer");
	if (!/^[0-9a-f]{64}$/i.test(e.sha256)) throw new TypeError("Model asset sha256 must be a 64-character hexadecimal digest");
	ua(e.url);
}
const bc = 4, wc = 4, yc = 500, Ec = 8e3, Sc = 3e4;
var vc = class extends Error {
	attempts;
	lastError;
	constructor(e, t) {
		const r = t.status === void 0 ? "" : ` (HTTP ${t.status})`, a = t.detail === void 0 ? "" : `: ${t.detail}`;
		super(`Model loading failed after ${e} attempts; last failure was during ${t.phase} for ${t.url}${r}${a}`, { cause: t }), this.name = "ModelLoadRetryExhaustedError", this.attempts = e, this.lastError = t;
	}
};
async function kc(e, t = {}) {
	const r = Pc(t), a = t.fetch ?? globalThis.fetch.bind(globalThis);
	let n = 1;
	for (;;) {
		Qa(t.signal);
		const o = new oc(a, {
			attempt: n,
			...t.signal === void 0 ? {} : { signal: t.signal },
			now: r.now
		}), s = {
			number: n,
			fetch: o.fetch,
			cancel: (i) => o.cancel(i)
		};
		try {
			return await e(s);
		} catch (i) {
			if (await o.cancel(i), await t.cleanup?.(i), Qa(t.signal), t.recover?.(i) === !0) continue;
			if (!(i instanceof er) || !i.retryable) throw i;
			if (n >= r.maxAttempts) throw new vc(n, i);
			const u = $c(i, n, r);
			t.onRetry?.({
				attempt: n,
				nextAttempt: n + 1,
				maxAttempts: r.maxAttempts,
				delayMs: u,
				error: i
			}), await r.sleep(u, t.signal), n += 1;
		}
	}
}
function Pc(e) {
	const t = Bc(e.maxAttempts ?? bc, "maxAttempts", 1, wc), r = Ia(e.baseDelayMs ?? yc, "baseDelayMs"), a = Ia(e.maxDelayMs ?? Ec, "maxDelayMs"), n = Ia(e.maxRetryAfterMs ?? Sc, "maxRetryAfterMs");
	if (a < r) throw new RangeError("maxDelayMs must be greater than or equal to baseDelayMs");
	return {
		maxAttempts: t,
		baseDelayMs: r,
		maxDelayMs: a,
		maxRetryAfterMs: n,
		random: e.random ?? Math.random,
		now: e.now ?? Date.now,
		sleep: e.sleep ?? Rc
	};
}
function $c(e, t, r) {
	const a = Math.min(r.maxDelayMs, r.baseDelayMs * 2 ** (t - 1)) * (.5 + Math.min(1, Math.max(0, r.random())) * .5), n = e.retryAfterMs === void 0 ? 0 : Math.min(e.retryAfterMs, r.maxRetryAfterMs);
	return Math.round(Math.max(a, n));
}
async function Rc(e, t) {
	Qa(t), e !== 0 && await new Promise((r, a) => {
		const n = setTimeout(s, e), o = () => {
			clearTimeout(n), t?.removeEventListener("abort", o), a(t?.reason ?? new DOMException("The operation was aborted", "AbortError"));
		};
		function s() {
			t?.removeEventListener("abort", o), r();
		}
		t?.addEventListener("abort", o, { once: !0 }), t?.aborted && o();
	});
}
function Qa(e) {
	if (e?.aborted) throw e.reason ?? new DOMException("The operation was aborted", "AbortError");
}
function Bc(e, t, r, a) {
	if (!Number.isSafeInteger(e) || e < r || e > a) throw new RangeError(`${t} must be an integer from ${r} through ${a}`);
	return e;
}
function Ia(e, t) {
	if (!Number.isFinite(e) || e < 0) throw new RangeError(`${t} must be a non-negative finite number`);
	return e;
}
const xa = 1024, Oa = 0, Kr = 1024;
var Ac = class Ys {
	vocabularySize;
	blankTokenId = Kr;
	#e;
	constructor(t) {
		this.#e = t, this.vocabularySize = t.length;
	}
	static fromJSON(t) {
		const r = Ir(t, "tokenizer");
		if (!Array.isArray(r.added_tokens)) throw new TypeError("tokenizer.added_tokens must be an array");
		const a = {
			added_tokens: r.added_tokens,
			decoder: r.decoder,
			model: r.model
		}, n = Tc(a.model);
		Lc(a.decoder);
		const o = [];
		for (const [i, u] of Object.entries(n.vocab)) bo(o, yr(u, `vocab entry ${JSON.stringify(i)}`), i, "model vocabulary");
		if (Object.keys(n.vocab).length !== xa || o.length !== xa || o.filter((i) => i !== void 0).length !== xa || o[Oa] !== "<unk>") throw new TypeError("tokenizer.model.vocab must contain the fixed contiguous v2 vocabulary");
		const s = a.added_tokens.map(Mc);
		if (s.length !== 2 || !wo(s, Oa, "<unk>") || !wo(s, Kr, "<blank>")) throw new TypeError("tokenizer.added_tokens must contain only fixed v2 <unk> and <blank>");
		return bo(o, Kr, "<blank>", "added token"), new Ys(Array.from({ length: o.length }, (i, u) => {
			const l = o[u];
			if (l === void 0) throw new TypeError("tokenizer contains an unmapped token ID");
			return l;
		}));
	}
	#t(t) {
		yr(t, "token ID");
		const r = this.#e[t];
		if (r !== void 0) return r;
		throw new RangeError(`Token ID ${t} is not present in tokenizer.json`);
	}
	pieceForTokenId(t) {
		return this.#t(t);
	}
	decode(t) {
		const r = [];
		for (const n of t) yr(n, "token ID"), !(n === Oa || n === Kr) && r.push(this.#t(n));
		const a = r.join("").split("▁").join(" ");
		return a.startsWith(" ") ? a.slice(1) : a;
	}
};
function Tc(e) {
	const t = Ir(e, "tokenizer.model");
	if (t.type !== "BPE") throw new TypeError("Expected tokenizer.model.type to be \"BPE\"");
	const r = Ir(t.vocab, "tokenizer.model.vocab"), a = {};
	for (const [n, o] of Object.entries(r)) a[n] = yr(o, `vocab entry ${JSON.stringify(n)}`);
	if (t.unk_token !== "<unk>") throw new TypeError("tokenizer.model.unk_token must be \"<unk>\"");
	if (t.byte_fallback !== !1) throw new TypeError("tokenizer.model.byte_fallback must be false");
	return {
		type: "BPE",
		vocab: a
	};
}
function Lc(e) {
	const t = Ir(e, "tokenizer.decoder");
	if (t.type !== "Metaspace") throw new TypeError("Expected tokenizer.decoder.type to be \"Metaspace\"");
	if (t.replacement !== "▁") throw new TypeError("tokenizer.decoder.replacement must be \"▁\"");
	if (t.prepend_scheme !== "always") throw new TypeError("tokenizer.decoder.prepend_scheme must be \"always\"");
}
function Mc(e) {
	const t = Ir(e, "added token");
	if (typeof t.content != "string") throw new TypeError("added token content must be a string");
	if (typeof t.special != "boolean") throw new TypeError("added token special must be a boolean");
	return {
		id: yr(t.id, "added token ID"),
		content: t.content,
		special: t.special
	};
}
function bo(e, t, r, a) {
	const n = e[t];
	if (n !== void 0 && n !== r) throw new TypeError(`Token ID ${t} maps to both ${JSON.stringify(n)} and ${JSON.stringify(r)} in ${a}`);
	e[t] = r;
}
function wo(e, t, r) {
	return e.some((a) => a.id === t && a.content === r && a.special);
}
function Ir(e, t) {
	if (typeof e != "object" || e === null || Array.isArray(e)) throw new TypeError(`${t} must be an object`);
	return e;
}
function yr(e, t) {
	if (typeof e != "number" || !Number.isSafeInteger(e) || e < 0) throw new TypeError(`${t} must be a non-negative safe integer`);
	return e;
}
const kt = 15 * 16e3, k = 1280, Nr = k, ct = Math.floor((kt - Nr - 160) / k) * k, jt = 2 * 16e3, Ht = ct - jt, Er = Math.floor((kt - 160) / k) * k;
var Cc = class {
	stablePlans = [];
	get plannedWindowCount() {
		return this.stablePlans.length;
	}
	takeStablePrefix(e) {
		Ja(e, "availableSamples");
		const t = [];
		for (;;) {
			const r = this.stablePlans.length, a = r * Ht, n = a + ct;
			if (e <= n) break;
			const o = r === 0 ? 0 : Nr, s = a - o, i = n - s, u = {
				index: r,
				windowSampleCount: kt,
				logicalStartSample: a,
				logicalEndSample: n,
				sourceStartSample: s,
				sourceEndSample: n,
				readSampleCount: i,
				timestampOffsetSample: a,
				emissionStartSample: a,
				emissionEndSample: n,
				decodeStartFrame: o / k,
				decodeEndFrame: Math.ceil((i - o) / k),
				flushFinal: !1,
				validSampleCount: i
			};
			this.stablePlans.push(u), t.push(u);
		}
		return t;
	}
	finish(e, t) {
		const r = Zs(e, t);
		if (this.stablePlans.length > r.length) throw new Error("Online primary plan extends past the final plan");
		for (let a = 0; a < this.stablePlans.length; a += 1) if (!Ic(this.stablePlans[a], r[a])) throw new Error(`Online primary window ${a} changed when EOF was resolved`);
		return {
			allPlans: r,
			remainingPlans: r.slice(this.stablePlans.length)
		};
	}
};
function Zs(e, t = e) {
	if (Ja(e, "totalSamples"), Ja(t, "speechEndSample"), t > e) throw new RangeError("speechEndSample must not exceed totalSamples");
	if (e === 0) return [];
	const r = [];
	for (let a = 0, n = 0; a < e; a += Ht, n += 1) {
		const o = Math.min(t, e) - a, s = a + ct >= e;
		let i = 0;
		if (s && o > 0 && a > 0) {
			const B = Math.floor((ct - o) / k) * k;
			if (B > 0) {
				const P = Math.floor(a / k) * k;
				i = Math.min(P, B);
			}
		}
		const u = Math.max(k, ct - i), l = a + u, c = l >= e, d = c ? e : l;
		if (d <= a) break;
		const h = c ? Math.min(d, t) : d;
		if (h <= a) break;
		const f = i > 0 || n === 0 ? 0 : Nr, p = a - Math.max(i, f), _ = c, b = h - p;
		if (b <= 0 || b > kt) throw new Error("Invalid stateless source-window geometry");
		const w = b, g = f;
		if (g % k !== 0) throw new Error("Stateless decoder start must be frame-aligned");
		const y = {
			index: n,
			windowSampleCount: kt,
			logicalStartSample: a,
			logicalEndSample: d,
			sourceStartSample: p,
			sourceEndSample: h,
			readSampleCount: b,
			timestampOffsetSample: f > 0 ? a : p,
			emissionStartSample: a,
			emissionEndSample: h,
			decodeStartFrame: g / k,
			decodeEndFrame: Math.ceil((b - f) / k),
			flushFinal: _,
			validSampleCount: w
		};
		if (r.push(y), c) break;
	}
	return r;
}
function Ic(e, t) {
	return e.index === t.index && e.windowSampleCount === t.windowSampleCount && e.logicalStartSample === t.logicalStartSample && e.logicalEndSample === t.logicalEndSample && e.sourceStartSample === t.sourceStartSample && e.sourceEndSample === t.sourceEndSample && e.readSampleCount === t.readSampleCount && e.timestampOffsetSample === t.timestampOffsetSample && e.emissionStartSample === t.emissionStartSample && e.emissionEndSample === t.emissionEndSample && e.decodeStartFrame === t.decodeStartFrame && e.decodeEndFrame === t.decodeEndFrame && e.flushFinal === t.flushFinal && e.validSampleCount === t.validSampleCount;
}
function Ja(e, t) {
	if (!Number.isSafeInteger(e) || e < 0) throw new RangeError(`${t} must be a non-negative safe integer`);
}
const xc = Object.freeze([]);
function Oc(e, t) {
	const r = [];
	for (const a of e) {
		const n = t.timestampOffsetSample + a.frameIndex * k, o = n + a.durationFrames * k;
		n < t.emissionStartSample || n >= t.emissionEndSample || r.push({
			tokenId: a.tokenId,
			startSample: n,
			endSample: Math.min(o, t.emissionEndSample),
			durationFrames: a.durationFrames
		});
	}
	return r;
}
var Nc = class {
	#e;
	#t;
	#o;
	#r = [];
	#a;
	constructor(e = {}) {
		this.#e = e.tokenPiece ?? (() => {}), this.#t = e.tokenPiece !== void 0, this.#o = e.collectTrace === !0 ? [] : void 0;
	}
	append(e) {
		Vc(e);
		const t = this.#a;
		if (t === void 0) {
			this.#r = [...e.tokens], this.#a = e;
			return;
		}
		if (Uc(t, e) > 0) throw new RangeError("incremental stitch windows must be appended in chronological order");
		const r = Gc(this.#r, e.tokens, this.#e, this.#t);
		this.#r = r.tokens, this.#o?.push({
			leftWindowIndex: t.index,
			rightWindowIndex: e.index,
			method: r.method,
			overlapStartSample: e.startSample,
			overlapEndSample: Math.min(t.endSample, e.endSample)
		}), this.#a = e;
	}
	snapshot() {
		let e = Fc(this.#r);
		return e.length > 1 && this.#t && (e = jc(e, this.#e)), {
			tokens: e,
			trace: this.#o === void 0 ? xc : [...this.#o]
		};
	}
};
function Fc(e) {
	if (e.length === 0) return [];
	const t = [e[0]];
	let r = e[0].startSample;
	for (let a = 1; a < e.length; a += 1) {
		const n = e[a];
		if (n.startSample >= r) {
			t.push(n), r = n.startSample;
			continue;
		}
		const o = r - n.startSample;
		t.push({
			...n,
			startSample: r,
			endSample: n.endSample + o
		});
	}
	return t;
}
function Uc(e, t) {
	return e.startSample - t.startSample || e.index - t.index;
}
function Gc(e, t, r, a) {
	if (e.length === 0) return {
		tokens: [...t],
		method: "disjoint"
	};
	if (t.length === 0) return {
		tokens: [...e],
		method: "disjoint"
	};
	const n = e.at(-1).startSample + k, o = t[0].startSample;
	if (n <= o) return {
		tokens: [...e, ...t],
		method: "disjoint"
	};
	const s = yo(e, (h) => h.startSample + k > o - jt), i = yo(t, (h) => h.startSample < n + jt);
	if (s.length < 2 || i.length < 2) return {
		tokens: So(e, t, n, o, r, a),
		method: "midpoint"
	};
	const u = (h, f) => en(h.token.tokenId, f.token.tokenId, r) && Math.abs(h.token.startSample - f.token.startSample) < jt / 2, l = Wc(s, i, u), c = Math.max(Math.floor(s.length / 2), 1);
	if (l.length >= c) return {
		tokens: Eo(l, s, i, e, t, r, a),
		method: "contiguous"
	};
	const d = qc(s, i, u);
	return d.length === 0 ? {
		tokens: So(e, t, n, o, r, a),
		method: "midpoint"
	} : {
		tokens: Eo(d, s, i, e, t, r, a),
		method: "lcs"
	};
}
function yo(e, t) {
	const r = [];
	for (let a = 0; a < e.length; a += 1) {
		const n = e[a];
		t(n) && r.push({
			index: a,
			token: n
		});
	}
	return r;
}
function Wc(e, t, r) {
	let a = [];
	for (let n = 0; n < e.length; n += 1) for (let o = 0; o < t.length; o += 1) {
		if (!r(e[n], t[o])) continue;
		const s = [];
		let i = n, u = o;
		for (; i < e.length && u < t.length && r(e[i], t[u]);) s.push({
			leftOffset: i,
			rightOffset: u
		}), i += 1, u += 1;
		s.length > a.length && (a = s);
	}
	return a;
}
function qc(e, t, r) {
	const a = t.length + 1, n = new Uint32Array((e.length + 1) * a);
	for (let u = 1; u <= e.length; u += 1) for (let l = 1; l <= t.length; l += 1) {
		const c = u * a + l;
		n[c] = r(e[u - 1], t[l - 1]) ? n[(u - 1) * a + l - 1] + 1 : Math.max(n[(u - 1) * a + l], n[u * a + l - 1]);
	}
	const o = [];
	let s = e.length, i = t.length;
	for (; s > 0 && i > 0;) r(e[s - 1], t[i - 1]) ? (o.push({
		leftOffset: s - 1,
		rightOffset: i - 1
	}), s -= 1, i -= 1) : n[(s - 1) * a + i] > n[s * a + i - 1] ? s -= 1 : i -= 1;
	return o.reverse(), o;
}
function Eo(e, t, r, a, n, o, s) {
	const i = e.map(({ leftOffset: b }) => t[b].index), u = e.map(({ rightOffset: b }) => r[b].index), l = [], c = i[0];
	c > 0 && l.push(...a.slice(0, c));
	for (let b = 0; b < e.length; b += 1) {
		const w = i[b], g = u[b];
		if (l.push(a[w]), b === e.length - 1) continue;
		const y = i[b + 1], B = u[b + 1], P = a.slice(w + 1, y), x = n.slice(g + 1, B);
		l.push(...x.length > P.length ? x : P);
	}
	const d = u.at(-1);
	if (d + 1 >= n.length) return l;
	const h = n.slice(d + 1);
	if (!s) return l.push(...h), l;
	if (dt(h[0].tokenId, o)) return l.push(...h), l;
	const f = Dc(n, d, o);
	if (f !== void 0 && zc(l, o)) return l.push(...n.slice(f)), l;
	let p = i.at(-1) + 1;
	for (; p < a.length && !dt(a[p].tokenId, o);) l.push(a[p]), p += 1;
	const _ = h.findIndex((b) => dt(b.tokenId, o));
	return _ >= 0 ? l.push(...h.slice(_)) : l.push(...h), l;
}
function Dc(e, t, r) {
	for (let a = t; a >= 0; a -= 1) if (dt(e[a].tokenId, r)) return a;
}
function zc(e, t) {
	for (let r = e.length - 1; r >= 0; r -= 1) if (dt(e[r].tokenId, t)) return e.splice(r), !0;
	return !1;
}
function So(e, t, r, a, n, o) {
	const s = (r + a) / 2;
	let i = e.findIndex((l) => l.startSample >= s);
	i < 0 && (i = e.length);
	let u = t.findIndex((l) => l.startSample >= s);
	if (u < 0 && (u = t.length), o && i > 0) for (; i < e.length && !dt(e[i].tokenId, n);) i += 1;
	if (o) {
		let l = u;
		for (; l < t.length && !dt(t[l].tokenId, n);) l += 1;
		l < t.length && (u = l);
	}
	return [...e.slice(0, i), ...t.slice(u)];
}
function dt(e, t) {
	const r = t(e);
	return r === void 0 || r.length === 0 ? !1 : Sn(r) || /^[\p{P}\p{S}]+$/u.test(r);
}
function Xs(e, t) {
	const r = t(e);
	return r !== void 0 && r.length > 0 && /^[\p{P}\p{S}]+$/u.test(r);
}
function en(e, t, r) {
	if (e === t) return !0;
	const a = r(e), n = r(t);
	return a !== void 0 && n !== void 0 && a.toLowerCase() === n.toLowerCase();
}
function jc(e, t) {
	if (e.length < 2) return [...e];
	const r = [];
	for (const s of e) {
		const i = t(s.tokenId) ?? "";
		r.length === 0 || Sn(i) ? r.push({
			tokens: [s],
			core: "",
			startSample: s.startSample,
			endsSentence: !1
		}) : r.at(-1).tokens.push(s);
	}
	for (const s of r) {
		const i = s.tokens.map((u) => Hc(t(u.tokenId) ?? "")).join("");
		s.core = i.replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, ""), s.endsSentence = /[.?!:]$/u.test(i);
	}
	const a = new Array(r.length).fill(!0);
	let n = -1;
	for (let s = 0; s < r.length; s += 1) {
		if (n < 0) {
			n = s;
			continue;
		}
		const i = r[n], u = r[s];
		if (!(i.core.length > 0 && u.core.length > 0 && i.core !== u.core && i.core.toLowerCase() === u.core.toLowerCase() && /^\p{L}/u.test(u.core) && !i.endsSentence && u.startSample - i.startSample <= jt)) {
			n = s;
			continue;
		}
		u.core === u.core.toLowerCase() && i.core !== i.core.toLowerCase() ? (a[n] = !1, n = s) : a[s] = !1;
	}
	const o = [];
	for (let s = 0; s < r.length; s += 1) a[s] && o.push(...r[s].tokens);
	return o;
}
function Sn(e) {
	return e.startsWith("▁") || e.startsWith(" ");
}
function Hc(e) {
	return Sn(e) ? e.slice(1) : e;
}
function Vc(e) {
	if (Bt(e.index, "window index"), Bt(e.startSample, "window startSample"), Bt(e.endSample, "window endSample"), e.endSample < e.startSample) throw new RangeError("window endSample must not precede startSample");
	let t = Number.NEGATIVE_INFINITY;
	for (const r of e.tokens) {
		if (Bt(r.tokenId, "tokenId"), Bt(r.startSample, "token startSample"), Bt(r.endSample, "token endSample"), Bt(r.durationFrames, "token durationFrames"), r.endSample < r.startSample) throw new RangeError("token endSample must not precede startSample");
		if (r.startSample < t) throw new RangeError("tokens must be sorted by startSample");
		t = r.startSample;
	}
}
function Bt(e, t) {
	if (!Number.isSafeInteger(e) || e < 0) throw new RangeError(`${t} must be a non-negative safe integer`);
}
const Qs = 256;
var vo = class {
	buffers;
	bufferByteLengths;
	byteLength;
	destroyed = !1;
	constructor(e, t, r = "parakeet-activation-arena") {
		const a = typeof t == "number" ? [{
			label: r,
			byteLength: t
		}] : [...t];
		if (a.length === 0) throw new RangeError("Activation arena must contain at least one buffer");
		for (const o of a) Kc(e, o.byteLength);
		const n = [];
		try {
			for (const o of a) n.push(e.createBuffer({
				label: o.label,
				size: o.byteLength,
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
			}));
		} catch (o) {
			for (const s of n) s.destroy();
			throw o;
		}
		this.buffers = Object.freeze(n), this.bufferByteLengths = Object.freeze(a.map((o) => o.byteLength)), this.byteLength = this.bufferByteLengths.reduce((o, s) => o + s, 0);
	}
	get bufferCount() {
		return this.buffers.length;
	}
	get largestBufferByteLength() {
		return Math.max(...this.bufferByteLengths);
	}
	slice(e, t, r, a = 0) {
		this.assertAlive();
		const n = this.bufferByteLengths[a];
		if (n === void 0 || !Number.isSafeInteger(t) || !Number.isSafeInteger(r) || t < 0 || r <= 0 || t % Qs !== 0 || r % 4 !== 0 || t + r > n) throw new RangeError(`Invalid activation slice ${e}`);
		return a === 0 ? {
			label: e,
			byteOffset: t,
			byteLength: r
		} : {
			label: e,
			bufferIndex: a,
			byteOffset: t,
			byteLength: r
		};
	}
	binding(e) {
		return {
			buffer: this.bufferFor(e),
			offset: e.byteOffset,
			size: e.byteLength
		};
	}
	bufferFor(e) {
		this.assertAlive();
		const t = e.bufferIndex ?? 0, r = this.buffers[t], a = this.bufferByteLengths[t];
		if (r === void 0 || a === void 0 || e.byteOffset < 0 || e.byteLength <= 0 || e.byteOffset + e.byteLength > a) throw new RangeError(`Invalid activation slice ${e.label}`);
		return r;
	}
	bufferByteLengthFor(e) {
		return this.bufferFor(e), this.bufferByteLengths[e.bufferIndex ?? 0];
	}
	upload(e, t, r) {
		const a = this.bufferFor(t);
		if (r.byteLength > t.byteLength || r.byteLength % 4 !== 0) throw new RangeError(`Upload does not fit ${t.label}`);
		e.queue.writeBuffer(a, t.byteOffset, r);
	}
	destroy() {
		if (!this.destroyed) {
			this.destroyed = !0;
			for (const e of this.buffers) e.destroy();
		}
	}
	assertAlive() {
		if (this.destroyed) throw new Error("Activation arena was destroyed");
	}
};
function Kc(e, t) {
	if (!Number.isSafeInteger(t) || t <= 0 || t % Qs !== 0) throw new RangeError("Activation arena buffers must be positive 256-byte multiples");
	if (t > e.limits.maxBufferSize || t > e.limits.maxStorageBufferBindingSize) throw new Error("Activation arena exceeds the WebGPU device limits");
}
function yt(e, t) {
	return Math.ceil(e / t) * t;
}
const Js = ["shader-f16", "subgroups"], Yc = ["subgroups"], Zc = ["shader-f16"], Xc = [];
const vn = ["timestamp-query"], Qc = [...Js, ...vn], J = Object.freeze({
	precision: "fp16",
	kernelBackend: "subgroups",
	requiredFeatures: Js
}), ei = Object.freeze({
	precision: "fp32",
	kernelBackend: "subgroups",
	requiredFeatures: Yc
}), Jc = Object.freeze({
	precision: "fp16",
	kernelBackend: "portable",
	requiredFeatures: Zc
}), ed = Object.freeze({
	precision: "fp32",
	kernelBackend: "portable",
	requiredFeatures: Xc
}), ti = [
	"maxBufferSize",
	"maxStorageBufferBindingSize",
	"maxUniformBufferBindingSize",
	"maxBindGroups",
	"maxBindingsPerBindGroup",
	"maxStorageBuffersPerShaderStage",
	"maxUniformBuffersPerShaderStage",
	"maxDynamicStorageBuffersPerPipelineLayout",
	"maxDynamicUniformBuffersPerPipelineLayout",
	"maxComputeWorkgroupStorageSize",
	"maxComputeInvocationsPerWorkgroup",
	"maxComputeWorkgroupSizeX",
	"maxComputeWorkgroupSizeY",
	"maxComputeWorkgroupSizeZ",
	"maxComputeWorkgroupsPerDimension",
	"minStorageBufferOffsetAlignment",
	"minUniformBufferOffsetAlignment"
], ko = /* @__PURE__ */ new Set(["minStorageBufferOffsetAlignment", "minUniformBufferOffsetAlignment"]);
var fr = class extends Error {
	code;
	deficits;
	constructor(e, t, r = []) {
		super(t), this.name = "WebGpuUnavailableError", this.code = e, this.deficits = r;
	}
};
function td(e, t = vn) {
	const r = new Set(e), a = [];
	for (const n of t) !r.has(n) || a.includes(n) || a.push(n);
	return a;
}
function rd(e, t, r) {
	const a = new Set(e), n = a.has("subgroups") && t === 32 && r === 32;
	return a.has("shader-f16") ? n ? J : Jc : n ? ei : ed;
}
function Po(e) {
	const t = e, r = {};
	for (const a of ti) {
		const n = t[a];
		if (typeof n != "number" || !Number.isFinite(n)) throw new TypeError(`WebGPU limit ${a} is unavailable or non-numeric`);
		r[a] = n;
	}
	return Object.freeze(r);
}
function ad(e, t) {
	const r = e, a = [];
	for (const [n, o] of Object.entries(t)) {
		if (o === void 0) continue;
		const s = n;
		if (!ti.includes(s)) throw new TypeError(`Unknown Parakeet WebGPU limit ${n}`);
		if (!Number.isFinite(o) || o < 0 || !Number.isInteger(o)) throw new RangeError(`Requested WebGPU limit ${s} must be a non-negative integer`);
		const i = r[s];
		if (typeof i != "number" || !Number.isFinite(i)) {
			a.push({
				name: s,
				requested: o,
				available: NaN,
				relation: ko.has(s) ? "at-most" : "at-least"
			});
			continue;
		}
		ko.has(s) ? i > o && a.push({
			name: s,
			requested: o,
			available: i,
			relation: "at-most"
		}) : i < o && a.push({
			name: s,
			requested: o,
			available: i,
			relation: "at-least"
		});
	}
	return a;
}
async function nd(e = {}) {
	if (globalThis.isSecureContext === !1) throw new fr("INSECURE_CONTEXT", "WebGPU requires HTTPS or a localhost secure context");
	const t = e.gpu ?? globalThis.navigator?.gpu;
	if (!t) throw new fr("WEBGPU_UNAVAILABLE", "This runtime does not expose navigator.gpu");
	const r = await t.requestAdapter({
		powerPreference: "high-performance",
		forceFallbackAdapter: !1
	});
	if (!r) throw new fr("ADAPTER_UNAVAILABLE", "No WebGPU adapter is available");
	const a = e.requiredLimits ?? {}, n = ad(r.limits, a);
	if (n.length > 0) throw new fr("LIMIT_UNAVAILABLE", `The WebGPU adapter cannot satisfy model limits: ${n.map(({ name: _, requested: b, available: w, relation: g }) => `${_} must be ${g} ${b}; adapter reports ${w}`).join("; ")}`, n);
	const o = $o(r.features), s = od(r), i = rd(o, s.subgroupMinSize, s.subgroupMaxSize), u = i.requiredFeatures.filter((p) => !o.includes(p));
	if (u.length > 0) throw new fr("FEATURE_UNAVAILABLE", `This browser does not expose the required WebGPU feature${u.length === 1 ? "" : "s"}: ` + u.join(", "));
	const l = td(o, e.optionalFeatures ?? vn), c = [...i.requiredFeatures, ...l], d = await r.requestDevice({
		requiredFeatures: c,
		requiredLimits: { ...a },
		defaultQueue: { label: "parakeet-wgsl-default-queue" },
		label: "parakeet-wgsl-device"
	}), h = $o(d.features), f = {};
	for (const p of Qc) f[p] = Object.freeze({
		adapterSupported: o.includes(p),
		deviceEnabled: h.includes(p),
		required: i.requiredFeatures.includes(p),
		requested: c.includes(p)
	});
	return {
		adapter: r,
		device: d,
		executionProfile: i,
		report: Object.freeze({
			executionProfile: i,
			adapterInfo: s,
			adapterFeatures: o,
			deviceFeatures: h,
			stockFeatures: Object.freeze(f),
			requiredFeatures: Object.freeze([...i.requiredFeatures]),
			requestedOptionalFeatures: Object.freeze([...l]),
			adapterLimits: Po(r.limits),
			deviceLimits: Po(d.limits),
			requestedLimits: Object.freeze({ ...a })
		})
	};
}
function $o(e) {
	return Array.from(e, String).sort();
}
function od(e) {
	const t = e.info, r = Ro(t.subgroupMinSize), a = Ro(t.subgroupMaxSize), n = typeof t.isFallbackAdapter == "boolean" ? t.isFallbackAdapter : void 0;
	return Object.freeze({
		vendor: Yr(t.vendor),
		architecture: Yr(t.architecture),
		device: Yr(t.device),
		description: Yr(t.description),
		...r === void 0 ? {} : { subgroupMinSize: r },
		...a === void 0 ? {} : { subgroupMaxSize: a },
		...n === void 0 ? {} : { isFallbackAdapter: n }
	});
}
function Yr(e) {
	return typeof e == "string" ? e : "";
}
function Ro(e) {
	return typeof e == "number" && Number.isFinite(e) ? e : void 0;
}
function ri(e, t, r) {
	for (const [o, s] of [
		["parameterBytes", e],
		["slotCapacity", t],
		["minUniformBufferOffsetAlignment", r]
	]) if (!Number.isSafeInteger(s) || s <= 0) throw new RangeError(`${o} must be a positive integer`);
	if (e % 4 !== 0) throw new RangeError("Uniform parameter bytes must be word aligned");
	const a = Math.ceil(e / r) * r, n = a * t;
	if (!Number.isSafeInteger(n)) throw new RangeError("Uniform parameter pool is too large");
	return {
		parameterBytes: e,
		slotCapacity: t,
		slotStride: a,
		byteLength: n
	};
}
var ar = class {
	device;
	parameterBytes;
	slotCapacity;
	byteLength;
	slotStride;
	buffer;
	bindings = /* @__PURE__ */ new Map();
	destroyed = !1;
	constructor(e, t, r, a) {
		this.device = e, this.parameterBytes = t, this.slotCapacity = r;
		const n = ri(t, r, e.limits.minUniformBufferOffsetAlignment);
		this.byteLength = n.byteLength, this.slotStride = n.slotStride, this.buffer = e.createBuffer({
			label: a,
			size: n.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});
	}
	get usedSlots() {
		return this.bindings.size;
	}
	bindingFor(e, t) {
		if (this.destroyed) throw new Error("Uniform parameter pool was destroyed");
		const r = sd(t);
		if (r.byteLength !== this.parameterBytes) throw new RangeError(`${e} parameters must be exactly ${this.parameterBytes} bytes`);
		const a = id(r), n = this.bindings.get(a);
		if (n !== void 0) return n;
		if (this.bindings.size >= this.slotCapacity) throw new Error(`${e} exceeds uniform parameter pool capacity ${this.slotCapacity}`);
		const o = this.bindings.size * this.slotStride;
		this.device.queue.writeBuffer(this.buffer, o, t);
		const s = {
			buffer: this.buffer,
			offset: o,
			size: this.parameterBytes
		};
		return this.bindings.set(a, s), s;
	}
	destroy() {
		this.destroyed || (this.destroyed = !0, this.bindings.clear(), this.buffer.destroy());
	}
};
function sd(e) {
	return ArrayBuffer.isView(e) ? new Uint8Array(e.buffer, e.byteOffset, e.byteLength) : new Uint8Array(e);
}
function id(e) {
	let t = `${e.byteLength}:`;
	for (const r of e) t += r.toString(16).padStart(2, "0");
	return t;
}
const ke = 192, pt = 32, Vt = ke / pt, ai = 128, kn = 8, Mt = 1024, te = ai / 4, Na = Mt * 3 / 4, Zr = Mt / 4, ge = 6, Kt = 16, Fa = 8;
const ud = 14888, ld = 14888;
var cd = class {
	label;
	output;
	pipeline;
	bindGroup;
	workgroups;
	destroyed = !1;
	constructor(e, t, r, a, n) {
		this.label = e, this.output = t, this.pipeline = r, this.bindGroup = a, this.workgroups = n;
	}
	encode(e, t, r) {
		if (this.destroyed) throw new Error(`${this.label} was destroyed`);
		const a = r?.batchSize ?? this.workgroups[2];
		if (!Number.isSafeInteger(a) || a <= 0 || a > this.workgroups[2]) throw new RangeError(`${this.label} active batch must be in [1, ${this.workgroups[2]}]`);
		const n = e.beginComputePass(t === void 0 ? { label: this.label } : {
			label: this.label,
			timestampWrites: t
		});
		n.setPipeline(this.pipeline), n.setBindGroup(0, this.bindGroup), n.dispatchWorkgroups(this.workgroups[0], this.workgroups[1], a), n.end();
	}
	destroy() {
		this.destroyed || (this.destroyed = !0);
	}
}, Bo = class ni {
	device;
	arena;
	pipeline;
	layout;
	parameterPool;
	executionProfile;
	destroyed = !1;
	constructor(t, r, a, n, o, s) {
		this.device = t, this.arena = r, this.pipeline = a, this.layout = n, this.parameterPool = o, this.executionProfile = s;
	}
	get uniformParameterPoolBytes() {
		return this.parameterPool.byteLength;
	}
	get uniformParameterPoolUsedSlots() {
		return this.parameterPool.usedSlots;
	}
	static async create(t, r, a, n = J) {
		if (n.kernelBackend === "subgroups" && !t.features.has("subgroups")) throw new Error("Parakeet relative attention requires WebGPU subgroups");
		if (n.precision === "fp16" && !t.features.has("shader-f16")) throw new Error("Parakeet FP16 relative attention requires WebGPU shader-f16");
		if (t.limits.maxComputeInvocationsPerWorkgroup < ke || t.limits.maxComputeWorkgroupSizeX < ke) throw new Error(`Parakeet relative attention requires a ${ke}-lane workgroup`);
		const o = pd(n);
		if (t.limits.maxComputeWorkgroupStorageSize < o) throw new Error(`Parakeet relative attention requires ${o} bytes of workgroup storage`);
		const s = n.kernelBackend === "portable" ? n.precision === "fp16" ? "parakeet-relative-attention-portable" : "parakeet-relative-attention-fp32-portable" : n.precision === "fp16" ? "parakeet-relative-attention" : "parakeet-relative-attention-fp32", i = t.createBindGroupLayout({
			label: "parakeet-relative-attention-bindings",
			entries: [
				xt(0, !1),
				xt(1, !0),
				xt(2, !0),
				xt(3, !0),
				xt(4, !1),
				xt(5, !1),
				{
					binding: 6,
					visibility: GPUShaderStage.COMPUTE,
					buffer: { type: "uniform" }
				}
			]
		}), u = t.createShaderModule({
			label: s,
			code: fd(n)
		}), l = (await u.getCompilationInfo()).messages.filter((h) => h.type === "error");
		if (l.length > 0) throw new Error(`Relative attention WGSL failed: ${l.map((h) => h.message).join("; ")}`);
		const c = await t.createComputePipelineAsync({
			label: s,
			layout: t.createPipelineLayout({ bindGroupLayouts: [i] }),
			compute: {
				module: u,
				entryPoint: "main"
			}
		}), d = new ar(t, 32, a, "parakeet-relative-attention-parameter-pool");
		return new ni(t, r, c, i, d, n);
	}
	createDispatch(t) {
		if (t.batchSize <= 0 || t.frames <= 0 || t.frames > ke) throw new RangeError(`Unsupported attention shape for ${t.label}`);
		const r = t.frames * 2 - 1, a = oi(this.executionProfile), n = Xr([t.batchSize, t.frames], `${t.label} attention rows`);
		Ua(t.qkv, Xr([
			n,
			Mt * 3,
			a
		], `${t.label} attention QKV`), "QKV", t.label), Ua(t.output, Xr([
			n,
			Mt,
			a
		], `${t.label} attention output`), "output", t.label), Ua(t.validLengths, Xr([t.batchSize, Uint32Array.BYTES_PER_ELEMENT], `${t.label} attention valid lengths`), "valid lengths", t.label), dd(t.projectedPositions, r, this.executionProfile), Ao(t.biasU, `${t.label} bias U`), Ao(t.biasV, `${t.label} bias V`);
		const o = /* @__PURE__ */ new ArrayBuffer(32);
		new Uint32Array(o, 0, 3).set([
			t.batchSize,
			t.frames,
			t.frames * 2 - 1
		]);
		const s = this.parameterPool.bindingFor(t.label, o), i = this.device.createBindGroup({
			label: `${t.label}-bindings`,
			layout: this.layout,
			entries: [
				{
					binding: 0,
					resource: this.arena.binding(t.qkv)
				},
				{
					binding: 1,
					resource: t.projectedPositions.binding
				},
				{
					binding: 2,
					resource: t.biasU.binding
				},
				{
					binding: 3,
					resource: t.biasV.binding
				},
				{
					binding: 4,
					resource: this.arena.binding(t.validLengths)
				},
				{
					binding: 5,
					resource: this.arena.binding(t.output)
				},
				{
					binding: 6,
					resource: s
				}
			]
		});
		return new cd(t.label, t.output, this.pipeline, i, [
			Math.ceil(t.frames / ge),
			kn,
			t.batchSize
		]);
	}
	destroy() {
		this.destroyed || (this.destroyed = !0, this.parameterPool.destroy());
	}
};
function dd(e, t, r) {
	const a = [t, Mt], n = [
		kn,
		te,
		t,
		4
	], o = r.precision === "fp16" ? "float16" : "float32", s = oi(r), i = e.runtimeRecord;
	if (i.dtype !== o || i.layout !== "head-vector-position-vec4" || i.byteLength !== t * Mt * s || !la(i.logicalShape, a) || !la(i.storageShape, n)) throw new Error(`Projected positions must be ${o} head-vector-position-vec4, logical [${a.join(",")}], storage [${n.join(",")}]`);
}
function Ao(e, t) {
	const r = [kn, ai], a = e.runtimeRecord;
	if (a.dtype !== "float32" || a.layout !== "head-by-channel" || a.byteLength !== Mt * Float32Array.BYTES_PER_ELEMENT || !la(a.logicalShape, r) || !la(a.storageShape, r)) throw new Error(`${t} must be float32 head-by-channel logical/storage [${r.join(",")}]`);
}
function oi(e) {
	return e.precision === "fp16" ? 2 : 4;
}
function Ua(e, t, r, a) {
	if (e.byteLength < t) throw new RangeError(`${a} ${r} needs ${t} bytes; arena slice has ${e.byteLength}`);
}
function Xr(e, t) {
	const r = e.reduce((a, n) => a * n, 1);
	if (!Number.isSafeInteger(r) || r <= 0) throw new RangeError(`${t} byte length exceeds the safe integer range`);
	return r;
}
function la(e, t) {
	return e.length === t.length && e.every((r, a) => r === t[a]);
}
function xt(e, t) {
	return {
		binding: e,
		visibility: GPUShaderStage.COMPUTE,
		buffer: { type: t ? "read-only-storage" : "storage" }
	};
}
const tn = `
enable f16;
enable subgroups;

struct Params {
  batch_size: u32,
  frames: u32,
  position_rows: u32,
  _pad0: u32,
  _pad1: vec4<u32>,
};

@group(0) @binding(0) var<storage, read_write> qkv: array<vec4<f16>>;
@group(0) @binding(1) var<storage, read> positions: array<vec4<f16>>;
@group(0) @binding(2) var<storage, read> bias_u: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> bias_v: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> valid_lengths: array<u32>;
@group(0) @binding(5) var<storage, read_write> context: array<vec4<f16>>;
@group(0) @binding(6) var<uniform> params: Params;

var<workgroup> query_u: array<
  vec4<f32>,
  ${ge * te}
>;
var<workgroup> query_v: array<
  vec4<f32>,
  ${ge * te}
>;
var<workgroup> scores: array<
  f32,
  ${ge * ke}
>;
var<workgroup> value_tile: array<
  vec4<f16>,
  ${Kt * te}
>;
var<workgroup> subgroup_partials: array<f32, ${Vt}>;
var<workgroup> valid_shared: u32;
var<workgroup> reduction_shared: f32;

fn accumulate_score_vector(
  query_with_u: vec4<f32>,
  query_with_v: vec4<f32>,
  key: vec4<f32>,
  relative_key: vec4<f32>,
  initial: f32,
) -> f32 {
  var result = initial;
  result = fma(query_with_u.x, key.x, result);
  result = fma(query_with_v.x, relative_key.x, result);
  result = fma(query_with_u.y, key.y, result);
  result = fma(query_with_v.y, relative_key.y, result);
  result = fma(query_with_u.z, key.z, result);
  result = fma(query_with_v.z, relative_key.z, result);
  result = fma(query_with_u.w, key.w, result);
  result = fma(query_with_v.w, relative_key.w, result);
  return result;
}

@compute @workgroup_size(${ke}, 1, 1)
fn main(
  @builtin(local_invocation_index) lane: u32,
  @builtin(subgroup_invocation_id) subgroup_lane: u32,
  @builtin(subgroup_id) subgroup_slot: u32,
  @builtin(subgroup_size) subgroup_size: u32,
  @builtin(workgroup_id) group: vec3<u32>,
) {
  let query_base = group.x * ${ge}u;
  let head = group.y;
  let batch = group.z;
  let head_vector_offset = head * ${te}u;

  if (lane == 0u) {
    valid_shared = min(valid_lengths[batch], params.frames);
  }
  workgroupBarrier();
  if (subgroup_size != ${pt}u) {
    return;
  }
  let valid = workgroupUniformLoad(&valid_shared);

  if (query_base >= valid) {
    if (lane < ${ge * te}u) {
      let query_slot = lane / ${te}u;
      let vector = lane - query_slot * ${te}u;
      let query = query_base + query_slot;
      if (query < params.frames) {
        let row = batch * params.frames + query;
        context[
          row * ${Zr}u
          + head_vector_offset
          + vector
        ] = vec4<f16>(0.0h);
      }
    }
    return;
  }

  if (lane < ${ge * te}u) {
    let query_slot = lane / ${te}u;
    let vector = lane - query_slot * ${te}u;
    let query = query_base + query_slot;
    let query_shared_index = query_slot * ${te}u + vector;
    if (query < params.frames) {
      let row = batch * params.frames + query;
      let query_vector = vec4<f32>(
        qkv[
          row * ${Na}u
          + head_vector_offset
          + vector
        ]
      );
      query_u[query_shared_index] =
        query_vector + bias_u[head_vector_offset + vector];
      query_v[query_shared_index] =
        query_vector + bias_v[head_vector_offset + vector];
    } else {
      query_u[query_shared_index] = vec4<f32>(0.0);
      query_v[query_shared_index] = vec4<f32>(0.0);
    }
  }
  workgroupBarrier();

  var query_scores: array<f32, ${ge}>;
  for (
    var query_slot = 0u;
    query_slot < ${ge}u;
    query_slot += 1u
  ) {
    query_scores[query_slot] = select(
      -3.402823466e+38,
      0.0,
      lane < valid
    );
  }

  if (lane < valid) {
    let key_row = batch * params.frames + lane;
    for (var vector = 0u; vector < ${te}u; vector += 1u) {
      let key = vec4<f32>(
        qkv[
          key_row * ${Na}u
          + ${Zr}u
          + head_vector_offset
          + vector
        ]
      );
      for (
        var query_slot = 0u;
        query_slot < ${ge}u;
        query_slot += 1u
      ) {
        let query = query_base + query_slot;
        if (query < valid) {
          let relative_position = params.frames - 1u - query + lane;
          let relative_key = vec4<f32>(
            positions[
              (head_vector_offset + vector) * params.position_rows
              + relative_position
            ]
          );
          let query_shared_index =
            query_slot * ${te}u + vector;
          query_scores[query_slot] = accumulate_score_vector(
            query_u[query_shared_index],
            query_v[query_shared_index],
            key,
            relative_key,
            query_scores[query_slot]
          );
        }
      }
    }
    for (
      var query_slot = 0u;
      query_slot < ${ge}u;
      query_slot += 1u
    ) {
      if (query_base + query_slot < valid) {
        query_scores[query_slot] *= ${1 / Math.sqrt(128)};
      }
    }
  }

  for (
    var query_slot = 0u;
    query_slot < ${ge}u;
    query_slot += 1u
  ) {
    let score_index = query_slot * ${ke}u + lane;
    scores[score_index] = query_scores[query_slot];

    let subgroup_maximum = subgroupMax(query_scores[query_slot]);
    if (subgroup_lane == 0u) {
      subgroup_partials[subgroup_slot] = subgroup_maximum;
    }
    workgroupBarrier();
    if (lane == 0u) {
      var maximum = -3.402823466e+38;
      for (
        var subgroup = 0u;
        subgroup < ${Vt}u;
        subgroup += 1u
      ) {
        maximum = max(maximum, subgroup_partials[subgroup]);
      }
      reduction_shared = maximum;
    }
    workgroupBarrier();
    let maximum = workgroupUniformLoad(&reduction_shared);
    var exponential = 0.0;
    if (lane < valid) {
      exponential = exp(query_scores[query_slot] - maximum);
    }

    let subgroup_sum = subgroupAdd(exponential);
    if (subgroup_lane == 0u) {
      subgroup_partials[subgroup_slot] = subgroup_sum;
    }
    workgroupBarrier();
    if (lane == 0u) {
      var sum = 0.0;
      for (
        var subgroup = 0u;
        subgroup < ${Vt}u;
        subgroup += 1u
      ) {
        sum += subgroup_partials[subgroup];
      }
      reduction_shared = 1.0 / sum;
    }
    workgroupBarrier();
    let inverse_sum = workgroupUniformLoad(&reduction_shared);
    scores[score_index] = exponential * inverse_sum;
  }
  workgroupBarrier();

  let output_lane =
    lane < ${ge * te}u;
  let output_query_slot = lane / ${te}u;
  let output_vector =
    lane - output_query_slot * ${te}u;
  let output_query = query_base + output_query_slot;
  var output_value = vec4<f32>(0.0);

  for (
    var tile_start = 0u;
    tile_start < valid;
    tile_start += ${Kt}u
  ) {
    let tile_keys = min(${Kt}u, valid - tile_start);
    let tile_vectors = tile_keys * ${te}u;
    for (
      var tile_vector = lane;
      tile_vector < tile_vectors;
      tile_vector += ${ke}u
    ) {
      let key_in_tile = tile_vector / ${te}u;
      let vector =
        tile_vector - key_in_tile * ${te}u;
      let key_row = batch * params.frames + tile_start + key_in_tile;
      value_tile[tile_vector] =
        qkv[
          key_row * ${Na}u
          + ${Zr * 2}u
          + head_vector_offset
          + vector
        ];
    }
    workgroupBarrier();
    if (output_lane && output_query < valid) {
      for (
        var key_in_tile = 0u;
        key_in_tile < tile_keys;
        key_in_tile += 1u
      ) {
        let probability =
          scores[
            output_query_slot * ${ke}u
            + tile_start
            + key_in_tile
          ];
        let value = vec4<f32>(
          value_tile[
            key_in_tile * ${te}u + output_vector
          ]
        );
        output_value = fma(
          vec4<f32>(probability),
          value,
          output_value
        );
      }
    }
    workgroupBarrier();
  }

  if (output_lane && output_query < params.frames) {
    let row = batch * params.frames + output_query;
    context[
      row * ${Zr}u
      + head_vector_offset
      + output_vector
    ] = select(
      vec4<f16>(0.0h),
      vec4<f16>(output_value),
      output_query < valid
    );
  }
}
`, hd = si(tn);
let Ga, To;
function fd(e = J) {
	return e.kernelBackend === "portable" ? (Ga ??= md(tn), e.precision === "fp16" ? Ga : (To ??= si(Ga), To)) : e.precision === "fp16" ? tn : hd;
}
function pd(e = J) {
	return e.precision === "fp16" ? ud : ld;
}
function si(e) {
	let t = _d(e);
	return t = At(t, `var<workgroup> value_tile: array<
  vec4<f32>,
  ${Kt * te}
>;`, `var<workgroup> value_tile: array<
  vec4<f32>,
  ${Fa * te}
>;`), t = At(t, `tile_start += ${Kt}u`, `tile_start += ${Fa}u`), At(t, `let tile_keys = min(${Kt}u, valid - tile_start);`, `let tile_keys = min(${Fa}u, valid - tile_start);`);
}
function _d(e) {
	return e.replace(`enable f16;
`, "").replaceAll("f16", "f32").replaceAll("0.0h", "0.0");
}
function md(e) {
	let t = At(e, `enable subgroups;
`, "");
	t = At(t, `var<workgroup> subgroup_partials: array<f32, ${Vt}>;
var<workgroup> valid_shared: u32;
var<workgroup> reduction_shared: f32;`, `var<workgroup> reduction_a: vec4<f32>;
var<workgroup> reduction_b: vec4<f32>;
var<workgroup> valid_shared: u32;`), t = At(t, `  @builtin(local_invocation_index) lane: u32,
  @builtin(subgroup_invocation_id) subgroup_lane: u32,
  @builtin(subgroup_id) subgroup_slot: u32,
  @builtin(subgroup_size) subgroup_size: u32,
  @builtin(workgroup_id) group: vec3<u32>,`, `  @builtin(local_invocation_index) lane: u32,
  @builtin(workgroup_id) group: vec3<u32>,`), t = At(t, `  workgroupBarrier();
  if (subgroup_size != ${pt}u) {
    return;
  }
  let valid = workgroupUniformLoad(&valid_shared);`, `  workgroupBarrier();
  let valid = workgroupUniformLoad(&valid_shared);`);
	const r = `  for (
    var query_slot = 0u;
    query_slot < ${ge}u;
    query_slot += 1u
  ) {
    let score_index = query_slot * ${ke}u + lane;`, a = t.indexOf(r), n = t.indexOf(`
  let output_lane =`, a);
	if (a < 0 || n < 0) throw new Error("Unable to construct portable attention softmax");
	const o = `  // Preserve every raw score while all six query reductions run together.
  for (
    var query_slot = 0u;
    query_slot < ${ge}u;
    query_slot += 1u
  ) {
    scores[query_slot * ${ke}u + lane] =
      query_scores[query_slot];
  }
  // query_u/query_v are no longer read after score production. Wait for every
  // lane before reusing them as two vec4 reduction records per key lane.
  workgroupBarrier();
  query_u[lane] = vec4<f32>(
    query_scores[0u],
    query_scores[1u],
    query_scores[2u],
    query_scores[3u]
  );
  query_v[lane] = vec4<f32>(
    query_scores[4u],
    query_scores[5u],
    -3.402823466e+38,
    -3.402823466e+38
  );
  workgroupBarrier();

  let virtual_lane = lane & ${pt - 1}u;
  for (var offset = 1u; offset < ${pt}u; offset *= 2u) {
    if ((virtual_lane & (offset * 2u - 1u)) == 0u) {
      query_u[lane] = max(query_u[lane], query_u[lane + offset]);
      query_v[lane] = max(query_v[lane], query_v[lane + offset]);
    }
    workgroupBarrier();
  }
  if (lane == 0u) {
    var maximum_a = vec4<f32>(-3.402823466e+38);
    var maximum_b = vec4<f32>(-3.402823466e+38);
    for (
      var virtual_group = 0u;
      virtual_group < ${Vt}u;
      virtual_group += 1u
    ) {
      let base = virtual_group * ${pt}u;
      maximum_a = max(maximum_a, query_u[base]);
      maximum_b = max(maximum_b, query_v[base]);
    }
    reduction_a = maximum_a;
    reduction_b = maximum_b;
  }
  workgroupBarrier();
  let maximum_a = workgroupUniformLoad(&reduction_a);
  let maximum_b = workgroupUniformLoad(&reduction_b);

  for (
    var query_slot = 0u;
    query_slot < ${ge}u;
    query_slot += 1u
  ) {
    var maximum = 0.0;
    if (query_slot < 4u) {
      maximum = maximum_a[query_slot];
    } else {
      maximum = maximum_b[query_slot - 4u];
    }
    var exponential = 0.0;
    if (lane < valid) {
      exponential = exp(
        scores[query_slot * ${ke}u + lane] - maximum
      );
    }
    query_scores[query_slot] = exponential;
    scores[query_slot * ${ke}u + lane] = exponential;
  }
  query_u[lane] = vec4<f32>(
    query_scores[0u],
    query_scores[1u],
    query_scores[2u],
    query_scores[3u]
  );
  query_v[lane] = vec4<f32>(
    query_scores[4u],
    query_scores[5u],
    0.0,
    0.0
  );
  workgroupBarrier();

  for (var offset = 1u; offset < ${pt}u; offset *= 2u) {
    if ((virtual_lane & (offset * 2u - 1u)) == 0u) {
      query_u[lane] += query_u[lane + offset];
      query_v[lane] += query_v[lane + offset];
    }
    workgroupBarrier();
  }
  if (lane == 0u) {
    var sum_a = vec4<f32>(0.0);
    var sum_b = vec4<f32>(0.0);
    for (
      var virtual_group = 0u;
      virtual_group < ${Vt}u;
      virtual_group += 1u
    ) {
      let base = virtual_group * ${pt}u;
      sum_a += query_u[base];
      sum_b += query_v[base];
    }
    reduction_a = vec4<f32>(1.0) / sum_a;
    reduction_b = vec4<f32>(
      1.0 / sum_b.x,
      1.0 / sum_b.y,
      0.0,
      0.0
    );
  }
  workgroupBarrier();
  let inverse_a = workgroupUniformLoad(&reduction_a);
  let inverse_b = workgroupUniformLoad(&reduction_b);
  for (
    var query_slot = 0u;
    query_slot < ${ge}u;
    query_slot += 1u
  ) {
    var inverse_sum = 0.0;
    if (query_slot < 4u) {
      inverse_sum = inverse_a[query_slot];
    } else {
      inverse_sum = inverse_b[query_slot - 4u];
    }
    scores[query_slot * ${ke}u + lane] =
      query_scores[query_slot] * inverse_sum;
  }
  workgroupBarrier();
`;
	return t = t.slice(0, a) + o + t.slice(n), t;
}
function At(e, t, r) {
	if (!e.includes(t)) throw new Error(`Unable to construct FP32 attention shader: ${t}`);
	return e.replace(t, r);
}
const Et = 1024, ii = 2048;
const gd = "kernel-channel-vec4", Lo = "channel", Qe = 8, tr = 16, ui = Qe * tr, li = Et / 4, bd = ii / 4, wd = Math.floor(9 / 2), rn = 24 * Qe, an = rn * 4 * Float32Array.BYTES_PER_ELEMENT;
function yd(e, t = J) {
	Io(e.batchSize, "batchSize"), Io(e.frames, "frames");
	const r = Ot([e.batchSize, e.frames], "Conformer rows"), a = kd(t);
	return {
		...e,
		rows: r,
		inputByteLength: Ot([
			r,
			ii,
			a
		], "Conformer pointwise input bytes"),
		outputByteLength: Ot([
			r,
			Et,
			a
		], "Conformer convolution output bytes"),
		validLengthsByteLength: Ot([e.batchSize, Uint32Array.BYTES_PER_ELEMENT], "Conformer valid-length bytes"),
		depthwiseWeightByteLength: Ot([
			9,
			Et,
			a
		], "Conformer depthwise weight bytes"),
		affineByteLength: Ot([Et, Float32Array.BYTES_PER_ELEMENT], "Conformer folded batch norm bytes"),
		workgroups: [
			Math.ceil(li / Qe),
			Math.ceil(e.frames / tr),
			e.batchSize
		],
		workgroupStorageBytes: an
	};
}
var Ed = class {
	label;
	result;
	pipeline;
	bindGroup;
	workgroups;
	destroyed = !1;
	constructor(e, t, r, a, n) {
		this.label = e, this.result = t, this.pipeline = r, this.bindGroup = a, this.workgroups = n;
	}
	encode(e, t, r) {
		if (this.destroyed) throw new Error(`${this.label} was destroyed`);
		const a = r?.batchSize ?? this.workgroups[2];
		if (!Number.isSafeInteger(a) || a <= 0 || a > this.workgroups[2]) throw new RangeError(`${this.label} active batch must be in [1, ${this.workgroups[2]}]`);
		const n = e.beginComputePass(t === void 0 ? { label: this.label } : {
			label: this.label,
			timestampWrites: t
		});
		n.setPipeline(this.pipeline), n.setBindGroup(0, this.bindGroup), n.dispatchWorkgroups(this.workgroups[0], this.workgroups[1], a), n.end();
	}
	destroy() {
		this.destroyed || (this.destroyed = !0);
	}
}, Mo = class ci {
	device;
	arena;
	pipeline;
	layout;
	parameterPool;
	executionProfile;
	destroyed = !1;
	constructor(t, r, a, n, o, s) {
		this.device = t, this.arena = r, this.pipeline = a, this.layout = n, this.parameterPool = o, this.executionProfile = s;
	}
	get uniformParameterPoolBytes() {
		return this.parameterPool.byteLength;
	}
	get uniformParameterPoolUsedSlots() {
		return this.parameterPool.usedSlots;
	}
	static async create(t, r, a, n = J) {
		Sd(t, n);
		const o = n.precision === "fp16" ? "parakeet-conformer-conv" : "parakeet-conformer-conv-fp32", s = t.createBindGroupLayout({
			label: "parakeet-conformer-conv-bindings",
			entries: [
				Nt(0, !1),
				Nt(1, !0),
				Nt(2, !0),
				Nt(3, !0),
				Nt(4, !1),
				Nt(5, !1),
				{
					binding: 6,
					visibility: GPUShaderStage.COMPUTE,
					buffer: { type: "uniform" }
				}
			]
		}), i = t.createShaderModule({
			label: o,
			code: $d(n)
		}), u = (await i.getCompilationInfo()).messages.filter((d) => d.type === "error");
		if (u.length > 0) throw new Error(`Conformer convolution WGSL failed: ${u.map((d) => d.message).join("; ")}`);
		const l = await t.createComputePipelineAsync({
			label: o,
			layout: t.createPipelineLayout({ bindGroupLayouts: [s] }),
			compute: {
				module: i,
				entryPoint: "main"
			}
		}), c = new ar(t, 16, a, "parakeet-conformer-conv-parameter-pool");
		return new ci(t, r, l, s, c, n);
	}
	createDispatch(t) {
		const r = yd(t, this.executionProfile);
		Wa(t.pointwiseInput, r.inputByteLength, "pointwise input", t.label), Wa(t.output, r.outputByteLength, "output", t.label), Wa(t.validLengths, r.validLengthsByteLength, "valid lengths", t.label), qa(t.depthwiseWeights, this.executionProfile.precision === "fp16" ? "float16" : "float32", [9, Et], gd, r.depthwiseWeightByteLength, `${t.label} depthwise weights`), qa(t.batchNormScale, "float32", [Et], Lo, r.affineByteLength, `${t.label} folded batch norm scale`), qa(t.batchNormShift, "float32", [Et], Lo, r.affineByteLength, `${t.label} folded batch norm shift`), vd(this.device, r.workgroups, t.label);
		const a = this.parameterPool.bindingFor(t.label, new Uint32Array([
			t.batchSize,
			t.frames,
			li,
			bd
		])), n = this.device.createBindGroup({
			label: `${t.label}-bindings`,
			layout: this.layout,
			entries: [
				{
					binding: 0,
					resource: this.arena.binding(t.pointwiseInput)
				},
				{
					binding: 1,
					resource: t.depthwiseWeights.binding
				},
				{
					binding: 2,
					resource: t.batchNormScale.binding
				},
				{
					binding: 3,
					resource: t.batchNormShift.binding
				},
				{
					binding: 4,
					resource: this.arena.binding(t.output)
				},
				{
					binding: 5,
					resource: this.arena.binding(t.validLengths)
				},
				{
					binding: 6,
					resource: a
				}
			]
		});
		return new Ed(t.label, {
			output: t.output,
			rows: r.rows,
			channels: Et
		}, this.pipeline, n, r.workgroups);
	}
	destroy() {
		this.destroyed || (this.destroyed = !0, this.parameterPool.destroy());
	}
};
function Sd(e, t) {
	if (t.precision === "fp16" && !e.features.has("shader-f16")) throw new Error("Parakeet Conformer convolution requires WebGPU shader-f16");
	if (e.limits.maxComputeInvocationsPerWorkgroup < ui || e.limits.maxComputeWorkgroupSizeX < Qe || e.limits.maxComputeWorkgroupSizeY < tr) throw new Error(`Parakeet Conformer convolution requires a ${Qe}x${tr} workgroup`);
	if (e.limits.maxComputeWorkgroupStorageSize < an) throw new Error(`Parakeet Conformer convolution requires ${an} workgroup bytes`);
}
function vd(e, t, r) {
	const a = e.limits.maxComputeWorkgroupsPerDimension;
	if (t.some((n) => n > a)) throw new RangeError(`${r} dispatch exceeds maxComputeWorkgroupsPerDimension`);
}
function Wa(e, t, r, a) {
	if (e.byteLength < t) throw new RangeError(`${a} ${r} needs ${t} bytes; arena slice has ${e.byteLength}`);
}
function qa(e, t, r, a, n, o) {
	const s = e.runtimeRecord, i = r.length === 2 ? [
		r[0],
		r[1] / 4,
		4
	] : r;
	if (s.dtype !== t || s.layout !== a || s.byteLength !== n || !Co(s.logicalShape, r) || !Co(s.storageShape, i)) throw new Error(`${o} must be ${t} ${a} logical [${r.join(",")}], storage [${i.join(",")}], ${n} bytes`);
}
function kd(e) {
	return e.precision === "fp16" ? 2 : 4;
}
function Co(e, t) {
	return e.length === t.length && e.every((r, a) => r === t[a]);
}
function Ot(e, t) {
	const r = e.reduce((a, n) => a * n, 1);
	if (!Number.isSafeInteger(r) || r <= 0) throw new RangeError(`${t} exceeds the safe integer range`);
	return r;
}
function Io(e, t) {
	if (!Number.isSafeInteger(e) || e <= 0) throw new RangeError(`${t} must be a positive integer`);
}
function Nt(e, t) {
	return {
		binding: e,
		visibility: GPUShaderStage.COMPUTE,
		buffer: { type: t ? "read-only-storage" : "storage" }
	};
}
const di = `
enable f16;

struct Params {
  batch_size: u32,
  frames: u32,
  channel_vectors: u32,
  input_vectors_per_row: u32,
};

@group(0) @binding(0) var<storage, read_write> pointwise_input: array<vec4<f16>>;
@group(0) @binding(1) var<storage, read> depthwise_weights: array<vec4<f16>>;
@group(0) @binding(2) var<storage, read> batch_norm_scale: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> batch_norm_shift: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> output: array<vec4<f16>>;
@group(0) @binding(5) var<storage, read_write> valid_lengths: array<u32>;
@group(0) @binding(6) var<uniform> params: Params;

var<workgroup> glu_tile: array<vec4<f32>, ${rn}>;

fn sigmoid(value: vec4<f32>) -> vec4<f32> {
  let bounded = clamp(value, vec4<f32>(-20.0), vec4<f32>(20.0));
  return vec4<f32>(1.0) / (vec4<f32>(1.0) + exp(-bounded));
}

@compute @workgroup_size(${Qe}, ${tr}, 1)
fn main(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(local_invocation_index) local_index: u32,
  @builtin(workgroup_id) group: vec3<u32>,
) {
  let channel_vector_base = group.x * ${Qe}u;
  let frame_base = group.y * ${tr}u;

  for (
    var item = local_index;
    item < ${rn}u;
    item += ${ui}u
  ) {
    let tile_frame = item / ${Qe}u;
    let tile_channel = item % ${Qe}u;
    let channel_vector = channel_vector_base + tile_channel;
    let signed_frame =
      i32(frame_base + tile_frame) - ${wd};
    var glu = vec4<f32>(0.0);
    if (
      group.z < params.batch_size &&
      signed_frame >= 0 &&
      signed_frame < i32(params.frames) &&
      signed_frame < i32(valid_lengths[group.z]) &&
      channel_vector < params.channel_vectors
    ) {
      let row = group.z * params.frames + u32(signed_frame);
      let row_base = row * params.input_vectors_per_row;
      let value = vec4<f32>(
        pointwise_input[row_base + channel_vector]
      );
      let gate = vec4<f32>(
        pointwise_input[
          row_base + params.channel_vectors + channel_vector
        ]
      );
      glu = value * sigmoid(gate);
    }
    glu_tile[item] = glu;
  }
  workgroupBarrier();

  let frame = frame_base + local_id.y;
  let channel_vector = channel_vector_base + local_id.x;
  if (
    group.z >= params.batch_size ||
    frame >= params.frames ||
    channel_vector >= params.channel_vectors
  ) {
    return;
  }

  var sum = vec4<f32>(0.0);
  for (
    var kernel_index = 0u;
    kernel_index < 9u;
    kernel_index += 1u
  ) {
    let shared_index =
      (local_id.y + kernel_index) * ${Qe}u
      + local_id.x;
    let weight_index =
      kernel_index * params.channel_vectors + channel_vector;
    sum = fma(
      glu_tile[shared_index],
      vec4<f32>(depthwise_weights[weight_index]),
      sum
    );
  }

  let affine =
    sum * batch_norm_scale[channel_vector]
    + batch_norm_shift[channel_vector];
  let activated = affine * sigmoid(affine);
  let output_row = group.z * params.frames + frame;
  output[output_row * params.channel_vectors + channel_vector] =
    vec4<f16>(activated);
}
`, Pd = Rd(di);
function $d(e = J) {
	return e.precision === "fp16" ? di : Pd;
}
function Rd(e) {
	return e.replace(`enable f16;
`, "").replaceAll("f16", "f32").replaceAll("0.0h", "0.0");
}
const sa = 256, Bd = [
	[5, Ie],
	[5, Ye],
	[6, Ye]
], Ad = [
	[5, xe],
	[5, Ze],
	[6, Ze]
];
function hi(e, t) {
	if (!Number.isSafeInteger(e) || e <= 0 || !Number.isSafeInteger(t) || t <= 0) throw new RangeError("Palette parameter pool geometry must be positive integers");
	const r = e * (Math.ceil(16 / t) * t);
	if (!Number.isSafeInteger(r)) throw new RangeError("Palette parameter pool is too large");
	return r;
}
var fi = class {
	device;
	slotCapacity;
	executionProfile;
	byteLength;
	slotStride;
	buffer;
	bindings = /* @__PURE__ */ new Map();
	destroyed = !1;
	constructor(e, t, r, a = J) {
		this.device = e, this.slotCapacity = t, this.executionProfile = a;
		const n = e.limits.minUniformBufferOffsetAlignment;
		this.byteLength = hi(t, n), this.slotStride = this.byteLength / this.slotCapacity, this.buffer = e.createBuffer({
			label: r,
			size: this.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});
	}
	get usedSlots() {
		return this.bindings.size;
	}
	bindingFor(e) {
		if (this.destroyed) throw new Error("Palette parameter pool was destroyed");
		mi(e, this.executionProfile);
		const t = Ld(e), r = this.bindings.get(t);
		if (r !== void 0) return r;
		if (this.bindings.size >= this.slotCapacity) throw new Error(`Palette parameter pool exceeds ${this.slotCapacity} slots`);
		const a = this.bindings.size * this.slotStride;
		this.device.queue.writeBuffer(this.buffer, a, Td(e));
		const n = {
			buffer: this.buffer,
			offset: a,
			size: 16
		};
		return this.bindings.set(t, n), n;
	}
	destroy() {
		this.destroyed || (this.destroyed = !0, this.bindings.clear(), this.buffer.destroy());
	}
}, pi = class _i {
	device;
	layout;
	pipelines;
	executionProfile;
	constructor(t, r, a, n) {
		this.device = t, this.layout = r, this.pipelines = a, this.executionProfile = n;
	}
	static async create(t, r = J) {
		if (r.precision === "fp16" && !t.features.has("shader-f16")) throw new Error("Palette expansion requires WebGPU shader-f16");
		if (t.limits.maxComputeInvocationsPerWorkgroup < sa) throw new Error(`Palette expansion requires ${sa} workgroup lanes`);
		const a = t.createBindGroupLayout({
			label: "parakeet-palette-expansion-bindings",
			entries: [
				Da(0, !0),
				Da(1, !0),
				Da(2, !1),
				{
					binding: 3,
					visibility: GPUShaderStage.COMPUTE,
					buffer: { type: "uniform" }
				}
			]
		}), n = t.createPipelineLayout({ bindGroupLayouts: [a] }), o = r.precision === "fp16" ? Bd : Ad, s = await Promise.all(o.map(async ([i, u]) => [No(i, u), await Md(t, n, i, u, r)]));
		return new _i(t, a, new Map(s), r);
	}
	createPooledDispatch(t, r) {
		mi(t, this.executionProfile);
		const a = r.offset ?? 0;
		if (r.size !== 16 || a % this.device.limits.minUniformBufferOffsetAlignment !== 0) throw new Error(`${t.label} has an invalid pooled parameter binding`);
		return this.createBoundDispatch(t, r);
	}
	createBoundDispatch(t, r) {
		const a = this.device.createBindGroup({
			label: `${t.label}-bindings`,
			layout: this.layout,
			entries: [
				{
					binding: 0,
					resource: t.source
				},
				{
					binding: 1,
					resource: t.palette
				},
				{
					binding: 2,
					resource: t.target
				},
				{
					binding: 3,
					resource: r
				}
			]
		}), n = t.paletteBits === 5 ? 32 : 16, o = Math.ceil(t.scalarCount / n / sa), s = this.pipelines.get(No(t.paletteBits, t.runtimeLayout));
		if (s === void 0) throw new Error(`${t.label} has unsupported expanded layout ` + t.runtimeLayout);
		let i = !1;
		return {
			label: t.label,
			encode(u) {
				if (i) throw new Error(`${t.label} palette dispatch was destroyed`);
				const l = u.beginComputePass({ label: t.label });
				l.setPipeline(s), l.setBindGroup(0, a), l.dispatchWorkgroups(o), l.end();
			},
			destroy() {
				i || (i = !0);
			}
		};
	}
};
function Td(e) {
	return new Uint32Array([
		e.scalarCount,
		e.columns,
		e.paletteGroupColumns,
		e.paletteGroups
	]);
}
function Ld(e) {
	return [
		e.paletteBits,
		e.runtimeLayout,
		e.scalarCount,
		e.columns,
		e.paletteGroupColumns,
		e.paletteGroups
	].join(":");
}
function mi(e, t) {
	const r = e.paletteBits === 5 ? 32 : 16, a = e.paletteBits === 5 ? 5 : 3, n = 1 << e.paletteBits, o = e.scalarCount / r * a * Uint32Array.BYTES_PER_ELEMENT, s = e.paletteGroups * n * xo(t), i = e.scalarCount * xo(t);
	if (!Number.isSafeInteger(e.scalarCount) || e.scalarCount <= 0 || e.scalarCount % r !== 0 || !Number.isSafeInteger(e.columns) || e.columns <= 0 || e.scalarCount % e.columns !== 0 || !Number.isSafeInteger(e.paletteGroupColumns) || e.paletteGroupColumns <= 0 || e.columns % e.paletteGroupColumns !== 0 || !Number.isSafeInteger(e.paletteGroups) || e.paletteGroups <= 0 || e.paletteGroupColumns * e.paletteGroups !== e.columns || e.source.size !== o || e.palette.size !== s || e.target.size !== i) throw new Error(`${e.label} has invalid transient palette geometry`);
	if (t.precision === "fp16" ? !xd(e.runtimeLayout) : !Od(e.runtimeLayout)) throw new Error(`${e.label} has a mismatched palette execution layout`);
	if (bi(e.runtimeLayout)) {
		const u = e.scalarCount / e.columns, l = ia(e.runtimeLayout);
		if (u % 32 !== 0 || e.columns % l !== 0) throw new Error(`${e.label} has invalid tile-major geometry`);
	}
}
async function Md(e, t, r, a, n) {
	const o = n.precision === "fp16" ? `parakeet-palette${r}-${a}-expansion` : `parakeet-palette${r}-${a}-fp32-expansion`, s = e.createShaderModule({
		label: o,
		code: n.precision === "fp16" ? Cd(r, a) : Id(r, a)
	}), i = (await s.getCompilationInfo()).messages.filter((u) => u.type === "error");
	if (i.length > 0) throw new Error(`${o} WGSL failed: ` + i.map((u) => `${u.lineNum}:${u.linePos} ${u.message}`).join("; "));
	return e.createComputePipelineAsync({
		label: o,
		layout: t,
		compute: {
			module: s,
			entryPoint: "main"
		}
	});
}
function xo(e) {
	return e.precision === "fp16" ? Uint16Array.BYTES_PER_ELEMENT : Float32Array.BYTES_PER_ELEMENT;
}
function Cd(e, t) {
	return gi(e, t, "f16");
}
function Id(e, t) {
	return gi(e, t, "f32");
}
function gi(e, t, r) {
	if (e === 6 && Oo(t)) throw new Error("The fixed runtime has no row-major palette6 matrix");
	const a = e === 5 ? 32 : 16, n = e === 5 ? 5 : 3, o = 1 << e, s = o - 1, i = Array.from({ length: n }, (c, d) => `  let word${d} = palette_indices[word_base + ${d}u];`).join(`
`), u = (c) => {
		const d = c * e, h = Math.floor(d / 32), f = d % 32;
		return f + e <= 32 ? `((word${h} >> ${f}u) & ${s}u)` : `(((word${h} >> ${f}u) | (word${h + 1} << ${32 - f}u)) & ${s}u)`;
	}, l = Array.from({ length: a / 4 }, (c, d) => {
		const h = Array.from({ length: 4 }, (p, _) => {
			const b = d * 4 + _;
			return `palette_value(palette_base + ${u(b)})`;
		}), f = d * 4;
		return `  dequantized[${Oo(t) ? `scalar_base / 4u + ${d}u` : `tile_major_vector(scalar_base + ${f}u)`}] = vec4<${r}>(${h.join(", ")});`;
	}).join(`
`);
	return `
${r === "f16" ? `enable f16;

` : ""}struct Params {
  scalar_count: u32,
  columns: u32,
  palette_group_columns: u32,
  palette_groups: u32,
};

@group(0) @binding(0) var<storage, read> palette_indices: array<u32>;
@group(0) @binding(1) var<storage, read> palette_values: array<vec4<${r}>>;
@group(0) @binding(2) var<storage, read_write> dequantized: array<vec4<${r}>>;
@group(0) @binding(3) var<uniform> params: Params;

fn palette_group(scalar_index: u32) -> u32 {
  let column = scalar_index % params.columns;
  return min(
    column / params.palette_group_columns,
    params.palette_groups - 1u
  );
}

fn palette_value(element: u32) -> ${r} {
  return palette_values[element / 4u][element & 3u];
}
${bi(t) ? `
fn tile_major_vector(scalar_index: u32) -> u32 {
  let inner = params.scalar_count / params.columns;
  let k = scalar_index / params.columns;
  let n = scalar_index % params.columns;
  let n_tile = n / ${ia(t)}u;
  let k_tile = k / 32u;
  let k_tiles = inner / 32u;
  let k_in_tile = k % 32u;
  let n_in_tile = n % ${ia(t)}u;
  return (
    ((n_tile * k_tiles + k_tile) * 32u + k_in_tile) *
      ${ia(t)}u + n_in_tile
  ) / 4u;
}
` : ""}

@compute @workgroup_size(${sa}, 1, 1)
fn main(@builtin(global_invocation_id) global: vec3<u32>) {
  let group = global.x;
  let scalar_base = group * ${a}u;
  if (scalar_base >= params.scalar_count) {
    return;
  }
  let word_base = group * ${n}u;
  let palette_base =
    palette_group(scalar_base) * ${o}u;
${i}
${l}
}
`;
}
function xd(e) {
	return e === "k-by-output-row-major-f16" || e === "n256-k32-tile-major-f16";
}
function Od(e) {
	return e === "k-by-output-row-major-f32" || e === "n128-k32-tile-major-f32";
}
function Oo(e) {
	return e === "k-by-output-row-major-f16" || e === "k-by-output-row-major-f32";
}
function bi(e) {
	return e === "n256-k32-tile-major-f16" || e === "n128-k32-tile-major-f32";
}
function ia(e) {
	if (e === "n128-k32-tile-major-f32") return 128;
	if (e === "n256-k32-tile-major-f16") return 256;
	throw new Error(`Runtime layout ${e} is not tile-major`);
}
function No(e, t) {
	return `${e}:${t}`;
}
function Da(e, t) {
	return {
		binding: e,
		visibility: GPUShaderStage.COMPUTE,
		buffer: { type: t ? "read-only-storage" : "storage" }
	};
}
const nr = 32, X = 4, wi = 256 / X, Qr = wi / nr, Yt = 256 / 8, Sr = 32 * Yt, yi = 8650752;
const Nd = Sr * 4 * Uint32Array.BYTES_PER_ELEMENT, Ei = Object.freeze({
	tileRows: 48,
	tileColumns: 128,
	tileInner: 128,
	workgroupSize: 128
}), Si = Object.freeze({
	tileRows: 48,
	tileColumns: 128,
	tileInner: 32,
	workgroupSize: 128
}), vi = Object.freeze({
	tileRows: 40,
	tileColumns: 128,
	tileInner: 128,
	workgroupSize: 128
}), ki = Object.freeze({
	tileRows: 36,
	tileColumns: 128,
	tileInner: 128,
	workgroupSize: 128
}), Pi = Object.freeze({
	tileRows: 32,
	tileColumns: 128,
	tileInner: 32,
	workgroupSize: 128
}), Fd = 12288, Ud = 20480, Gd = "bitcast-vec2-u32-to-vec4-f16", nn = "native-vec4-f16-storage", Wd = `
enable f16;

@group(0) @binding(0) var<storage, read_write>
  probe_output: array<vec4<f16>>;

@compute @workgroup_size(1, 1, 1)
fn main() {
  let packed = vec2<u32>(0u);
  probe_output[0] = bitcast<vec4<f16>>(packed);
}
`;
function qd(e) {
	return hi(11, e);
}
const $i = Bi(32, 128), Ri = Bi(48, 192);
function Bi(e, t) {
	const r = t / nr, a = e / r;
	if (!Number.isSafeInteger(r) || r <= 0 || !Number.isSafeInteger(a) || a !== 8) throw new Error(`Invalid scalar GEMM geometry M${e}/WG${t}`);
	return {
		tileRows: e,
		workgroupSize: t,
		subgroupCount: r,
		rowsPerSubgroup: a
	};
}
function Ai(e) {
	if (e === "n256-k32-tile-major-f16") return $i;
	if (e === "k-by-output-row-major-f16") return Ri;
	throw new Error(`Unsupported scalar GEMM weight layout ${e}`);
}
const Fo = [
	{
		label: "encoder-layer-ff-expand",
		rows: 7520,
		inner: 1024,
		columns: 4096,
		activation: "silu",
		hasBias: !1,
		residualScale: null,
		weightLayout: Ye
	},
	{
		label: "encoder-layer-ff-contract",
		rows: 7520,
		inner: 4096,
		columns: 1024,
		activation: "none",
		hasBias: !1,
		residualScale: .5,
		weightLayout: Ye
	},
	{
		label: "encoder-layer-attention-qkv",
		rows: 7520,
		inner: 1024,
		columns: 3072,
		activation: "none",
		hasBias: !1,
		residualScale: null,
		weightLayout: Ye
	},
	{
		label: "encoder-layer-residual-1024",
		rows: 7520,
		inner: 1024,
		columns: 1024,
		activation: "none",
		hasBias: !1,
		residualScale: 1,
		weightLayout: Ye
	},
	{
		label: "encoder-layer-adapter-down",
		rows: 7520,
		inner: 1024,
		columns: 256,
		activation: "silu",
		hasBias: !1,
		residualScale: null,
		weightLayout: Ye
	},
	{
		label: "encoder-layer-adapter-up",
		rows: 7520,
		inner: 256,
		columns: 1024,
		activation: "none",
		hasBias: !1,
		residualScale: null,
		weightLayout: Ie
	},
	{
		label: "encoder-layer-convolution-expand",
		rows: 7520,
		columns: 2048,
		activation: "none",
		hasBias: !1,
		residualScale: null,
		weightLayout: Ye,
		inner: 1024
	},
	{
		label: "encoder-projector",
		rows: 7520,
		inner: 1024,
		columns: 640,
		activation: "none",
		hasBias: !0,
		residualScale: null,
		weightLayout: Ie
	},
	{
		label: "subsampling-pointwise3",
		rows: 12032,
		inner: 256,
		columns: 256,
		activation: "relu",
		hasBias: !0,
		residualScale: null,
		weightLayout: Ie
	},
	{
		label: "subsampling-pointwise3-b2",
		rows: 24064,
		inner: 256,
		columns: 256,
		activation: "relu",
		hasBias: !0,
		residualScale: null,
		weightLayout: Ie
	},
	{
		label: "subsampling-pointwise3-b3",
		rows: 36096,
		inner: 256,
		columns: 256,
		activation: "relu",
		hasBias: !0,
		residualScale: null,
		weightLayout: Ie
	},
	{
		label: "subsampling-pointwise6",
		rows: 3008,
		inner: 256,
		columns: 256,
		activation: "relu",
		hasBias: !0,
		residualScale: null,
		weightLayout: Ie
	},
	{
		label: "subsampling-pointwise6-b2",
		rows: 6016,
		inner: 256,
		columns: 256,
		activation: "relu",
		hasBias: !0,
		residualScale: null,
		weightLayout: Ie
	},
	{
		label: "subsampling-pointwise6-b3",
		rows: 9024,
		inner: 256,
		columns: 256,
		activation: "relu",
		hasBias: !0,
		residualScale: null,
		weightLayout: Ie
	},
	{
		label: "subsampling-flatten-project",
		rows: 188,
		inner: 4096,
		columns: 1024,
		activation: "none",
		hasBias: !0,
		residualScale: null,
		weightLayout: Ie
	},
	{
		label: "subsampling-flatten-project-b2",
		rows: 376,
		inner: 4096,
		columns: 1024,
		activation: "none",
		hasBias: !0,
		residualScale: null,
		weightLayout: Ie
	},
	{
		label: "subsampling-flatten-project-b3",
		rows: 564,
		inner: 4096,
		columns: 1024,
		activation: "none",
		hasBias: !0,
		residualScale: null,
		weightLayout: Ie
	}
];
var Dd = class {
	label;
	output;
	pipeline;
	bindGroup;
	workgroups;
	rows;
	inner;
	columns;
	weightLayout;
	kernelBackend;
	preparation;
	destroyed = !1;
	constructor(e, t, r, a, n, o, s, i, u, l, c) {
		this.label = e, this.output = t, this.pipeline = r, this.bindGroup = a, this.workgroups = n, this.rows = o, this.inner = s, this.columns = i, this.weightLayout = u, this.kernelBackend = l, this.preparation = c;
	}
	encode(e, t, r) {
		if (this.destroyed) throw new Error(`${this.label} was destroyed`);
		this.preparation?.encode(e);
		let a = this.workgroups;
		if (r !== void 0) {
			const o = r.rows;
			if (!Number.isSafeInteger(o) || o <= 0 || o > this.rows) throw new RangeError(`${this.label} active rows must be in [1, ${this.rows}]`);
			a = this.kernelBackend === "subgroups" ? $n(o, this.inner, this.columns, this.weightLayout).workgroups : or(o, this.inner, this.columns, this.weightLayout).workgroups;
		}
		const n = e.beginComputePass(t === void 0 ? { label: this.label } : {
			label: this.label,
			timestampWrites: t
		});
		n.setBindGroup(0, this.bindGroup), Ti(a) && (n.setPipeline(this.pipeline), n.dispatchWorkgroups(...a)), n.end();
	}
	destroy() {
		this.destroyed || (this.destroyed = !0, this.preparation?.destroy());
	}
};
function Ti(e) {
	return e[0] > 0 && e[1] > 0 && e[2] > 0;
}
var za = class Li {
	device;
	arena;
	specializedPipelines;
	paletteExpander;
	paletteParameterPool;
	dequantizedWeightScratch;
	executionProfile;
	portableLoadEncoding;
	destroyed = !1;
	transientPaletteDispatchCountValue = 0;
	transientPaletteExpandedBytesValue = 0;
	constructor(t, r, a, n, o, s, i, u) {
		this.device = t, this.arena = r, this.specializedPipelines = a, this.paletteExpander = n, this.paletteParameterPool = o, this.dequantizedWeightScratch = s, this.executionProfile = i, this.portableLoadEncoding = u;
	}
	get transientPaletteParameterBytes() {
		return this.paletteParameterPool.byteLength;
	}
	get transientPaletteParameterUsedSlots() {
		return this.paletteParameterPool.usedSlots;
	}
	get transientPaletteDispatchCount() {
		return this.transientPaletteDispatchCountValue;
	}
	get transientPaletteExpandedBytes() {
		return this.transientPaletteExpandedBytesValue;
	}
	static async create(t, r, a = J, n) {
		if (a.precision !== "fp16") throw new Error("Parakeet FP16 GEMM requires an FP16 execution profile");
		if (!t.features.has("shader-f16")) throw new Error("Parakeet GEMM requires WebGPU shader-f16");
		if (a.kernelBackend === "subgroups" && !t.features.has("subgroups")) throw new Error("Parakeet GEMM requires WebGPU subgroups");
		if (a.kernelBackend === "subgroups" && n !== void 0) throw new Error("A diagnostic portable FP16 load encoding requires the portable backend");
		const o = a.kernelBackend === "subgroups" ? Math.max($i.workgroupSize, Ri.workgroupSize) : Math.max(Ei.workgroupSize, Si.workgroupSize);
		if (t.limits.maxComputeInvocationsPerWorkgroup < o || t.limits.maxComputeWorkgroupSizeX < o) throw new Error(`Parakeet GEMM requires ${o} workgroup lanes`);
		const s = a.kernelBackend === "subgroups" ? Nd : Fd;
		if (t.limits.maxComputeWorkgroupStorageSize < s) throw new Error(`Parakeet GEMM requires ${s} bytes of workgroup storage`);
		const i = a.kernelBackend === "portable" ? n ?? await Hd(t) : null, [u, l] = await Promise.all([zd(t, a.kernelBackend, i), pi.create(t, a)]), c = t.createBuffer({
			label: "parakeet-transient-palette-weight-scratch",
			size: yi,
			usage: GPUBufferUsage.STORAGE
		});
		try {
			const d = new fi(t, 11, "parakeet-transient-palette-parameter-pool", a);
			return new Li(t, r, u, l, d, c, a, i);
		} catch (d) {
			throw c.destroy(), d;
		}
	}
	createDispatch(t) {
		if (this.destroyed) throw new Error("Parakeet GEMM kernel was destroyed");
		Uo(t);
		const r = Go(this.specializedPipelines, t);
		Wo(t, r.specialization);
		const a = this.executionProfile.kernelBackend === "subgroups" ? $n(t.rows, t.inner, t.columns, r.specialization.weightLayout) : or(t.rows, t.inner, t.columns, r.specialization.weightLayout), n = t.bias?.binding ?? (t.residual === void 0 ? void 0 : this.arena.binding(t.residual)), o = Te(t.b.runtimeRecord.layout);
		let s;
		try {
			const i = t.preparedPaletteWeight, u = i === void 0 ? this.createInlinePaletteWeight(t, r.specialization, o) : this.requirePreparedPaletteWeight(t, r.specialization, i);
			s = u.preparation;
			const l = this.device.createBindGroup({
				label: `${t.label}-bindings`,
				layout: r.layout,
				entries: [
					{
						binding: 0,
						resource: this.arena.binding(t.a)
					},
					{
						binding: 1,
						resource: u.binding
					},
					{
						binding: 2,
						resource: this.arena.binding(t.output)
					},
					...n === void 0 ? [] : [{
						binding: 3,
						resource: n
					}]
				]
			});
			return new Dd(t.label, t.output, r.pipeline, l, a.workgroups, t.rows, t.inner, t.columns, r.specialization.weightLayout, this.executionProfile.kernelBackend, s);
		} catch (i) {
			throw s?.destroy(), i;
		}
	}
	createPreparedPaletteWeight(t, r) {
		if (this.destroyed) throw new Error("Parakeet GEMM kernel was destroyed");
		if (t.preparedPaletteWeight !== void 0) throw new Error(`${t.label} cannot prepare an already prepared weight`);
		Uo(t);
		const a = Go(this.specializedPipelines, t);
		Wo(t, a.specialization);
		const n = Te(t.b.runtimeRecord.layout);
		if (n === void 0) throw new Error(`${t.label} is not a palette-compressed weight`);
		const o = this.createPaletteWeight(t, a.specialization, n, r);
		return {
			source: t.b,
			palette: t.bPalette,
			paletteGroupColumns: t.paletteGroupColumns,
			inner: t.inner,
			columns: t.columns,
			runtimeLayout: a.specialization.weightLayout,
			binding: o.binding,
			preparation: o.preparation
		};
	}
	createInlinePaletteWeight(t, r, a) {
		return a === void 0 ? { binding: t.b.binding } : this.createPaletteWeight(t, r, a, 0);
	}
	createPaletteWeight(t, r, a, n) {
		const o = t.inner * t.columns * Uint16Array.BYTES_PER_ELEMENT;
		if (!Number.isSafeInteger(n) || n < 0 || n % this.device.limits.minStorageBufferOffsetAlignment !== 0 || n + o > 8650752) throw new RangeError(`${t.label} has an invalid transient palette scratch slice`);
		const s = {
			buffer: this.dequantizedWeightScratch,
			offset: n,
			size: o
		}, i = t.bPalette, u = {
			label: `${t.label}-palette-expand`,
			source: t.b.binding,
			palette: i.binding,
			target: s,
			scalarCount: t.inner * t.columns,
			columns: t.columns,
			paletteBits: a,
			paletteGroupColumns: t.paletteGroupColumns,
			paletteGroups: i.runtimeRecord.storageShape[0],
			runtimeLayout: r.weightLayout
		}, l = this.paletteExpander.createPooledDispatch(u, this.paletteParameterPool.bindingFor(u));
		return this.transientPaletteDispatchCountValue += 1, this.transientPaletteExpandedBytesValue += o, {
			binding: s,
			preparation: l
		};
	}
	requirePreparedPaletteWeight(t, r, a) {
		if (a.source !== t.b || a.palette !== t.bPalette || a.paletteGroupColumns !== t.paletteGroupColumns || a.inner !== t.inner || a.columns !== t.columns || a.runtimeLayout !== r.weightLayout) throw new Error(`${t.label} has a mismatched prepared palette weight`);
		return { binding: a.binding };
	}
	destroy() {
		this.destroyed || (this.destroyed = !0, this.paletteParameterPool.destroy(), this.dequantizedWeightScratch.destroy());
	}
};
function Pn(e, t, r) {
	if (e === "n256-k32-tile-major-f16") return Ei;
	if (e === "n128-k32-tile-major-f32") return t === 1024 && (r === 2048 || r === 3072) ? ki : vi;
	if (e === "k-by-output-row-major-f32") return Pi;
	if (e === "k-by-output-row-major-f16") return Si;
	throw new Error(`Unsupported portable GEMM weight layout ${e}`);
}
function or(e, t, r, a) {
	const n = Pn(a, t, r);
	if (!Number.isSafeInteger(e) || e <= 0 || !Number.isSafeInteger(t) || t <= 0 || t % n.tileInner !== 0 || !Number.isSafeInteger(r) || r <= 0 || r % X !== 0) throw new RangeError(`Portable GEMM requires K divisible by ${n.tileInner} and N divisible by 4`);
	return { workgroups: [
		Math.ceil(r / n.tileColumns),
		Math.ceil(e / n.tileRows),
		1
	] };
}
function $n(e, t, r, a) {
	if (!Number.isSafeInteger(e) || e <= 0 || !Number.isSafeInteger(t) || t <= 0 || t % 32 !== 0 || !Number.isSafeInteger(r) || r <= 0 || r % 8 !== 0) throw new RangeError("Subgroup GEMM requires K divisible by 32 and N divisible by 8");
	const n = Ai(a);
	return { workgroups: [
		Math.ceil(r / 256),
		Math.ceil(e / n.tileRows),
		1
	] };
}
function Uo(e) {
	if (!Number.isSafeInteger(e.rows) || e.rows <= 0 || !Number.isSafeInteger(e.inner) || e.inner <= 0 || e.inner % 32 !== 0 || !Number.isSafeInteger(e.columns) || e.columns <= 0 || e.columns % 8 !== 0) throw new RangeError(`Unsupported GEMM shape for ${e.label}`);
	const t = e.inner * e.columns, r = e.b.sourceRecord, a = Te(r.layout);
	if (r.logicalShape.join(",") !== `${e.inner},${e.columns}`) throw new Error(`${e.label} weight package does not match K=${e.inner}, N=${e.columns}`);
	if (a === void 0 || r.dtype !== "uint32") throw new Error(`${e.label} has an unsupported weight format`);
	const n = a === 5 ? 32 : 16, o = a === 5 ? 5 : 3;
	if (t % n !== 0) throw new Error(`${e.label} palette codes are not group aligned`);
	const s = t / n;
	if (r.byteLength !== s * o * 4 || r.storageShape.join(",") !== `${s},${o}`) throw new Error(`${e.label} has invalid packed palette indices`);
}
function Mi(e) {
	return [
		e.rows,
		e.inner,
		e.columns,
		e.activation,
		e.hasBias ? "bias" : "no-bias",
		e.residualScale === null ? "no-residual" : `residual-${e.residualScale}`
	].join(":");
}
function Go(e, t) {
	if (t.residual === void 0 && t.residualScale !== void 0) throw new Error(`${t.label} supplies a residual scale without a residual`);
	const r = {
		rows: t.rows,
		inner: t.inner,
		columns: t.columns,
		activation: t.activation ?? "none",
		hasBias: t.bias !== void 0,
		residualScale: t.residual === void 0 ? null : t.residualScale ?? 1
	}, a = e.get(Mi(r));
	if (a === void 0) throw new Error(`${t.label} is not a fixed production GEMM signature: M=${r.rows}, K=${r.inner}, N=${r.columns}, activation=${r.activation}, bias=${r.hasBias}, residualScale=${r.residualScale ?? "none"}`);
	return a;
}
function Wo(e, t) {
	const r = e.b.runtimeRecord, a = Te(r.layout);
	if (a !== void 0) {
		const o = e.b.sourceRecord, s = Te(o.layout), i = e.bPalette, u = e.paletteGroupColumns, l = a === void 0 ? 0 : 1 << a, c = i?.runtimeRecord.storageShape[0];
		if (s !== a || r.dtype !== "uint32" || r.layout !== o.layout || r.logicalShape.join(",") !== `${e.inner},${e.columns}` || r.storageShape.join(",") !== o.storageShape.join(",") || r.byteLength !== o.byteLength || i === void 0 || i.sourceRecord.dtype !== "float16" || i.sourceRecord.layout !== "output-group-by-palette-lut" || i.runtimeRecord.dtype !== "float16" || i.runtimeRecord.layout !== "output-group-by-palette-lut" || i.runtimeRecord.logicalShape.join(",") !== i.sourceRecord.logicalShape.join(",") || i.runtimeRecord.storageShape.join(",") !== `${c},${l}` || i.runtimeRecord.byteLength !== c * l * Uint16Array.BYTES_PER_ELEMENT || !Number.isSafeInteger(u) || u <= 0 || u * c !== e.columns) throw new Error(`${e.label} has invalid transient palette weights`);
		if (e.inner * e.columns * Uint16Array.BYTES_PER_ELEMENT > 8650752) throw new Error(`${e.label} exceeds transient palette scratch`);
		t.weightLayout === "n256-k32-tile-major-f16" && ql(e.inner, e.columns);
		return;
	}
	const n = [e.inner, e.columns];
	if (r.dtype !== "float16" || r.layout !== t.weightLayout || r.logicalShape.join(",") !== `${e.inner},${e.columns}` || r.storageShape.join(",") !== n.join(",") || r.byteLength !== e.inner * e.columns * Uint16Array.BYTES_PER_ELEMENT || e.bPalette !== void 0 || e.paletteGroupColumns !== void 0) throw new Error(`${e.label} has invalid ${t.weightLayout} weights`);
}
async function zd(e, t, r) {
	if (t === "portable" != (r !== null)) throw new Error("Portable FP16 GEMM load encoding does not match its kernel backend");
	const a = await Promise.all(Fo.map(async (o) => {
		const s = Kd(o), i = t === "portable" ? "-portable" : "", u = e.createBindGroupLayout({
			label: `parakeet-gemm-${o.label}${i}-bindings`,
			entries: [
				Je(0, !1, s?.a),
				Je(1, !0, s?.b),
				Je(2, !1, s?.c),
				...o.hasBias ? [Je(3, !0, s?.optional)] : o.residualScale === null ? [] : [Je(3, !1, s?.optional)]
			]
		}), l = e.createPipelineLayout({ bindGroupLayouts: [u] }), c = {
			specialization: o,
			pipeline: t === "subgroups" ? await jd(e, l, o) : await Vd(e, l, o, r),
			layout: u
		};
		return [Mi(o), c];
	})), n = new Map(a);
	if (n.size !== Fo.length) throw new Error("Duplicate fixed production GEMM specialization");
	return n;
}
async function jd(e, t, r) {
	const a = `parakeet-gemm-${r.label}`, n = e.createShaderModule({
		label: a,
		code: Yd(r)
	}), o = (await n.getCompilationInfo()).messages.filter((s) => s.type === "error");
	if (o.length > 0) throw new Error(`${a} WGSL failed: ` + o.map((s) => `${s.lineNum}:${s.linePos} ${s.message}`).join("; "));
	return e.createComputePipelineAsync({
		label: a,
		layout: t,
		compute: {
			module: n,
			entryPoint: "main"
		}
	});
}
async function Hd(e) {
	return (await e.createShaderModule({
		label: "parakeet-fp16-portable-bitcast-load-probe",
		code: Wd
	}).getCompilationInfo()).messages.some((t) => t.type === "error") ? nn : Gd;
}
async function Vd(e, t, r, a) {
	const n = `parakeet-gemm-${r.label}-portable`, o = e.createShaderModule({
		label: n,
		code: Xd(r, a)
	}), s = (await o.getCompilationInfo()).messages.filter((i) => i.type === "error");
	if (s.length > 0) throw new Error(`${n} WGSL failed: ` + s.map((i) => `${i.lineNum}:${i.linePos} ${i.message}`).join("; "));
	return e.createComputePipelineAsync({
		label: n,
		layout: t,
		compute: {
			module: o,
			entryPoint: "main"
		}
	});
}
function Kd(e) {
	if (e.weightLayout !== "n256-k32-tile-major-f16") return;
	const t = Uint16Array.BYTES_PER_ELEMENT, r = e.rows * e.inner * t, a = e.inner * e.columns * t, n = e.rows * e.columns * t;
	return {
		a: r,
		b: a,
		c: n,
		optional: e.hasBias ? e.columns * Float32Array.BYTES_PER_ELEMENT : e.residualScale === null ? void 0 : n
	};
}
function Yd(e) {
	if ($n(e.rows, e.inner, e.columns, e.weightLayout), e.hasBias && e.residualScale !== null) throw new Error(`${e.label} cannot fuse bias and residual together`);
	const t = e.weightLayout === Ye;
	if (t && e.inner !== 1024 && e.inner !== 4096) throw new Error(`${e.label} direct-B FP16 GEMM requires K1024 or K4096`);
	const r = t && e.inner === 4096, a = r ? X * 2 : X, n = e.inner / a, o = e.columns / 8, s = e.columns / X, i = e.columns % 256 !== 0, u = Ai(e.weightLayout);
	if (t && (e.inner % 32 !== 0 || e.columns % 256 !== 0)) throw new Error(`${e.label} cannot use direct K32/N256 tile-major weights`);
	const l = e.inner / 32, c = (q) => t ? `, ${q}` : "", d = c(e.rows * n), h = c(e.inner * o), f = c(e.rows * s), p = t ? `
  if (
    group.x >= ${e.columns / 256}u ||
    group.y >= ${e.rows / u.tileRows}u ||
    group.z != 0u ||
    subgroup >= ${u.subgroupCount}u
  ) {
    return;
  }` : "", _ = t ? `if (subgroup_lane < ${u.rowsPerSubgroup}u)` : `if (
        subgroup_lane < ${u.rowsPerSubgroup}u &&
        a_row < ROWS
      )`, b = Array.from({ length: u.rowsPerSubgroup }, (q, F) => Array.from({ length: Qr }, (we, Z) => `  var acc${F}_${Z} = vec4<f16>(0.0h);`).join(`
`)).join(`
`), w = Array.from({ length: u.rowsPerSubgroup }, (q, F) => `      let a${F} = bitcast<vec4<f16>>(
        subgroupBroadcast(packed_a, ${F}u)
      );`).join(`
`), g = (q) => {
		const F = Array.from({ length: u.rowsPerSubgroup }, (we, Z) => Array.from({ length: Qr }, (Ae, ne) => {
			const ye = t ? `a${Z}_${q}` : `a${Z}[${q}]`;
			return (t && ne === 0 ? `      let a${Z}_${q} = subgroupBroadcast(local_a[${q}], ${Z}u);
` : "") + `      acc${Z}_${ne} = fma(vec4<f16>(${ye}), b${ne}, acc${Z}_${ne});`;
		}).join(`
`)).join(`
`);
		return `
    {
      let packed_b = ${t ? `matrix_b[
        direct_b_tile_base +
          (k_vector * ${X}u + ${q}u)
            * ${Yt}u + subgroup_lane
      ]` : `tile_b[
        (k_vector * ${X}u + ${q}u)
          * ${Yt}u + subgroup_lane
      ]`};
      let b0 = bitcast<vec4<f16>>(packed_b.xy);
      let b1 = bitcast<vec4<f16>>(packed_b.zw);
${F}
    }`;
	}, y = t ? "" : w, B = Array.from({ length: X }, (q, F) => g(F)).join(`
`), P = r ? `
    {
      let k_vector = a_vector * 2u;
      let local_a = bitcast<vec4<f16>>(packed_a.xy);
${B}
    }
    {
      let k_vector = a_vector * 2u + 1u;
      let local_a = bitcast<vec4<f16>>(packed_a.zw);
${B}
    }` : "", x = Array.from({ length: u.rowsPerSubgroup }, (q, F) => Array.from({ length: Qr }, (we, Z) => t ? `
  {
    let row = row_base + ${F}u;
    let column_vector = column_vector_base + ${Z}u;
    let output_base = column_vector * ${X}u;
    var value = vec4<f32>(acc${F}_${Z});
${on(e)}
${xr(e.activation)}
    let output_index =
      row * COLUMN_VECTORS + column_vector;
${sn(e)}
    matrix_c[output_index] = vec4<f16>(value);
  }` : `
  {
    let row = row_base + ${F}u;
    let column_vector = column_vector_base + ${Z}u;
    if (${i ? "row < ROWS && column_vector < COLUMN_VECTORS" : "row < ROWS"}) {
      let output_base = column_vector * ${X}u;
      var value = vec4<f32>(acc${F}_${Z});
${on(e)}
${xr(e.activation)}
      let output_index =
        row * COLUMN_VECTORS + column_vector;
${sn(e)}
      matrix_c[output_index] = vec4<f16>(value);
    }
  }`).join(`
`)).join(`
`), A = e.hasBias ? `
@group(0) @binding(3) var<storage, read> bias: array<f32>;` : e.residualScale === null ? "" : `
@group(0) @binding(3) var<storage, read_write>
  residual: array<vec4<f16>${f}>;`, T = i ? `    if (b_pack < WEIGHT_PACKS_PER_ROW) {
      tile_b[item] = matrix_b[
        (k_base + b_k) * WEIGHT_PACKS_PER_ROW + b_pack
      ];
    } else {
      tile_b[item] = vec4<u32>(0u);
    }` : `    tile_b[item] = matrix_b[
      (k_base + b_k) * WEIGHT_PACKS_PER_ROW + b_pack
    ];`, L = t ? "" : `var<workgroup> tile_b:
  array<vec4<u32>, ${Sr}>;
`, ae = t ? "" : Zd(T, u.workgroupSize), H = t ? "" : `  @builtin(local_invocation_index) local_index: u32,
`, W = t ? `    let direct_b_tile_base =
      (group.x * ${l}u +
        k_base / 32u) *
      ${Sr}u;` : `    load_b_tile(k_base, local_index, group.x);
    workgroupBarrier();`, v = t ? "" : "    workgroupBarrier();", V = r ? `
    for (
      var a_vector = 0u;
      a_vector < ${32 / (X * 2)}u;
      a_vector += 1u
    ) {
      var packed_a = vec4<u32>(0u);
      let a_row = row_base + subgroup_lane;
      ${_} {
        packed_a = matrix_a[
          a_row * A_VECTORS_PER_ROW
            + k_base / ${X * 2}u
            + a_vector
        ];
      }
${P}
    }` : `
    for (
      var k_vector = 0u;
      k_vector < ${32 / X}u;
      k_vector += 1u
    ) {
      var packed_a = vec2<u32>(0u);
      let a_row = row_base + subgroup_lane;
      ${_} {
        packed_a = matrix_a[
          a_row * A_VECTORS_PER_ROW
            + k_base / ${X}u
            + k_vector
        ];
      }
${y}
${B}
    }`, de = t && e.inner === 1024 ? `
  let direct_b_tile_base =
    group.x * ${l * Sr}u;
  for (
    var k_vector = 0u;
    k_vector < A_VECTORS_PER_ROW;
    k_vector += 1u
  ) {
    var packed_a = vec2<u32>(0u);
    let a_row = row_base + subgroup_lane;
    ${_} {
      packed_a = matrix_a[
        a_row * A_VECTORS_PER_ROW + k_vector
      ];
    }
    let local_a = bitcast<vec4<f16>>(packed_a);
${B}
  }` : `
  for (
    var k_base = 0u;
    k_base < INNER;
    k_base += 32u
  ) {
${W}
${V}
${v}
  }`, _e = r ? "vec4<u32>" : "vec2<u32>";
	return `
enable f16;
enable subgroups;

const ROWS = ${e.rows}u;
const INNER = ${e.inner}u;
const A_VECTORS_PER_ROW = ${n}u;
const WEIGHT_PACKS_PER_ROW = ${o}u;
const COLUMN_VECTORS = ${s}u;

@group(0) @binding(0) var<storage, read_write>
  matrix_a: array<${_e}${d}>;
@group(0) @binding(1) var<storage, read>
  matrix_b: array<vec4<u32>${h}>;
@group(0) @binding(2) var<storage, read_write>
  matrix_c: array<vec4<f16>${f}>;
${A}

${L}

${ae}

@compute @workgroup_size(${u.workgroupSize}, 1, 1)
fn main(
${H}  @builtin(subgroup_invocation_id) subgroup_lane: u32,
  @builtin(subgroup_id) subgroup: u32,
  @builtin(subgroup_size) subgroup_size: u32,
  @builtin(workgroup_id) group: vec3<u32>,
) {
  if (subgroup_size != ${nr}u) {
    return;
  }${p}
  let row_base =
    group.y * ${u.tileRows}u
      + subgroup * ${u.rowsPerSubgroup}u;
  let column_vector_base =
    group.x * ${wi}u
      + subgroup_lane * ${Qr}u;
${b}
${de}

${x}
}
`;
}
function Zd(e, t) {
	return `fn load_b_tile(
  k_base: u32,
  local_index: u32,
  group_x: u32,
) {
  for (
    var item = local_index;
    item < ${Sr}u;
    item += ${t}u
  ) {
    let b_k = item / ${Yt}u;
    let b_pack =
      group_x * ${Yt}u
        + item % ${Yt}u;
${e}
  }
}`;
}
function Xd(e, t = nn) {
	if (or(e.rows, e.inner, e.columns, e.weightLayout), e.hasBias && e.residualScale !== null) throw new Error(`${e.label} cannot fuse bias and residual together`);
	const r = e.weightLayout === Ye, a = t === nn, n = a ? "vec4<f16>" : "vec2<u32>", o = a ? "vec4<f16>(0.0h)" : "vec2<u32>(0u)", s = (W) => a ? W : `unpack_f16x4(${W})`, i = Pn(e.weightLayout, e.inner, e.columns), u = i.tileColumns / X, l = i.workgroupSize / u, c = i.tileRows / l, d = i.tileInner / X, h = i.tileRows * d, f = i.tileInner * u, p = e.inner / X, _ = e.columns / X, b = e.inner / 32, w = 256 / X, g = 256 / i.tileColumns, y = Array.from({ length: c }, (W, v) => `  var acc${v} = vec4<f16>(0.0h);`).join(`
`), B = Array.from({ length: c }, (W, v) => {
		const V = `tile_a[(local_row_base + ${v}u) * ${d}u + k_vector]`;
		return `    let a${v} = ${s(V)};`;
	}).join(`
`), P = Array.from({ length: X }, (W, v) => {
		const V = r ? `matrix_b[
        direct_b_tile_base +
          (k_vector * ${X}u + ${v}u) *
            ${w}u +
          direct_b_slice * ${u}u +
          local_column_vector
      ]` : `tile_b[
        (k_vector * ${X}u + ${v}u) *
          ${u}u +
          local_column_vector
      ]`, de = Array.from({ length: c }, (_e, q) => `      acc${q} = fma(vec4<f16>(f16(a${q}[${v}])), b, acc${q});`).join(`
`);
		return `
    {
      let b = ${s(V)};
${de}
    }`;
	}).join(`
`), x = Array.from({ length: c }, (W, v) => `
  {
    let row = row_base + local_row_base + ${v}u;
    if (row < ROWS && column_vector < COLUMN_VECTORS) {
      let output_base = column_vector * ${X}u;
      var value = vec4<f32>(acc${v});
${on(e)}
${xr(e.activation)}
      let output_index = row * COLUMN_VECTORS + column_vector;
${sn(e)}
      matrix_c[output_index] = vec4<f16>(value);
    }
  }`).join(`
`), A = e.hasBias ? `
@group(0) @binding(3) var<storage, read> bias: array<f32>;` : e.residualScale === null ? "" : `
@group(0) @binding(3) var<storage, read_write>
  residual: array<vec4<f16>>;`, T = r ? "" : `var<workgroup> tile_b:
  array<${n}, ${f}>;`, L = r ? "" : `
    for (
      var item = lane;
      item < ${f}u;
      item += ${i.workgroupSize}u
    ) {
      let k_scalar = item / ${u}u;
      let local_column = item % ${u}u;
      let source_column =
        group.x * ${u}u + local_column;
      if (source_column < COLUMN_VECTORS) {
        tile_b[item] = matrix_b[
          (k_base + k_scalar) * COLUMN_VECTORS + source_column
        ];
      } else {
        tile_b[item] = ${o};
      }
    }`, ae = r ? `
    let direct_b_tile =
      group.x / ${g}u;
    let direct_b_slice =
      group.x % ${g}u;
    let direct_b_tile_base =
      (direct_b_tile * ${b}u +
        k_base / 32u) *
        ${32 * w}u +
      (k_base % 32u) *
        ${w}u;` : "", H = a ? "" : t === "bitcast-vec2-u32-to-vec4-f16" ? `fn unpack_f16x4(
  packed: vec2<u32>,
) -> vec4<f16> {
  return bitcast<vec4<f16>>(packed);
}` : `fn unpack_f16x4(
  packed: vec2<u32>,
) -> vec4<f16> {
  let xy = unpack2x16float(packed.x);
  let zw = unpack2x16float(packed.y);
  return vec4<f16>(
    f16(xy.x),
    f16(xy.y),
    f16(zw.x),
    f16(zw.y)
  );
}`;
	return `
enable f16;

const ROWS = ${e.rows}u;
const INNER = ${e.inner}u;
const A_VECTORS_PER_ROW = ${p}u;
const COLUMN_VECTORS = ${_}u;

@group(0) @binding(0) var<storage, read_write>
  matrix_a: array<${n}>;
@group(0) @binding(1) var<storage, read>
  matrix_b: array<${n}>;
@group(0) @binding(2) var<storage, read_write>
  matrix_c: array<vec4<f16>>;
${A}

var<workgroup> tile_a:
  array<${n}, ${h}>;
${T}

${H}

@compute @workgroup_size(${i.workgroupSize}, 1, 1)
fn main(
  @builtin(local_invocation_index) lane: u32,
  @builtin(workgroup_id) group: vec3<u32>,
) {
  let local_column_vector =
    lane % ${u}u;
  let local_row_group =
    lane / ${u}u;
  let local_row_base =
    local_row_group * ${c}u;
  let row_base = group.y * ${i.tileRows}u;
  let column_vector =
    group.x * ${u}u +
      local_column_vector;
${y}

  for (
    var k_base = 0u;
    k_base < INNER;
    k_base += ${i.tileInner}u
  ) {
    for (
      var item = lane;
      item < ${h}u;
      item += ${i.workgroupSize}u
    ) {
      let tile_row = item / ${d}u;
      let k_vector = item % ${d}u;
      let source_row = row_base + tile_row;
      if (source_row < ROWS) {
        tile_a[item] = matrix_a[
          source_row * A_VECTORS_PER_ROW +
            k_base / ${X}u + k_vector
        ];
      } else {
        tile_a[item] = ${o};
      }
    }
${L}
${ae}
    workgroupBarrier();

    for (
      var k_vector = 0u;
      k_vector < ${d}u;
      k_vector += 1u
    ) {
${B}
${P}
    }
    if (k_base + ${i.tileInner}u < INNER) {
      workgroupBarrier();
    }
  }
${x}
}
`;
}
function on(e) {
	return e.hasBias ? `      value += vec4<f32>(
        bias[output_base + 0u],
        bias[output_base + 1u],
        bias[output_base + 2u],
        bias[output_base + 3u]
      );` : "";
}
function xr(e) {
	switch (e) {
		case "none": return "";
		case "silu": return `      let bounded = clamp(
        value,
        vec4<f32>(-20.0),
        vec4<f32>(20.0)
      );
      value = value / (vec4<f32>(1.0) + exp(-bounded));`;
		case "relu": return "      value = max(value, vec4<f32>(0.0));";
	}
}
function sn(e) {
	const t = e.residualScale;
	return t === null ? "" : `      value = vec4<f32>(residual[output_index])
        + ${t === 1 ? "1.0" : String(t)} * value;`;
}
function Je(e, t, r) {
	return {
		binding: e,
		visibility: GPUShaderStage.COMPUTE,
		buffer: {
			type: t ? "read-only-storage" : "storage",
			...r === void 0 ? {} : { minBindingSize: r }
		}
	};
}
const Ci = 17301504, Q = 4, Ii = 128 / Q, Qd = Ii / nr, Zt = 128 / Q, vr = 32 * Zt, Jd = vr * Q * Float32Array.BYTES_PER_ELEMENT, xi = Ni(32, 128), Oi = Ni(48, 192);
function Ni(e, t) {
	const r = t / nr, a = e / r;
	if (!Number.isSafeInteger(r) || r <= 0 || !Number.isSafeInteger(a) || a !== 8) throw new Error(`Invalid FP32 scalar GEMM geometry M${e}/WG${t}`);
	return {
		tileRows: e,
		workgroupSize: t,
		subgroupCount: r,
		rowsPerSubgroup: a
	};
}
function Fi(e) {
	if (e === "n128-k32-tile-major-f32") return xi;
	if (e === "k-by-output-row-major-f32") return Oi;
	throw new Error(`Unsupported FP32 scalar GEMM weight layout ${e}`);
}
const qo = [
	{
		label: "encoder-layer-ff-expand",
		rows: 7520,
		inner: 1024,
		columns: 4096,
		activation: "silu",
		hasBias: !1,
		residualScale: null,
		weightLayout: Ze
	},
	{
		label: "encoder-layer-ff-contract",
		rows: 7520,
		inner: 4096,
		columns: 1024,
		activation: "none",
		hasBias: !1,
		residualScale: .5,
		weightLayout: Ze
	},
	{
		label: "encoder-layer-attention-qkv",
		rows: 7520,
		inner: 1024,
		columns: 3072,
		activation: "none",
		hasBias: !1,
		residualScale: null,
		weightLayout: Ze
	},
	{
		label: "encoder-layer-residual-1024",
		rows: 7520,
		inner: 1024,
		columns: 1024,
		activation: "none",
		hasBias: !1,
		residualScale: 1,
		weightLayout: Ze
	},
	{
		label: "encoder-layer-adapter-down",
		rows: 7520,
		inner: 1024,
		columns: 256,
		activation: "silu",
		hasBias: !1,
		residualScale: null,
		weightLayout: Ze
	},
	{
		label: "encoder-layer-adapter-up",
		rows: 7520,
		inner: 256,
		columns: 1024,
		activation: "none",
		hasBias: !1,
		residualScale: null,
		weightLayout: xe
	},
	{
		label: "encoder-layer-convolution-expand",
		rows: 7520,
		inner: 1024,
		columns: 2048,
		activation: "none",
		hasBias: !1,
		residualScale: null,
		weightLayout: Ze
	},
	{
		label: "encoder-projector",
		rows: 7520,
		inner: 1024,
		columns: 640,
		activation: "none",
		hasBias: !0,
		residualScale: null,
		weightLayout: xe
	},
	{
		label: "subsampling-pointwise3",
		rows: 12032,
		inner: 256,
		columns: 256,
		activation: "relu",
		hasBias: !0,
		residualScale: null,
		weightLayout: xe
	},
	{
		label: "subsampling-pointwise3-b2",
		rows: 24064,
		inner: 256,
		columns: 256,
		activation: "relu",
		hasBias: !0,
		residualScale: null,
		weightLayout: xe
	},
	{
		label: "subsampling-pointwise3-b3",
		rows: 36096,
		inner: 256,
		columns: 256,
		activation: "relu",
		hasBias: !0,
		residualScale: null,
		weightLayout: xe
	},
	{
		label: "subsampling-pointwise6",
		rows: 3008,
		inner: 256,
		columns: 256,
		activation: "relu",
		hasBias: !0,
		residualScale: null,
		weightLayout: xe
	},
	{
		label: "subsampling-pointwise6-b2",
		rows: 6016,
		inner: 256,
		columns: 256,
		activation: "relu",
		hasBias: !0,
		residualScale: null,
		weightLayout: xe
	},
	{
		label: "subsampling-pointwise6-b3",
		rows: 9024,
		inner: 256,
		columns: 256,
		activation: "relu",
		hasBias: !0,
		residualScale: null,
		weightLayout: xe
	},
	{
		label: "subsampling-flatten-project",
		rows: 188,
		inner: 4096,
		columns: 1024,
		activation: "none",
		hasBias: !0,
		residualScale: null,
		weightLayout: xe
	},
	{
		label: "subsampling-flatten-project-b2",
		rows: 376,
		inner: 4096,
		columns: 1024,
		activation: "none",
		hasBias: !0,
		residualScale: null,
		weightLayout: xe
	},
	{
		label: "subsampling-flatten-project-b3",
		rows: 564,
		inner: 4096,
		columns: 1024,
		activation: "none",
		hasBias: !0,
		residualScale: null,
		weightLayout: xe
	}
];
function Rn(e, t, r, a) {
	if (!Number.isSafeInteger(e) || e <= 0 || !Number.isSafeInteger(t) || t <= 0 || t % 32 !== 0 || !Number.isSafeInteger(r) || r <= 0 || r % Q !== 0) throw new RangeError("FP32 subgroup GEMM requires K divisible by 32 and N divisible by 4");
	const n = Fi(a);
	return { workgroups: [
		Math.ceil(r / 128),
		Math.ceil(e / n.tileRows),
		1
	] };
}
function eh(e) {
	if (Rn(e.rows, e.inner, e.columns, e.weightLayout), e.hasBias && e.residualScale !== null) throw new Error(`${e.label} cannot fuse bias and residual together`);
	const t = e.inner / Q, r = e.columns / Q, a = e.columns / Q, n = e.columns % 128 !== 0, o = e.weightLayout === Ze, s = Fi(e.weightLayout);
	if (o && (e.inner % 32 !== 0 || e.columns % 128 !== 0)) throw new Error(`${e.label} cannot use direct K32/N128 tile-major weights`);
	const i = e.inner / 32, u = Array.from({ length: s.rowsPerSubgroup }, (B, P) => `  var acc${P} = vec4<f32>(0.0);`).join(`
`), l = Array.from({ length: s.rowsPerSubgroup }, (B, P) => `      let a${P} = subgroupBroadcast(packed_a, ${P}u);`).join(`
`), c = Array.from({ length: Q }, (B, P) => {
		const x = Array.from({ length: s.rowsPerSubgroup }, (A, T) => o ? `      let a${T}_${P} = subgroupBroadcast(packed_a[${P}], ${T}u);
      acc${T} = fma(vec4<f32>(a${T}_${P}), b, acc${T});` : `      acc${T} = fma(vec4<f32>(a${T}[${P}]), b, acc${T});`).join(`
`);
		return `
    {
      let b = ${o ? `matrix_b[
        direct_b_tile_base +
          (k_vector * ${Q}u + ${P}u)
            * ${Zt}u + subgroup_lane
      ]` : `tile_b[
        (k_vector * ${Q}u + ${P}u)
          * ${Zt}u + subgroup_lane
      ]`};
${x}
    }`;
	}).join(`
`), d = Array.from({ length: s.rowsPerSubgroup }, (B, P) => `
  {
    let row = row_base + ${P}u;
    let column_vector = column_vector_base;
    if (${n ? "row < ROWS && column_vector < COLUMN_VECTORS" : "row < ROWS"}) {
      let output_base = column_vector * ${Q}u;
      var value = acc${P};
${Ui(e)}
${xr(e.activation)}
      let output_index =
        row * COLUMN_VECTORS + column_vector;
${Gi(e)}
      matrix_c[output_index] = value;
    }
  }`).join(`
`), h = e.hasBias ? `
@group(0) @binding(3) var<storage, read> bias: array<f32>;` : e.residualScale === null ? "" : `
@group(0) @binding(3) var<storage, read_write>
  residual: array<vec4<f32>>;`, f = n ? `    if (b_vector < WEIGHT_VECTORS_PER_ROW) {
      tile_b[item] = matrix_b[
        (k_base + b_k) * WEIGHT_VECTORS_PER_ROW + b_vector
      ];
    } else {
      tile_b[item] = vec4<f32>(0.0);
    }` : `    tile_b[item] = matrix_b[
      (k_base + b_k) * WEIGHT_VECTORS_PER_ROW + b_vector
    ];`, p = o ? "" : `var<workgroup> tile_b:
  array<vec4<f32>, ${vr}>;
`, _ = o ? "" : th(f, s.workgroupSize), b = o ? "" : `  @builtin(local_invocation_index) local_index: u32,
`, w = o ? `    let direct_b_tile_base =
      (group.x * ${i}u +
        k_base / 32u) *
      ${vr}u;` : `    load_b_tile(k_base, local_index, group.x);
    workgroupBarrier();`, g = o ? "" : "    workgroupBarrier();", y = o && e.inner === 1024 ? `
  let direct_b_tile_base =
    group.x * ${i * vr}u;
  for (
    var k_vector = 0u;
    k_vector < A_VECTORS_PER_ROW;
    k_vector += 1u
  ) {
    var packed_a = vec4<f32>(0.0);
    let a_row = row_base + subgroup_lane;
    if (
      subgroup_lane < ${s.rowsPerSubgroup}u &&
      a_row < ROWS
    ) {
      packed_a = matrix_a[
        a_row * A_VECTORS_PER_ROW + k_vector
      ];
    }
${c}
  }` : `
  for (
    var k_base = 0u;
    k_base < INNER;
    k_base += 32u
  ) {
${w}

    for (
      var k_vector = 0u;
      k_vector < ${32 / Q}u;
      k_vector += 1u
    ) {
      var packed_a = vec4<f32>(0.0);
      let a_row = row_base + subgroup_lane;
      if (
        subgroup_lane < ${s.rowsPerSubgroup}u &&
        a_row < ROWS
      ) {
        packed_a = matrix_a[
          a_row * A_VECTORS_PER_ROW
            + k_base / ${Q}u
            + k_vector
        ];
      }
${o ? "" : l}
${c}
    }
${g}
  }`;
	return `
enable subgroups;

const ROWS = ${e.rows}u;
const INNER = ${e.inner}u;
const A_VECTORS_PER_ROW = ${t}u;
const WEIGHT_VECTORS_PER_ROW = ${r}u;
const COLUMN_VECTORS = ${a}u;

@group(0) @binding(0) var<storage, read_write>
  matrix_a: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read>
  matrix_b: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write>
  matrix_c: array<vec4<f32>>;
${h}

${p}

${_}

@compute @workgroup_size(${s.workgroupSize}, 1, 1)
fn main(
${b}  @builtin(subgroup_invocation_id) subgroup_lane: u32,
  @builtin(subgroup_id) subgroup: u32,
  @builtin(subgroup_size) subgroup_size: u32,
  @builtin(workgroup_id) group: vec3<u32>,
) {
  if (subgroup_size != ${nr}u) {
    return;
  }
  let row_base =
    group.y * ${s.tileRows}u
      + subgroup * ${s.rowsPerSubgroup}u;
  let column_vector_base =
    group.x * ${Ii}u
      + subgroup_lane * ${Qd}u;
${u}

${y}

${d}
}
`;
}
function th(e, t) {
	return `fn load_b_tile(
  k_base: u32,
  local_index: u32,
  group_x: u32,
) {
  for (
    var item = local_index;
    item < ${vr}u;
    item += ${t}u
  ) {
    let b_k = item / ${Zt}u;
    let b_vector =
      group_x * ${Zt}u
        + item % ${Zt}u;
${e}
  }
}`;
}
function rh(e) {
	if (or(e.rows, e.inner, e.columns, e.weightLayout), e.hasBias && e.residualScale !== null) throw new Error(`${e.label} cannot fuse bias and residual together`);
	const t = e.weightLayout === Ze, r = Pn(e.weightLayout, e.inner, e.columns), a = r.tileColumns / Q, n = r.workgroupSize / a, o = r.tileRows / n, s = r.tileInner / Q, i = r.tileRows * s, u = r.tileInner * a, l = e.inner / Q, c = e.columns / Q, d = e.inner / 32, h = 128 / Q, f = 128 / r.tileColumns, p = Array.from({ length: o }, (x, A) => `  var acc${A} = vec4<f32>(0.0);`).join(`
`), _ = Array.from({ length: o }, (x, A) => `    let a${A} = tile_a[(local_row_base + ${A}u) * ${s}u + k_vector];`).join(`
`), b = Array.from({ length: Q }, (x, A) => `
    {
      let b = ${t ? `matrix_b[
        direct_b_tile_base +
          (k_vector * ${Q}u + ${A}u) *
            ${h}u +
          direct_b_slice * ${a}u +
          local_column_vector
      ]` : `tile_b[
        (k_vector * ${Q}u + ${A}u) *
          ${a}u +
          local_column_vector
      ]`};
${Array.from({ length: o }, (T, L) => `      acc${L} = fma(vec4<f32>(a${L}[${A}]), b, acc${L});`).join(`
`)}
    }`).join(`
`), w = Array.from({ length: o }, (x, A) => `
  {
    let row = row_base + local_row_base + ${A}u;
    if (row < ROWS && column_vector < COLUMN_VECTORS) {
      let output_base = column_vector * ${Q}u;
      var value = acc${A};
${Ui(e)}
${xr(e.activation)}
      let output_index = row * COLUMN_VECTORS + column_vector;
${Gi(e)}
      matrix_c[output_index] = value;
    }
  }`).join(`
`), g = e.hasBias ? `
@group(0) @binding(3) var<storage, read> bias: array<f32>;` : e.residualScale === null ? "" : `
@group(0) @binding(3) var<storage, read_write>
  residual: array<vec4<f32>>;`, y = t ? "" : `var<workgroup> tile_b:
  array<vec4<f32>, ${u}>;`, B = t ? "" : `
    for (
      var item = lane;
      item < ${u}u;
      item += ${r.workgroupSize}u
    ) {
      let k_scalar = item / ${a}u;
      let local_column = item % ${a}u;
      let source_column =
        group.x * ${a}u + local_column;
      if (source_column < COLUMN_VECTORS) {
        tile_b[item] = matrix_b[
          (k_base + k_scalar) * COLUMN_VECTORS + source_column
        ];
      } else {
        tile_b[item] = vec4<f32>(0.0);
      }
    }`, P = t ? `
    let direct_b_tile =
      group.x / ${f}u;
    let direct_b_slice =
      group.x % ${f}u;
    let direct_b_tile_base =
      (direct_b_tile * ${d}u +
        k_base / 32u) *
        ${32 * h}u +
      (k_base % 32u) *
        ${h}u;` : "";
	return `
const ROWS = ${e.rows}u;
const INNER = ${e.inner}u;
const A_VECTORS_PER_ROW = ${l}u;
const COLUMN_VECTORS = ${c}u;

@group(0) @binding(0) var<storage, read_write>
  matrix_a: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read>
  matrix_b: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write>
  matrix_c: array<vec4<f32>>;
${g}

var<workgroup> tile_a:
  array<vec4<f32>, ${i}>;
${y}

@compute @workgroup_size(${r.workgroupSize}, 1, 1)
fn main(
  @builtin(local_invocation_index) lane: u32,
  @builtin(workgroup_id) group: vec3<u32>,
) {
  let local_column_vector =
    lane % ${a}u;
  let local_row_group =
    lane / ${a}u;
  let local_row_base =
    local_row_group * ${o}u;
  let row_base = group.y * ${r.tileRows}u;
  let column_vector =
    group.x * ${a}u +
      local_column_vector;
${p}

  for (
    var k_base = 0u;
    k_base < INNER;
    k_base += ${r.tileInner}u
  ) {
    for (
      var item = lane;
      item < ${i}u;
      item += ${r.workgroupSize}u
    ) {
      let tile_row = item / ${s}u;
      let k_vector = item % ${s}u;
      let source_row = row_base + tile_row;
      if (source_row < ROWS) {
        tile_a[item] = matrix_a[
          source_row * A_VECTORS_PER_ROW +
            k_base / ${Q}u + k_vector
        ];
      } else {
        tile_a[item] = vec4<f32>(0.0);
      }
    }
${B}
${P}
    workgroupBarrier();

    for (
      var k_vector = 0u;
      k_vector < ${s}u;
      k_vector += 1u
    ) {
${_}
${b}
    }
    if (k_base + ${r.tileInner}u < INNER) {
      workgroupBarrier();
    }
  }
${w}
}
`;
}
function Ui(e) {
	return e.hasBias ? `      value += vec4<f32>(
        bias[output_base + 0u],
        bias[output_base + 1u],
        bias[output_base + 2u],
        bias[output_base + 3u]
      );` : "";
}
function Gi(e) {
	const t = e.residualScale;
	return t === null ? "" : `      value = residual[output_index]
        + ${t === 1 ? "1.0" : String(t)} * value;`;
}
var ah = class {
	label;
	output;
	pipeline;
	bindGroup;
	workgroups;
	rows;
	inner;
	columns;
	weightLayout;
	kernelBackend;
	preparation;
	destroyed = !1;
	constructor(e, t, r, a, n, o, s, i, u, l, c) {
		this.label = e, this.output = t, this.pipeline = r, this.bindGroup = a, this.workgroups = n, this.rows = o, this.inner = s, this.columns = i, this.weightLayout = u, this.kernelBackend = l, this.preparation = c;
	}
	encode(e, t, r) {
		if (this.destroyed) throw new Error(`${this.label} was destroyed`);
		this.preparation?.encode(e);
		let a = this.workgroups;
		if (r !== void 0) {
			const o = r.rows;
			if (!Number.isSafeInteger(o) || o <= 0 || o > this.rows) throw new RangeError(`${this.label} active rows must be in [1, ${this.rows}]`);
			a = this.kernelBackend === "subgroups" ? Rn(o, this.inner, this.columns, this.weightLayout).workgroups : or(o, this.inner, this.columns, this.weightLayout).workgroups;
		}
		const n = e.beginComputePass(t === void 0 ? { label: this.label } : {
			label: this.label,
			timestampWrites: t
		});
		n.setBindGroup(0, this.bindGroup), Ti(a) && (n.setPipeline(this.pipeline), n.dispatchWorkgroups(...a)), n.end();
	}
	destroy() {
		this.destroyed || (this.destroyed = !0, this.preparation?.destroy());
	}
}, Do = class Wi {
	device;
	arena;
	specializedPipelines;
	paletteExpander;
	paletteParameterPool;
	dequantizedWeightScratch;
	executionProfile;
	destroyed = !1;
	transientPaletteDispatchCountValue = 0;
	transientPaletteExpandedBytesValue = 0;
	constructor(t, r, a, n, o, s, i) {
		this.device = t, this.arena = r, this.specializedPipelines = a, this.paletteExpander = n, this.paletteParameterPool = o, this.dequantizedWeightScratch = s, this.executionProfile = i;
	}
	get transientPaletteParameterBytes() {
		return this.paletteParameterPool.byteLength;
	}
	get transientPaletteParameterUsedSlots() {
		return this.paletteParameterPool.usedSlots;
	}
	get transientPaletteDispatchCount() {
		return this.transientPaletteDispatchCountValue;
	}
	get transientPaletteExpandedBytes() {
		return this.transientPaletteExpandedBytesValue;
	}
	static async create(t, r, a = ei) {
		if (a.precision !== "fp32") throw new Error("Parakeet FP32 GEMM requires an FP32 execution profile");
		if (a.kernelBackend === "subgroups" && !t.features.has("subgroups")) throw new Error("Parakeet FP32 GEMM requires WebGPU subgroups");
		const n = a.kernelBackend === "subgroups" ? Math.max(xi.workgroupSize, Oi.workgroupSize) : Math.max(vi.workgroupSize, ki.workgroupSize, Pi.workgroupSize);
		if (t.limits.maxComputeInvocationsPerWorkgroup < n || t.limits.maxComputeWorkgroupSizeX < n) throw new Error(`Parakeet FP32 GEMM requires ${n} workgroup lanes`);
		const o = a.kernelBackend === "subgroups" ? Jd : Ud;
		if (t.limits.maxComputeWorkgroupStorageSize < o) throw new Error(`Parakeet FP32 GEMM requires ${o} bytes of workgroup storage`);
		const [s, i] = await Promise.all([nh(t, a.kernelBackend), pi.create(t, a)]), u = t.createBuffer({
			label: "parakeet-fp32-transient-palette-weight-scratch",
			size: Ci,
			usage: GPUBufferUsage.STORAGE
		});
		try {
			const l = new fi(t, 11, "parakeet-fp32-transient-palette-parameter-pool", a);
			return new Wi(t, r, s, i, l, u, a);
		} catch (l) {
			throw u.destroy(), l;
		}
	}
	createDispatch(t) {
		if (this.destroyed) throw new Error("Parakeet FP32 GEMM kernel was destroyed");
		zo(t);
		const r = jo(this.specializedPipelines, t);
		Ho(t, r.specialization);
		const a = this.executionProfile.kernelBackend === "subgroups" ? Rn(t.rows, t.inner, t.columns, r.specialization.weightLayout) : or(t.rows, t.inner, t.columns, r.specialization.weightLayout), n = t.bias?.binding ?? (t.residual === void 0 ? void 0 : this.arena.binding(t.residual)), o = Te(t.b.runtimeRecord.layout);
		let s;
		try {
			const i = t.preparedPaletteWeight, u = i === void 0 ? this.createInlinePaletteWeight(t, r.specialization, o) : this.requirePreparedPaletteWeight(t, r.specialization, i);
			s = u.preparation;
			const l = this.device.createBindGroup({
				label: `${t.label}-fp32-bindings`,
				layout: r.layout,
				entries: [
					{
						binding: 0,
						resource: this.arena.binding(t.a)
					},
					{
						binding: 1,
						resource: u.binding
					},
					{
						binding: 2,
						resource: this.arena.binding(t.output)
					},
					...n === void 0 ? [] : [{
						binding: 3,
						resource: n
					}]
				]
			});
			return new ah(t.label, t.output, r.pipeline, l, a.workgroups, t.rows, t.inner, t.columns, r.specialization.weightLayout, this.executionProfile.kernelBackend, s);
		} catch (i) {
			throw s?.destroy(), i;
		}
	}
	createPreparedPaletteWeight(t, r) {
		if (this.destroyed) throw new Error("Parakeet FP32 GEMM kernel was destroyed");
		if (t.preparedPaletteWeight !== void 0) throw new Error(`${t.label} cannot prepare an already prepared weight`);
		zo(t);
		const a = jo(this.specializedPipelines, t);
		Ho(t, a.specialization);
		const n = Te(t.b.runtimeRecord.layout);
		if (n === void 0) throw new Error(`${t.label} is not a palette-compressed weight`);
		const o = this.createPaletteWeight(t, a.specialization, n, r);
		return {
			source: t.b,
			palette: t.bPalette,
			paletteGroupColumns: t.paletteGroupColumns,
			inner: t.inner,
			columns: t.columns,
			runtimeLayout: a.specialization.weightLayout,
			binding: o.binding,
			preparation: o.preparation
		};
	}
	createInlinePaletteWeight(t, r, a) {
		return a === void 0 ? { binding: t.b.binding } : this.createPaletteWeight(t, r, a, 0);
	}
	createPaletteWeight(t, r, a, n) {
		const o = t.inner * t.columns * Float32Array.BYTES_PER_ELEMENT;
		if (!Number.isSafeInteger(n) || n < 0 || n % this.device.limits.minStorageBufferOffsetAlignment !== 0 || n + o > 17301504) throw new RangeError(`${t.label} has an invalid FP32 transient palette scratch slice`);
		const s = {
			buffer: this.dequantizedWeightScratch,
			offset: n,
			size: o
		}, i = t.bPalette, u = {
			label: `${t.label}-fp32-palette-expand`,
			source: t.b.binding,
			palette: i.binding,
			target: s,
			scalarCount: t.inner * t.columns,
			columns: t.columns,
			paletteBits: a,
			paletteGroupColumns: t.paletteGroupColumns,
			paletteGroups: i.runtimeRecord.storageShape[0],
			runtimeLayout: r.weightLayout
		}, l = this.paletteExpander.createPooledDispatch(u, this.paletteParameterPool.bindingFor(u));
		return this.transientPaletteDispatchCountValue += 1, this.transientPaletteExpandedBytesValue += o, {
			binding: s,
			preparation: l
		};
	}
	requirePreparedPaletteWeight(t, r, a) {
		if (a.source !== t.b || a.palette !== t.bPalette || a.paletteGroupColumns !== t.paletteGroupColumns || a.inner !== t.inner || a.columns !== t.columns || a.runtimeLayout !== r.weightLayout) throw new Error(`${t.label} has a mismatched prepared FP32 palette weight`);
		return { binding: a.binding };
	}
	destroy() {
		this.destroyed || (this.destroyed = !0, this.paletteParameterPool.destroy(), this.dequantizedWeightScratch.destroy());
	}
};
function zo(e) {
	if (!Number.isSafeInteger(e.rows) || e.rows <= 0 || !Number.isSafeInteger(e.inner) || e.inner <= 0 || e.inner % 32 !== 0 || !Number.isSafeInteger(e.columns) || e.columns <= 0 || e.columns % Q !== 0) throw new RangeError(`Unsupported FP32 GEMM shape for ${e.label}`);
	const t = e.inner * e.columns, r = e.b.sourceRecord, a = Te(r.layout);
	if (r.logicalShape.join(",") !== `${e.inner},${e.columns}`) throw new Error(`${e.label} FP32 weight package does not match K=${e.inner}, N=${e.columns}`);
	if (a === void 0 || r.dtype !== "uint32") throw new Error(`${e.label} has an unsupported FP32 weight format`);
	const n = a === 5 ? 32 : 16, o = a === 5 ? 5 : 3;
	if (t % n !== 0) throw new Error(`${e.label} FP32 palette codes are not group aligned`);
	const s = t / n;
	if (r.byteLength !== s * o * Uint32Array.BYTES_PER_ELEMENT || r.storageShape.join(",") !== `${s},${o}`) throw new Error(`${e.label} has invalid packed FP32 palette indices`);
}
function qi(e) {
	return [
		e.rows,
		e.inner,
		e.columns,
		e.activation,
		e.hasBias ? "bias" : "no-bias",
		e.residualScale === null ? "no-residual" : `residual-${e.residualScale}`
	].join(":");
}
function jo(e, t) {
	if (t.residual === void 0 && t.residualScale !== void 0) throw new Error(`${t.label} supplies a residual scale without a residual`);
	const r = {
		rows: t.rows,
		inner: t.inner,
		columns: t.columns,
		activation: t.activation ?? "none",
		hasBias: t.bias !== void 0,
		residualScale: t.residual === void 0 ? null : t.residualScale ?? 1
	}, a = e.get(qi(r));
	if (a === void 0) throw new Error(`${t.label} is not a fixed production FP32 GEMM signature: M=${r.rows}, K=${r.inner}, N=${r.columns}, activation=${r.activation}, bias=${r.hasBias}, residualScale=${r.residualScale ?? "none"}`);
	return a;
}
function Ho(e, t) {
	const r = e.b.runtimeRecord, a = Te(r.layout);
	if (a !== void 0) {
		const o = e.b.sourceRecord, s = Te(o.layout), i = e.bPalette, u = e.paletteGroupColumns, l = 1 << a, c = i?.runtimeRecord.storageShape[0];
		if (s !== a || r.dtype !== "uint32" || r.layout !== o.layout || r.logicalShape.join(",") !== `${e.inner},${e.columns}` || r.storageShape.join(",") !== o.storageShape.join(",") || r.byteLength !== o.byteLength || i === void 0 || i.sourceRecord.dtype !== "float32" || i.sourceRecord.layout !== "output-group-by-palette-lut" || i.runtimeRecord.dtype !== "float32" || i.runtimeRecord.layout !== "output-group-by-palette-lut" || i.runtimeRecord.logicalShape.join(",") !== i.sourceRecord.logicalShape.join(",") || i.runtimeRecord.storageShape.join(",") !== `${c},${l}` || i.runtimeRecord.byteLength !== c * l * Float32Array.BYTES_PER_ELEMENT || !Number.isSafeInteger(u) || u <= 0 || u * c !== e.columns) throw new Error(`${e.label} has invalid transient FP32 palette weights`);
		if (e.inner * e.columns * Float32Array.BYTES_PER_ELEMENT > 17301504) throw new Error(`${e.label} exceeds transient FP32 palette scratch`);
		t.weightLayout === "n128-k32-tile-major-f32" && uo(e.inner, e.columns);
		return;
	}
	const n = t.weightLayout === "n128-k32-tile-major-f32" ? uo(e.inner, e.columns) : [e.inner, e.columns];
	if (r.dtype !== "float32" || r.layout !== t.weightLayout || r.logicalShape.join(",") !== `${e.inner},${e.columns}` || r.storageShape.join(",") !== n.join(",") || r.byteLength !== e.inner * e.columns * Float32Array.BYTES_PER_ELEMENT || e.bPalette !== void 0 || e.paletteGroupColumns !== void 0) throw new Error(`${e.label} has invalid ${t.weightLayout} weights`);
}
async function nh(e, t) {
	const r = await Promise.all(qo.map(async (n) => {
		const o = t === "portable" ? "-portable" : "", s = e.createBindGroupLayout({
			label: `parakeet-fp32-gemm-${n.label}${o}-bindings`,
			entries: [
				Je(0, !1),
				Je(1, !0),
				Je(2, !1),
				...n.hasBias ? [Je(3, !0)] : n.residualScale === null ? [] : [Je(3, !1)]
			]
		}), i = e.createPipelineLayout({ bindGroupLayouts: [s] }), u = {
			specialization: n,
			pipeline: t === "subgroups" ? await oh(e, i, n) : await sh(e, i, n),
			layout: s
		};
		return [qi(n), u];
	})), a = new Map(r);
	if (a.size !== qo.length) throw new Error("Duplicate fixed production FP32 GEMM specialization");
	return a;
}
async function oh(e, t, r) {
	const a = `parakeet-fp32-gemm-${r.label}`, n = e.createShaderModule({
		label: a,
		code: eh(r)
	}), o = (await n.getCompilationInfo()).messages.filter((s) => s.type === "error");
	if (o.length > 0) throw new Error(`${a} WGSL failed: ` + o.map((s) => `${s.lineNum}:${s.linePos} ${s.message}`).join("; "));
	return e.createComputePipelineAsync({
		label: a,
		layout: t,
		compute: {
			module: n,
			entryPoint: "main"
		}
	});
}
async function sh(e, t, r) {
	const a = `parakeet-fp32-gemm-${r.label}-portable`, n = e.createShaderModule({
		label: a,
		code: rh(r)
	}), o = (await n.getCompilationInfo()).messages.filter((s) => s.type === "error");
	if (o.length > 0) throw new Error(`${a} WGSL failed: ` + o.map((s) => `${s.lineNum}:${s.linePos} ${s.message}`).join("; "));
	return e.createComputePipelineAsync({
		label: a,
		layout: t,
		compute: {
			module: n,
			entryPoint: "main"
		}
	});
}
const kr = 256, qt = 32, Xt = kr / qt;
var ih = class {
	label;
	output;
	pipeline;
	bindGroup;
	rows;
	destroyed = !1;
	constructor(e, t, r, a, n) {
		this.label = e, this.output = t, this.pipeline = r, this.bindGroup = a, this.rows = n;
	}
	encode(e, t, r) {
		if (this.destroyed) throw new Error(`${this.label} was destroyed`);
		const a = r?.rows ?? this.rows;
		if (!Number.isSafeInteger(a) || a <= 0 || a > this.rows) throw new RangeError(`${this.label} active rows must be in [1, ${this.rows}]`);
		const n = e.beginComputePass(t === void 0 ? { label: this.label } : {
			label: this.label,
			timestampWrites: t
		});
		n.setPipeline(this.pipeline), n.setBindGroup(0, this.bindGroup), n.dispatchWorkgroups(a), n.end();
	}
	destroy() {
		this.destroyed || (this.destroyed = !0);
	}
}, Vo = class Di {
	device;
	arena;
	pipeline;
	layout;
	parameterPool;
	executionProfile;
	destroyed = !1;
	constructor(t, r, a, n, o, s) {
		this.device = t, this.arena = r, this.pipeline = a, this.layout = n, this.parameterPool = o, this.executionProfile = s;
	}
	get uniformParameterPoolBytes() {
		return this.parameterPool.byteLength;
	}
	get uniformParameterPoolUsedSlots() {
		return this.parameterPool.usedSlots;
	}
	static async create(t, r, a, n = J) {
		if (n.kernelBackend === "subgroups" && !t.features.has("subgroups")) throw new Error("Parakeet LayerNorm requires WebGPU subgroups");
		if (n.precision === "fp16" && !t.features.has("shader-f16")) throw new Error("Parakeet FP16 LayerNorm requires WebGPU shader-f16");
		const o = n.kernelBackend === "portable" ? n.precision === "fp16" ? "parakeet-layernorm-portable" : "parakeet-layernorm-fp32-portable" : n.precision === "fp16" ? "parakeet-layernorm" : "parakeet-layernorm-fp32", s = t.createBindGroupLayout({
			label: "parakeet-layernorm-bindings",
			entries: [
				Jr(0, !1),
				Jr(1, !0),
				Jr(2, !0),
				Jr(3, !1),
				{
					binding: 4,
					visibility: GPUShaderStage.COMPUTE,
					buffer: { type: "uniform" }
				}
			]
		}), i = t.createShaderModule({
			label: o,
			code: ch(n)
		}), u = (await i.getCompilationInfo()).messages.filter((d) => d.type === "error");
		if (u.length > 0) throw new Error(`LayerNorm WGSL failed: ${u.map((d) => d.message).join("; ")}`);
		const l = await t.createComputePipelineAsync({
			label: o,
			layout: t.createPipelineLayout({ bindGroupLayouts: [s] }),
			compute: {
				module: i,
				entryPoint: "main"
			}
		}), c = new ar(t, 16, a, "parakeet-layernorm-parameter-pool");
		return new Di(t, r, l, s, c, n);
	}
	createDispatch(t) {
		if (!Number.isSafeInteger(t.rows) || !Number.isSafeInteger(t.channels) || t.rows <= 0 || t.channels <= 0 || t.channels % 4 !== 0) throw new RangeError(`Invalid LayerNorm shape for ${t.label}`);
		const r = uh(this.executionProfile), a = Xo([
			t.rows,
			t.channels,
			r
		], `${t.label} LayerNorm activation`);
		Ko(t.input, a, "input", t.label), Ko(t.output, a, "output", t.label);
		const n = Xo([t.channels, Float32Array.BYTES_PER_ELEMENT], `${t.label} LayerNorm affine`);
		Yo(t.gamma, [t.channels], n, `${t.label} gamma`), Yo(t.beta, [t.channels], n, `${t.label} beta`);
		const o = /* @__PURE__ */ new ArrayBuffer(16);
		new Uint32Array(o, 0, 2).set([t.rows, t.channels]), new Float32Array(o, 8, 1)[0] = t.epsilon ?? 1e-5;
		const s = this.parameterPool.bindingFor(t.label, o), i = this.device.createBindGroup({
			label: `${t.label}-bindings`,
			layout: this.layout,
			entries: [
				{
					binding: 0,
					resource: this.arena.binding(t.input)
				},
				{
					binding: 1,
					resource: t.gamma.binding
				},
				{
					binding: 2,
					resource: t.beta.binding
				},
				{
					binding: 3,
					resource: this.arena.binding(t.output)
				},
				{
					binding: 4,
					resource: s
				}
			]
		});
		return new ih(t.label, t.output, this.pipeline, i, t.rows);
	}
	destroy() {
		this.destroyed || (this.destroyed = !0, this.parameterPool.destroy());
	}
};
function uh(e) {
	return e.precision === "fp16" ? 2 : 4;
}
function Ko(e, t, r, a) {
	if (e.byteLength < t) throw new RangeError(`${a} ${r} needs ${t} bytes; arena slice has ${e.byteLength}`);
}
function Yo(e, t, r, a) {
	const n = e.runtimeRecord;
	if (n.dtype !== "float32" || n.layout !== "channel" || n.byteLength !== r || !Zo(n.logicalShape, t) || !Zo(n.storageShape, t)) throw new Error(`${a} must be float32 channel logical/storage [${t.join(",")}], ${r} bytes`);
}
function Zo(e, t) {
	return e.length === t.length && e.every((r, a) => r === t[a]);
}
function Xo(e, t) {
	const r = e.reduce((a, n) => a * n, 1);
	if (!Number.isSafeInteger(r) || r <= 0) throw new RangeError(`${t} byte length exceeds the safe integer range`);
	return r;
}
function Jr(e, t) {
	return {
		binding: e,
		visibility: GPUShaderStage.COMPUTE,
		buffer: { type: t ? "read-only-storage" : "storage" }
	};
}
const un = `
enable f16;
enable subgroups;

struct Params {
  rows: u32,
  channels: u32,
  epsilon: f32,
  _pad: u32,
};

@group(0) @binding(0) var<storage, read_write> input: array<vec4<f16>>;
@group(0) @binding(1) var<storage, read> gamma: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> beta: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> output: array<vec4<f16>>;
@group(0) @binding(4) var<uniform> params: Params;

var<workgroup> subgroup_sum: array<f32, ${Xt}>;
var<workgroup> subgroup_square: array<f32, ${Xt}>;
var<workgroup> mean_shared: f32;
var<workgroup> inverse_std_shared: f32;

@compute @workgroup_size(${kr}, 1, 1)
fn main(
  @builtin(local_invocation_index) lane: u32,
  @builtin(subgroup_invocation_id) subgroup_lane: u32,
  @builtin(subgroup_id) subgroup_slot: u32,
  @builtin(subgroup_size) subgroup_size: u32,
  @builtin(workgroup_id) group: vec3<u32>,
) {
  let row = group.x;
  if (row >= params.rows || subgroup_size != ${qt}u) {
    return;
  }

  let vectors = params.channels / 4u;
  var sum = 0.0;
  var square = 0.0;
  for (var vector = lane; vector < vectors; vector += ${kr}u) {
    let value = vec4<f32>(input[row * vectors + vector]);
    sum += dot(value, vec4<f32>(1.0));
    square += dot(value, value);
  }
  let local_sum = subgroupAdd(sum);
  let local_square = subgroupAdd(square);
  if (subgroup_lane == 0u) {
    subgroup_sum[subgroup_slot] = local_sum;
    subgroup_square[subgroup_slot] = local_square;
  }
  workgroupBarrier();
  if (lane == 0u) {
    var total_sum = 0.0;
    var total_square = 0.0;
    for (
      var subgroup = 0u;
      subgroup < ${Xt}u;
      subgroup += 1u
    ) {
      total_sum += subgroup_sum[subgroup];
      total_square += subgroup_square[subgroup];
    }
    let inverse_channels = 1.0 / f32(params.channels);
    let mean = total_sum * inverse_channels;
    let variance = max(
      total_square * inverse_channels - mean * mean,
      0.0
    );
    mean_shared = mean;
    inverse_std_shared = inverseSqrt(variance + params.epsilon);
  }
  workgroupBarrier();
  let mean = workgroupUniformLoad(&mean_shared);
  let inverse_std = workgroupUniformLoad(&inverse_std_shared);
  for (var vector = lane; vector < vectors; vector += ${kr}u) {
    let value = vec4<f32>(input[row * vectors + vector]);
    let normalized = (value - vec4<f32>(mean)) * inverse_std;
    let affine = normalized * gamma[vector] + beta[vector];
    output[row * vectors + vector] = vec4<f16>(affine);
  }
}
`, lh = zi(un);
let ja, Qo;
function ch(e = J) {
	return e.kernelBackend === "portable" ? (ja ??= dh(un), e.precision === "fp16" ? ja : (Qo ??= zi(ja), Qo)) : e.precision === "fp16" ? un : lh;
}
function zi(e) {
	return e.replace(`enable f16;
`, "").replaceAll("f16", "f32").replaceAll("0.0h", "0.0");
}
function dh(e) {
	let t = ea(e, `enable subgroups;
`, "");
	t = ea(t, `var<workgroup> subgroup_sum: array<f32, ${Xt}>;
var<workgroup> subgroup_square: array<f32, ${Xt}>;`, `var<workgroup> moments: array<vec2<f32>, ${kr}>;`), t = ea(t, `  @builtin(local_invocation_index) lane: u32,
  @builtin(subgroup_invocation_id) subgroup_lane: u32,
  @builtin(subgroup_id) subgroup_slot: u32,
  @builtin(subgroup_size) subgroup_size: u32,
  @builtin(workgroup_id) group: vec3<u32>,`, `  @builtin(local_invocation_index) lane: u32,
  @builtin(workgroup_id) group: vec3<u32>,`), t = ea(t, `  if (row >= params.rows || subgroup_size != ${qt}u) {`, "  if (row >= params.rows) {");
	const r = t.indexOf("  let local_sum = subgroupAdd(sum);"), a = t.indexOf("  let mean = workgroupUniformLoad(&mean_shared);", r);
	if (r < 0 || a < 0) throw new Error("Unable to construct portable LayerNorm reduction");
	const n = `  moments[lane] = vec2<f32>(sum, square);
  workgroupBarrier();
  let virtual_lane = lane & ${qt - 1}u;
  for (var offset = 1u; offset < ${qt}u; offset *= 2u) {
    if ((virtual_lane & (offset * 2u - 1u)) == 0u) {
      moments[lane] += moments[lane + offset];
    }
    workgroupBarrier();
  }
  if (lane == 0u) {
    var totals = vec2<f32>(0.0);
    for (
      var virtual_group = 0u;
      virtual_group < ${Xt}u;
      virtual_group += 1u
    ) {
      totals += moments[virtual_group * ${qt}u];
    }
    let inverse_channels = 1.0 / f32(params.channels);
    let mean = totals.x * inverse_channels;
    let variance = max(
      totals.y * inverse_channels - mean * mean,
      0.0
    );
    mean_shared = mean;
    inverse_std_shared = inverseSqrt(variance + params.epsilon);
  }
  workgroupBarrier();
`;
	return t.slice(0, r) + n + t.slice(a);
}
function ea(e, t, r) {
	if (!e.includes(t)) throw new Error(`Unable to construct portable LayerNorm shader: ${t}`);
	return e.replace(t, r);
}
const Jo = 256;
var hh = class {
	label;
	pipeline;
	bindGroup;
	rows;
	destroyed = !1;
	constructor(e, t, r, a) {
		this.label = e, this.pipeline = t, this.bindGroup = r, this.rows = a;
	}
	encode(e, t, r) {
		if (this.destroyed) throw new Error(`${this.label} was destroyed`);
		const a = r?.rows ?? this.rows;
		if (!Number.isSafeInteger(a) || a <= 0 || a > this.rows) throw new RangeError(`${this.label} active rows must be in [1, ${this.rows}]`);
		const n = e.beginComputePass(t === void 0 ? { label: this.label } : {
			label: this.label,
			timestampWrites: t
		});
		n.setPipeline(this.pipeline), n.setBindGroup(0, this.bindGroup), n.dispatchWorkgroups(a), n.end();
	}
	destroy() {
		this.destroyed || (this.destroyed = !0);
	}
}, fh = class ji {
	device;
	arena;
	pipeline;
	layout;
	channels;
	destroyed = !1;
	constructor(t, r, a, n, o) {
		this.device = t, this.arena = r, this.pipeline = a, this.layout = n, this.channels = o;
	}
	static async create(t, r, a, n) {
		const o = t.createBindGroupLayout({
			label: "parakeet-adapter-residual-bindings",
			entries: [{
				binding: 0,
				visibility: GPUShaderStage.COMPUTE,
				buffer: { type: "storage" }
			}, {
				binding: 1,
				visibility: GPUShaderStage.COMPUTE,
				buffer: { type: "storage" }
			}]
		}), s = t.createShaderModule({
			label: n ? "parakeet-adapter-residual" : "parakeet-adapter-residual-fp32",
			code: ph(a, n)
		}), i = (await s.getCompilationInfo()).messages.filter((l) => l.type === "error");
		if (i.length > 0) throw new Error(`Adapter residual WGSL failed: ${i.map((l) => l.message).join("; ")}`);
		const u = await t.createComputePipelineAsync({
			label: "parakeet-adapter-residual-pipeline",
			layout: t.createPipelineLayout({ bindGroupLayouts: [o] }),
			compute: {
				module: s,
				entryPoint: "main"
			}
		});
		return new ji(t, r, u, o, a);
	}
	createDispatch(t) {
		if (t.channels !== this.channels) throw new RangeError(`${t.label} channels ${t.channels} do not match the compiled adapter residual width ${this.channels}`);
		if (!Number.isSafeInteger(t.rows) || t.rows <= 0) throw new RangeError(`Invalid adapter residual shape for ${t.label}`);
		const r = this.device.createBindGroup({
			label: `${t.label}-bindings`,
			layout: this.layout,
			entries: [{
				binding: 0,
				resource: this.arena.binding(t.source)
			}, {
				binding: 1,
				resource: this.arena.binding(t.accumulator)
			}]
		});
		return new hh(t.label, this.pipeline, r, t.rows);
	}
	destroy() {
		this.destroyed || (this.destroyed = !0);
	}
};
function ph(e, t) {
	if (e % 4 !== 0) throw new RangeError(`Adapter residual channels must be vec4-aligned, got ${e}`);
	const r = e / 4, a = t ? "f16" : "f32";
	return `
${t ? `enable f16;
` : ""}
@group(0) @binding(0) var<storage, read_write> source: array<vec4<${a}>>;
@group(0) @binding(1) var<storage, read_write> accumulator: array<vec4<${a}>>;

@compute @workgroup_size(${Jo}, 1, 1)
fn main(
  @builtin(local_invocation_index) lane: u32,
  @builtin(workgroup_id) group: vec3<u32>,
) {
  let row = group.x;
  let base = row * ${r}u;
  for (var vector = lane; vector < ${r}u; vector += ${Jo}u) {
    let sum = vec4<f32>(accumulator[base + vector]) +
      vec4<f32>(source[base + vector]);
    accumulator[base + vector] = vec4<${a}>(sum);
  }
}
`;
}
const ce = 3, je = 2, ut = 1, Fe = 8, Ue = 2, be = 16, Bn = Fe * Ue * be, mt = 8, _h = Fe * Ue * mt;
const ln = 1501, cn = 128, dn = 751, hn = 64, es = 376, ts = 32, Dt = 256, ht = Dt / 4, Pr = 17, Hi = 5, Or = Pr * Hi * be, fn = Pr * Hi * mt, mh = Or * 4 * Uint16Array.BYTES_PER_ELEMENT + 2 * Uint32Array.BYTES_PER_ELEMENT, gh = fn * 4 * Float32Array.BYTES_PER_ELEMENT + 2 * Uint32Array.BYTES_PER_ELEMENT, $r = 256;
const bh = "kh-kw-output-channel-vec4", Vi = "kh-kw-channel-vec4", pn = "output-channel";
function lt(e) {
	return Ne(e, "subsampling input dimension"), Math.floor((e + 2 * ut - ce) / je) + 1;
}
function wh(e, t = J) {
	return Sh(e, t);
}
function yh(e, t = J) {
	if (Ne(e.batchSize, "batchSize"), e.inputHeight !== ln || e.inputWidth !== cn || e.channels !== Dt) throw new RangeError("Fused conv0+depthwise2 requires fixed [batch,1501,128,256]");
	const r = e.channels / 4, a = lt(lt(e.inputHeight)), n = lt(lt(e.inputWidth)), o = Ln(t), s = t.precision === "fp16" ? be : mt;
	return {
		...e,
		conv0Height: dn,
		conv0Width: hn,
		outputHeight: a,
		outputWidth: n,
		channelVectors: r,
		inputByteLength: e.batchSize * e.inputHeight * e.inputWidth * Float32Array.BYTES_PER_ELEMENT,
		outputByteLength: e.batchSize * a * n * e.channels * o,
		weightByteLength: ce * ce * e.channels * o,
		biasByteLength: e.channels * Float32Array.BYTES_PER_ELEMENT,
		workgroups: [
			Math.ceil(n / Fe),
			Math.ceil(a / Ue),
			Math.ceil(e.batchSize * r / s)
		],
		workgroupStorageBytes: Ji(t)
	};
}
var Ki = class {
	label;
	output;
	outputHeight;
	outputWidth;
	pipeline;
	bindGroup;
	workgroups;
	destroyed = !1;
	constructor(e, t, r, a, n, o, s) {
		this.label = e, this.output = t, this.outputHeight = r, this.outputWidth = a, this.pipeline = n, this.bindGroup = o, this.workgroups = s;
	}
	encode(e, t) {
		if (this.destroyed) throw new Error(`${this.label} was destroyed`);
		const r = e.beginComputePass(t === void 0 ? { label: this.label } : {
			label: this.label,
			timestampWrites: t
		});
		r.setPipeline(this.pipeline), r.setBindGroup(0, this.bindGroup), r.dispatchWorkgroups(...this.workgroups), r.end();
	}
	destroy() {
		this.destroyed || (this.destroyed = !0);
	}
}, rs = class Yi {
	device;
	arena;
	pipeline;
	layout;
	parameterPool;
	executionProfile;
	destroyed = !1;
	constructor(t, r, a, n, o, s) {
		this.device = t, this.arena = r, this.pipeline = a, this.layout = n, this.parameterPool = o, this.executionProfile = s;
	}
	get uniformParameterPoolBytes() {
		return this.parameterPool.byteLength;
	}
	get uniformParameterPoolUsedSlots() {
		return this.parameterPool.usedSlots;
	}
	static async create(t, r, a, n = J) {
		Qi(t, n);
		const o = Ji(n);
		if (t.limits.maxComputeWorkgroupStorageSize < o) throw new Error(`Fused subsampling requires ${o} bytes of workgroup storage`);
		if (t.limits.maxStorageBuffersPerShaderStage < 7) throw new Error("Fused subsampling requires seven storage bindings");
		const s = t.createBindGroupLayout({
			label: "parakeet-subsampling-fused-conv0-depthwise2-bindings",
			entries: [
				Be(0, !1),
				Be(1, !0),
				Be(2, !0),
				Be(3, !0),
				Be(4, !0),
				Be(5, !1),
				Be(6, !1),
				{
					binding: 7,
					visibility: GPUShaderStage.COMPUTE,
					buffer: { type: "uniform" }
				}
			]
		}), i = await An(t, s, n.precision === "fp16" ? "parakeet-subsampling-fused-conv0-depthwise2" : "parakeet-subsampling-fused-conv0-depthwise2-fp32", Th(n)), u = new ar(t, 16, a, "parakeet-subsampling-fused-parameter-pool");
		return new Yi(t, r, i, s, u, n);
	}
	createDispatch(t) {
		const r = yh(t, this.executionProfile);
		Pt(t.input, r.inputByteLength, "input", t.label), Pt(t.output, r.outputByteLength, "output", t.label), $h(t), zt(t.conv0Weights, _n(this.executionProfile), [
			ce,
			ce,
			Dt
		], bh, r.weightByteLength, `${t.label} conv0 weights`), zt(t.conv0Bias, "float32", [Dt], pn, r.biasByteLength, `${t.label} conv0 bias`), zt(t.depthwiseWeights, _n(this.executionProfile), [
			ce,
			ce,
			Dt
		], Vi, r.weightByteLength, `${t.label} depthwise2 weights`), zt(t.depthwiseBias, "float32", [Dt], pn, r.biasByteLength, `${t.label} depthwise2 bias`), Tn(this.device, r.workgroups, t.label);
		const a = this.parameterPool.bindingFor(t.label, new Uint32Array([
			t.batchSize,
			t.validLengthBatchOffset,
			0,
			0
		])), n = this.device.createBindGroup({
			label: `${t.label}-bindings`,
			layout: this.layout,
			entries: [
				{
					binding: 0,
					resource: this.arena.binding(t.input)
				},
				{
					binding: 1,
					resource: t.conv0Weights.binding
				},
				{
					binding: 2,
					resource: t.conv0Bias.binding
				},
				{
					binding: 3,
					resource: t.depthwiseWeights.binding
				},
				{
					binding: 4,
					resource: t.depthwiseBias.binding
				},
				{
					binding: 5,
					resource: this.arena.binding(t.output)
				},
				{
					binding: 6,
					resource: this.arena.binding(t.validLengths)
				},
				{
					binding: 7,
					resource: a
				}
			]
		});
		return new Ki(t.label, t.output, r.outputHeight, r.outputWidth, this.pipeline, n, r.workgroups);
	}
	destroy() {
		this.destroyed || (this.destroyed = !0, this.parameterPool.destroy());
	}
}, as = class Zi {
	device;
	arena;
	pipeline;
	layout;
	parameterPool;
	executionProfile;
	destroyed = !1;
	constructor(t, r, a, n, o, s) {
		this.device = t, this.arena = r, this.pipeline = a, this.layout = n, this.parameterPool = o, this.executionProfile = s;
	}
	get uniformParameterPoolBytes() {
		return this.parameterPool.byteLength;
	}
	get uniformParameterPoolUsedSlots() {
		return this.parameterPool.usedSlots;
	}
	static async create(t, r, a, n = J) {
		Qi(t, n);
		const o = vh(t, "parakeet-subsampling-depthwise"), s = await An(t, o, n.precision === "fp16" ? "parakeet-subsampling-depthwise" : "parakeet-subsampling-depthwise-fp32", Lh(n)), i = new ar(t, 48, a, "parakeet-subsampling-depthwise-parameter-pool");
		return new Zi(t, r, s, o, i, n);
	}
	createDispatch(t) {
		const r = wh(t, this.executionProfile);
		Pt(t.input, r.inputByteLength, "input", t.label), Ph(t), Pt(t.output, r.outputByteLength, "output", t.label), zt(t.weights, _n(this.executionProfile), [
			ce,
			ce,
			t.channels
		], Vi, r.weightByteLength, `${t.label} weights`), zt(t.bias, "float32", [t.channels], pn, r.biasByteLength, `${t.label} bias`), Tn(this.device, r.workgroups, t.label);
		const a = this.parameterPool.bindingFor(t.label, kh(t, r)), n = this.device.createBindGroup({
			label: `${t.label}-bindings`,
			layout: this.layout,
			entries: [
				{
					binding: 0,
					resource: this.arena.binding(t.input)
				},
				{
					binding: 1,
					resource: t.weights.binding
				},
				{
					binding: 2,
					resource: t.bias.binding
				},
				{
					binding: 3,
					resource: this.arena.binding(t.output)
				},
				{
					binding: 4,
					resource: this.arena.binding(t.validLengths)
				},
				{
					binding: 5,
					resource: a
				}
			]
		});
		return new Ki(t.label, t.output, r.outputHeight, r.outputWidth, this.pipeline, n, r.workgroups);
	}
	destroy() {
		this.destroyed || (this.destroyed = !0, this.parameterPool.destroy());
	}
}, Eh = class {
	label;
	pipeline;
	bindGroup;
	workgroups;
	destroyed = !1;
	constructor(e, t, r, a) {
		this.label = e, this.pipeline = t, this.bindGroup = r, this.workgroups = a;
	}
	encode(e, t) {
		if (this.destroyed) throw new Error(`${this.label} was destroyed`);
		const r = e.beginComputePass(t === void 0 ? { label: this.label } : {
			label: this.label,
			timestampWrites: t
		});
		r.setPipeline(this.pipeline), r.setBindGroup(0, this.bindGroup), r.dispatchWorkgroups(...this.workgroups), r.end();
	}
	destroy() {
		this.destroyed || (this.destroyed = !0);
	}
}, ns = class Xi {
	device;
	arena;
	pipeline;
	layout;
	parameterPool;
	executionProfile;
	destroyed = !1;
	constructor(t, r, a, n, o, s) {
		this.device = t, this.arena = r, this.pipeline = a, this.layout = n, this.parameterPool = o, this.executionProfile = s;
	}
	get uniformParameterPoolBytes() {
		return this.parameterPool.byteLength;
	}
	get uniformParameterPoolUsedSlots() {
		return this.parameterPool.usedSlots;
	}
	static async create(t, r, a, n = J) {
		if (n.precision === "fp16" && !t.features.has("shader-f16")) throw new Error("Parakeet subsampling mask requires WebGPU shader-f16");
		if (t.limits.maxComputeInvocationsPerWorkgroup < $r || t.limits.maxComputeWorkgroupSizeX < $r) throw new Error(`Parakeet subsampling mask requires a ${$r}-lane workgroup`);
		const o = t.createBindGroupLayout({
			label: "parakeet-subsampling-time-mask-bindings",
			entries: [
				Be(0, !1),
				Be(1, !1),
				{
					binding: 2,
					visibility: GPUShaderStage.COMPUTE,
					buffer: { type: "uniform" }
				}
			]
		}), s = await An(t, o, n.precision === "fp16" ? "parakeet-subsampling-time-mask" : "parakeet-subsampling-time-mask-fp32", Mh(n)), i = new ar(t, 32, a, "parakeet-subsampling-mask-parameter-pool");
		return new Xi(t, r, s, o, i, n);
	}
	createDispatch(t) {
		if (Ne(t.batchSize, "batchSize"), Ne(t.height, "height"), Ne(t.width, "width"), Ne(t.channels, "channels"), t.channels % 4 !== 0) throw new RangeError("Subsampling mask channels must be divisible by four");
		if (!Number.isSafeInteger(t.validLengthBatchOffset) || t.validLengthBatchOffset < 0) throw new RangeError(`${t.label} valid-length batch offset must be non-negative`);
		Ne(t.validLengthSubsamplingSteps, `${t.label} valid-length subsampling steps`);
		const r = t.channels / 4, a = br([
			t.batchSize,
			t.height,
			t.width,
			r
		], "subsampling mask vectors") * 4 * Ln(this.executionProfile);
		Pt(t.values, a, "values", t.label), Pt(t.validLengths, (t.validLengthBatchOffset + t.batchSize) * Uint32Array.BYTES_PER_ELEMENT, "valid lengths", t.label);
		const n = [
			t.height,
			t.batchSize,
			1
		];
		Tn(this.device, n, t.label);
		const o = this.parameterPool.bindingFor(t.label, new Uint32Array([
			t.batchSize,
			t.height,
			t.width,
			r,
			t.validLengthBatchOffset,
			t.validLengthSubsamplingSteps,
			0,
			0
		])), s = this.device.createBindGroup({
			label: `${t.label}-bindings`,
			layout: this.layout,
			entries: [
				{
					binding: 0,
					resource: this.arena.binding(t.values)
				},
				{
					binding: 1,
					resource: this.arena.binding(t.validLengths)
				},
				{
					binding: 2,
					resource: o
				}
			]
		});
		return new Eh(t.label, this.pipeline, s, n);
	}
	destroy() {
		this.destroyed || (this.destroyed = !0, this.parameterPool.destroy());
	}
};
function Sh(e, t) {
	if (Ne(e.batchSize, "batchSize"), Ne(e.inputHeight, "inputHeight"), Ne(e.inputWidth, "inputWidth"), Ne(e.channels, "channels"), e.channels % 4 !== 0) throw new RangeError("Subsampling channels must be divisible by four");
	const r = lt(e.inputHeight), a = lt(e.inputWidth), n = e.channels / 4, o = Ln(t), s = br([
		e.batchSize,
		e.inputHeight,
		e.inputWidth,
		e.channels,
		o
	], "subsampling input"), i = br([
		e.batchSize,
		r,
		a,
		e.channels,
		o
	], "subsampling output");
	return {
		...e,
		outputHeight: r,
		outputWidth: a,
		channelVectors: n,
		inputByteLength: s,
		outputByteLength: i,
		weightByteLength: br([
			ce,
			ce,
			e.channels,
			o
		], "subsampling weights"),
		biasByteLength: br([e.channels, Float32Array.BYTES_PER_ELEMENT], "subsampling bias"),
		workgroups: [
			Math.ceil(a / Fe),
			Math.ceil(r / Ue),
			Math.ceil(e.batchSize * n / be)
		]
	};
}
function vh(e, t) {
	return e.createBindGroupLayout({
		label: `${t}-bindings`,
		entries: [
			Be(0, !1),
			Be(1, !0),
			Be(2, !0),
			Be(3, !1),
			Be(4, !1),
			{
				binding: 5,
				visibility: GPUShaderStage.COMPUTE,
				buffer: { type: "uniform" }
			}
		]
	});
}
async function An(e, t, r, a) {
	const n = e.createShaderModule({
		label: r,
		code: a
	}), o = (await n.getCompilationInfo()).messages.filter((s) => s.type === "error");
	if (o.length > 0) throw new Error(`${r} WGSL failed: ${o.map((s) => s.message).join("; ")}`);
	return e.createComputePipelineAsync({
		label: r,
		layout: e.createPipelineLayout({ bindGroupLayouts: [t] }),
		compute: {
			module: n,
			entryPoint: "main"
		}
	});
}
function kh(e, t) {
	return new Uint32Array([
		t.batchSize,
		t.inputHeight,
		t.inputWidth,
		t.outputHeight,
		t.outputWidth,
		t.channels,
		t.channelVectors,
		e.validLengthBatchOffset,
		e.validLengthSubsamplingSteps,
		0,
		0,
		0
	]);
}
function Qi(e, t) {
	if (t.precision === "fp16" && !e.features.has("shader-f16")) throw new Error("Parakeet subsampling requires WebGPU shader-f16");
	if (e.limits.maxComputeInvocationsPerWorkgroup < Bn || e.limits.maxComputeWorkgroupSizeX < Fe || e.limits.maxComputeWorkgroupSizeY < Ue || e.limits.maxComputeWorkgroupSizeZ < be) throw new Error(`Parakeet subsampling requires a ${Fe}x${Ue}x${be} compute workgroup`);
}
function Tn(e, t, r) {
	const a = e.limits.maxComputeWorkgroupsPerDimension;
	if (t.some((n) => n > a)) throw new RangeError(`${r} dispatch exceeds maxComputeWorkgroupsPerDimension`);
}
function Pt(e, t, r, a) {
	if (e.byteLength < t) throw new RangeError(`${a} ${r} needs ${t} bytes; arena slice has ${e.byteLength}`);
}
function Ph(e) {
	if (!Number.isSafeInteger(e.validLengthBatchOffset) || e.validLengthBatchOffset < 0) throw new RangeError(`${e.label} valid-length batch offset must be non-negative`);
	Ne(e.validLengthSubsamplingSteps, `${e.label} valid-length subsampling steps`);
	const t = e.validLengthBatchOffset + e.batchSize;
	Pt(e.validLengths, t * Uint32Array.BYTES_PER_ELEMENT, "valid lengths", e.label);
}
function $h(e) {
	if (!Number.isSafeInteger(e.validLengthBatchOffset) || e.validLengthBatchOffset < 0) throw new RangeError(`${e.label} valid-length batch offset must be non-negative`);
	Pt(e.validLengths, (e.validLengthBatchOffset + e.batchSize) * Uint32Array.BYTES_PER_ELEMENT, "valid lengths", e.label);
}
function zt(e, t, r, a, n, o) {
	const s = e.runtimeRecord, i = r.length === 3 ? [
		r[0],
		r[1],
		r[2] / 4,
		4
	] : r;
	if (s.dtype !== t || s.layout !== a || s.byteLength !== n || !os(s.logicalShape, r) || !os(s.storageShape, i)) throw new Error(`${o} must be ${t} ${a} logical [${r.join(",")}], storage [${i.join(",")}], ${n} bytes`);
}
function _n(e) {
	return e.precision === "fp16" ? "float16" : "float32";
}
function Ln(e) {
	return e.precision === "fp16" ? 2 : 4;
}
function Ji(e = J) {
	return e.precision === "fp16" ? mh : gh;
}
function os(e, t) {
	return e.length === t.length && e.every((r, a) => r === t[a]);
}
function br(e, t) {
	const r = e.reduce((a, n) => a * n, 1);
	if (!Number.isSafeInteger(r) || r <= 0) throw new RangeError(`${t} byte length exceeds the safe integer range`);
	return r;
}
function Ne(e, t) {
	if (!Number.isSafeInteger(e) || e <= 0) throw new RangeError(`${t} must be a positive integer`);
}
function Be(e, t) {
	return {
		binding: e,
		visibility: GPUShaderStage.COMPUTE,
		buffer: { type: t ? "read-only-storage" : "storage" }
	};
}
const eu = `
enable f16;

struct Params {
  batch_size: u32,
  valid_length_batch_offset: u32,
  _pad0: u32,
  _pad1: u32,
};

@group(0) @binding(0) var<storage, read_write> fbank: array<f32>;
@group(0) @binding(1) var<storage, read> conv0_weights: array<vec4<f16>>;
@group(0) @binding(2) var<storage, read> conv0_bias: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> depthwise_weights: array<vec4<f16>>;
@group(0) @binding(4) var<storage, read> depthwise_bias: array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> output: array<vec4<f16>>;
@group(0) @binding(6) var<storage, read_write> valid_lengths: array<u32>;
@group(0) @binding(7) var<uniform> params: Params;

var<workgroup> conv0_tile: array<vec4<f16>, ${Or}>;
var<workgroup> valid_conv0_height: u32;
var<workgroup> valid_output_height: u32;

fn fused_subsampled_length(raw_length: u32, steps: u32) -> u32 {
  var length = raw_length;
  for (var step = 0u; step < steps; step += 1u) {
    length = (length + 1u) / 2u;
  }
  return length;
}

@compute @workgroup_size(${Fe}, ${Ue}, ${be})
fn main(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(local_invocation_index) lane: u32,
  @builtin(workgroup_id) group: vec3<u32>,
) {
  let packed_channel_base = group.z * ${be}u;
  let batch = packed_channel_base / ${ht}u;
  let channel_vector_base =
    packed_channel_base % ${ht}u;

  if (lane == 0u) {
    let raw_length =
      valid_lengths[params.valid_length_batch_offset + batch];
    valid_conv0_height = fused_subsampled_length(raw_length, 1u);
    valid_output_height = fused_subsampled_length(raw_length, 2u);
  }
  workgroupBarrier();
  let input_valid_height = workgroupUniformLoad(&valid_conv0_height);
  let output_valid_height = workgroupUniformLoad(&valid_output_height);

  for (
    var tile_index = lane;
    tile_index < ${Or}u;
    tile_index += ${Bn}u
  ) {
    let channel_in_group = tile_index % ${be}u;
    let spatial_index = tile_index / ${be}u;
    let tile_x = spatial_index % ${Pr}u;
    let tile_y = spatial_index / ${Pr}u;
    let conv0_x =
      i32(group.x * ${Fe * je}u + tile_x) - ${ut};
    let conv0_y =
      i32(group.y * ${Ue * je}u + tile_y) - ${ut};
    let channel_vector = channel_vector_base + channel_in_group;
    var rounded = vec4<f16>(0.0h);
    if (
      batch < params.batch_size &&
      channel_vector < ${ht}u &&
      conv0_x >= 0 &&
      conv0_x < ${hn} &&
      conv0_y >= 0 &&
      conv0_y < ${dn} &&
      conv0_y < i32(input_valid_height)
    ) {
      var sum = conv0_bias[channel_vector];
      for (var kernel_y = 0u; kernel_y < ${ce}u; kernel_y += 1u) {
        let input_y =
          conv0_y * ${je} + i32(kernel_y) - ${ut};
        if (input_y < 0 || input_y >= ${ln}) {
          continue;
        }
        for (
          var kernel_x = 0u;
          kernel_x < ${ce}u;
          kernel_x += 1u
        ) {
          let input_x =
            conv0_x * ${je} + i32(kernel_x) - ${ut};
          if (input_x < 0 || input_x >= ${cn}) {
            continue;
          }
          let input_index =
            (batch * ${cn}u + u32(input_x)) *
              ${ln}u +
            u32(input_y);
          let weight_index =
            (kernel_y * ${ce}u + kernel_x) *
              ${ht}u +
            channel_vector;
          let value = fbank[input_index];
          sum = fma(
            vec4<f32>(conv0_weights[weight_index]),
            vec4<f32>(value),
            sum
          );
        }
      }
      rounded = vec4<f16>(max(sum, vec4<f32>(0.0)));
    }
    conv0_tile[tile_index] = rounded;
  }
  workgroupBarrier();

  let output_x = group.x * ${Fe}u + local_id.x;
  let output_y = group.y * ${Ue}u + local_id.y;
  let packed_batch_channel = packed_channel_base + local_id.z;
  let output_batch =
    packed_batch_channel / ${ht}u;
  let channel_vector =
    packed_batch_channel % ${ht}u;
  if (
    output_x >= ${ts}u ||
    output_y >= ${es}u ||
    output_batch >= params.batch_size
  ) {
    return;
  }
  let output_index =
    (
      (output_batch * ${es}u + output_y) *
        ${ts}u +
      output_x
    ) * ${ht}u + channel_vector;
  if (output_y >= output_valid_height) {
    output[output_index] = vec4<f16>(0.0h);
    return;
  }

  var sum = depthwise_bias[channel_vector];
  for (var kernel_y = 0u; kernel_y < ${ce}u; kernel_y += 1u) {
    let input_y =
      i32(output_y * ${je}u + kernel_y) - ${ut};
    if (
      input_y < 0 ||
      input_y >= ${dn} ||
      input_y >= i32(input_valid_height)
    ) {
      continue;
    }
    for (var kernel_x = 0u; kernel_x < ${ce}u; kernel_x += 1u) {
      let input_x =
        i32(output_x * ${je}u + kernel_x) - ${ut};
      if (input_x < 0 || input_x >= ${hn}) {
        continue;
      }
      let tile_x = local_id.x * ${je}u + kernel_x;
      let tile_y = local_id.y * ${je}u + kernel_y;
      let tile_index =
        (tile_y * ${Pr}u + tile_x) *
          ${be}u +
        local_id.z;
      let weight_index =
        (kernel_y * ${ce}u + kernel_x) *
          ${ht}u +
        channel_vector;
      sum = fma(
        vec4<f32>(conv0_tile[tile_index]),
        vec4<f32>(depthwise_weights[weight_index]),
        sum
      );
    }
  }
  output[output_index] = vec4<f16>(sum);
}
`, tu = `
enable f16;

struct Params {
  batch_size: u32,
  input_height: u32,
  input_width: u32,
  output_height: u32,
  output_width: u32,
  channels: u32,
  channel_vectors: u32,
  valid_length_batch_offset: u32,
  valid_length_subsampling_steps: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

@group(0) @binding(0) var<storage, read_write> input: array<vec4<f16>>;
@group(0) @binding(1) var<storage, read> weights: array<vec4<f16>>;
@group(0) @binding(2) var<storage, read> bias: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> output: array<vec4<f16>>;
@group(0) @binding(4) var<storage, read_write> valid_lengths: array<u32>;
@group(0) @binding(5) var<uniform> params: Params;

fn subsampled_length(raw_length: u32, steps: u32) -> u32 {
  var length = raw_length;
  for (var step = 0u; step < steps; step += 1u) {
    length = (length + 1u) / 2u;
  }
  return length;
}

@compute @workgroup_size(${Fe}, ${Ue}, ${be})
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let packed_batch_channel = global_id.z;
  let total_batch_channels = params.batch_size * params.channel_vectors;
  if (
    global_id.x >= params.output_width ||
    global_id.y >= params.output_height ||
    packed_batch_channel >= total_batch_channels
  ) {
    return;
  }

  let batch = packed_batch_channel / params.channel_vectors;
  let channel_vector = packed_batch_channel % params.channel_vectors;
  let raw_valid_length =
    valid_lengths[params.valid_length_batch_offset + batch];
  let valid_input_height = subsampled_length(
    raw_valid_length,
    params.valid_length_subsampling_steps - 1u
  );
  let valid_output_height = subsampled_length(
    raw_valid_length,
    params.valid_length_subsampling_steps
  );
  let output_index =
    (
      (batch * params.output_height + global_id.y) * params.output_width
      + global_id.x
    ) * params.channel_vectors + channel_vector;
  if (global_id.y >= valid_output_height) {
    output[output_index] = vec4<f16>(0.0h);
    return;
  }
  var sum = bias[channel_vector];

  for (var kernel_y = 0u; kernel_y < ${ce}u; kernel_y += 1u) {
    let input_y =
      i32(global_id.y * ${je}u + kernel_y) - ${ut};
    if (
      input_y < 0 ||
      input_y >= i32(params.input_height) ||
      input_y >= i32(valid_input_height)
    ) {
      continue;
    }
    for (var kernel_x = 0u; kernel_x < ${ce}u; kernel_x += 1u) {
      let input_x =
        i32(global_id.x * ${je}u + kernel_x) - ${ut};
      if (input_x < 0 || input_x >= i32(params.input_width)) {
        continue;
      }
      let input_index =
        (
          (batch * params.input_height + u32(input_y)) * params.input_width
          + u32(input_x)
        ) * params.channel_vectors + channel_vector;
      let weight_index =
        (kernel_y * ${ce}u + kernel_x) * params.channel_vectors
        + channel_vector;
      sum = fma(
        vec4<f32>(input[input_index]),
        vec4<f32>(weights[weight_index]),
        sum
      );
    }
  }

  output[output_index] = vec4<f16>(sum);
}
`, ru = `
enable f16;

struct Params {
  batch_size: u32,
  height: u32,
  width: u32,
  channel_vectors: u32,
  valid_length_batch_offset: u32,
  valid_length_subsampling_steps: u32,
  _pad0: u32,
  _pad: u32,
};

@group(0) @binding(0) var<storage, read_write> values: array<vec4<f16>>;
@group(0) @binding(1) var<storage, read_write> valid_lengths: array<u32>;
@group(0) @binding(2) var<uniform> params: Params;

fn subsampled_length(raw_length: u32, steps: u32) -> u32 {
  var length = raw_length;
  for (var step = 0u; step < steps; step += 1u) {
    length = (length + 1u) / 2u;
  }
  return length;
}

@compute @workgroup_size(${$r}, 1, 1)
fn main(
  @builtin(local_invocation_index) lane: u32,
  @builtin(workgroup_id) group: vec3<u32>,
) {
  let frame = group.x;
  let batch = group.y;
  let vectors_per_frame = params.width * params.channel_vectors;
  let valid_height = subsampled_length(
    valid_lengths[params.valid_length_batch_offset + batch],
    params.valid_length_subsampling_steps
  );
  if (frame < valid_height) {
    return;
  }
  let frame_base =
    (batch * params.height + frame) * vectors_per_frame;
  for (
    var vector = lane;
    vector < vectors_per_frame;
    vector += ${$r}u
  ) {
    values[frame_base + vector] = vec4<f16>(0.0h);
  }
}
`, Rh = Ch(eu), Bh = Mn(tu), Ah = Mn(ru);
function Th(e = J) {
	return e.precision === "fp16" ? eu : Rh;
}
function Lh(e = J) {
	return e.precision === "fp16" ? tu : Bh;
}
function Mh(e = J) {
	return e.precision === "fp16" ? ru : Ah;
}
function Ch(e) {
	let t = Mn(e);
	return t = ft(t, `@compute @workgroup_size(${Fe}, ${Ue}, ${be})`, `@compute @workgroup_size(${Fe}, ${Ue}, ${mt})`), t = ft(t, `var<workgroup> conv0_tile: array<vec4<f32>, ${Or}>;`, `var<workgroup> conv0_tile: array<vec4<f32>, ${fn}>;`), t = ft(t, `tile_index < ${Or}u`, `tile_index < ${fn}u`), t = ft(t, `tile_index += ${Bn}u`, `tile_index += ${_h}u`), t = ft(t, `let packed_channel_base = group.z * ${be}u;`, `let packed_channel_base = group.z * ${mt}u;`), t = ft(t, `let channel_in_group = tile_index % ${be}u;`, `let channel_in_group = tile_index % ${mt}u;`), t = ft(t, `let spatial_index = tile_index / ${be}u;`, `let spatial_index = tile_index / ${mt}u;`), ft(t, `) *
          ${be}u +
        local_id.z;`, `) *
          ${mt}u +
        local_id.z;`);
}
function Mn(e) {
	return e.replace(`enable f16;
`, "").replaceAll("f16", "f32").replaceAll("0.0h", "0.0");
}
function ft(e, t, r) {
	if (!e.includes(t)) throw new Error(`Unable to construct FP32 subsampling shader: ${t}`);
	return e.replace(t, r);
}
const tt = 1501;
const R = 1024, Tt = cl;
const au = 244, Ih = au, nu = 1192755200, xh = nu * 2;
const ou = 19, ta = 256, Rr = 376, Br = 32, Ar = 188, Qt = 16, Tr = Qt * 256, Oh = Tr * R * Uint16Array.BYTES_PER_ELEMENT, su = 256 * 256 * Uint16Array.BYTES_PER_ELEMENT, Nh = 0, iu = Oh, uu = iu + su;
if (uu + su !== 8650752) throw new Error("Subsampling palette weights do not fill their transient scratch");
const Fh = Tr * R * Float32Array.BYTES_PER_ELEMENT, lu = 256 * 256 * Float32Array.BYTES_PER_ELEMENT, Uh = 0, cu = Fh, du = cu + lu;
if (du + lu !== 17301504) throw new Error("FP32 subsampling palette weights do not fill their transient scratch");
const ss = R * 3, is = R * 2, us = 375, wa = Float32Array.BYTES_PER_ELEMENT, Gh = Uint16Array.BYTES_PER_ELEMENT, Wh = Float32Array.BYTES_PER_ELEMENT, ca = Uint32Array.BYTES_PER_ELEMENT, St = 256, qh = 1e-5;
function Dh(e) {
	return {
		get portableF16LoadEncoding() {
			return e.portableLoadEncoding;
		},
		get transientPaletteParameterBytes() {
			return e.transientPaletteParameterBytes;
		},
		get transientPaletteParameterUsedSlots() {
			return e.transientPaletteParameterUsedSlots;
		},
		get transientPaletteDispatchCount() {
			return e.transientPaletteDispatchCount;
		},
		get transientPaletteExpandedBytes() {
			return e.transientPaletteExpandedBytes;
		},
		createDispatch(t) {
			return e.createDispatch(t);
		},
		createPreparedPaletteWeight(t, r) {
			return e.createPreparedPaletteWeight(t, r);
		}
	};
}
function zh(e) {
	return {
		portableF16LoadEncoding: null,
		get transientPaletteParameterBytes() {
			return e.transientPaletteParameterBytes;
		},
		get transientPaletteParameterUsedSlots() {
			return e.transientPaletteParameterUsedSlots;
		},
		get transientPaletteDispatchCount() {
			return e.transientPaletteDispatchCount;
		},
		get transientPaletteExpandedBytes() {
			return e.transientPaletteExpandedBytes;
		},
		createDispatch(t) {
			return e.createDispatch(t);
		},
		createPreparedPaletteWeight(t, r) {
			return e.createPreparedPaletteWeight(t, r);
		}
	};
}
function jh(e) {
	Cn(e, "featureLength");
	const t = lt(e), r = lt(t);
	return [
		t,
		r,
		lt(r)
	];
}
function Hh(e) {
	if (e > 1501) throw new RangeError(`featureLength must not exceed ${tt}`);
	return jh(e)[2];
}
function hu(e, t = e.length) {
	if (Cn(t, "batchSize"), e.length !== t) throw new RangeError(`Expected ${t} feature lengths, got ${e.length}`);
	const r = new Uint32Array(t);
	for (let a = 0; a < t; a++) {
		const n = e[a];
		if (n === void 0) throw new RangeError(`Missing feature length ${a}`);
		r[a] = Hh(n);
	}
	return r;
}
function ra(e) {
	if (!Number.isSafeInteger(e) || e <= 0 || e > 40) throw new RangeError("Encoder active batch must be in [1, 40]");
	return {
		batchSize: e,
		rows: e * 188,
		microbatchCount: Math.ceil(e / 3)
	};
}
function Vh(e, t, r) {
	if (!Number.isSafeInteger(t) || t < 0) throw new RangeError("Subsampling batch offset must be non-negative");
	Cn(r, "subsampling batch size");
	const a = t + r;
	if (!Number.isSafeInteger(a) || a > e.length) throw new RangeError("Subsampling batch slice exceeds valid lengths");
	let n = !1;
	for (let o = t; o < a; o++) {
		const s = e[o];
		if (s === void 0 || !Number.isSafeInteger(s) || s <= 0 || s > 188) throw new RangeError(`Encoder valid length ${o} must be in [1, 188]`);
		n ||= s < 188;
	}
	return n;
}
function Kh(e, t) {
	if (!Number.isSafeInteger(t) || t < 0 || t >= e.encoderSlots.length) throw new RangeError("Encoder input slot is out of range");
	const r = (t + 1) % e.encoderSlots.length, a = r, n = (a + 1) % e.encoderSlots.length;
	return {
		input: e.encoderSlots[t],
		alternate: e.encoderSlots[r],
		postFeedForward1: e.encoderSlots[a],
		moduleScratch: e.encoderSlots[n],
		bigTemporary: e.bigTemporary,
		feedForwardTemporary: e.feedForwardTemporary,
		attentionQkv: e.attentionQkv,
		attentionContext: e.attentionContext,
		convolutionPointwise: e.convolutionPointwise,
		convolutionOutput: e.convolutionOutput,
		outputSlot: a
	};
}
function Yh() {
	return {
		logicalDispatches: ou,
		layerNormPasses: 6,
		feedForward1MatrixPasses: 2,
		totalComputePasses: 27
	};
}
function Zh() {
	return Qh;
}
function Xh() {
	const e = [{
		kind: "subsampling",
		label: "parakeet-encoder-subsampling",
		layerIndex: null
	}];
	for (let t = 0; t < 24; t += 1) e.push({
		kind: "conformer-layer",
		label: `parakeet-encoder-layer-${t.toString().padStart(2, "0")}`,
		layerIndex: t
	});
	if (e.push({
		kind: "projector",
		label: "parakeet-encoder-projector",
		layerIndex: null
	}), e.length !== 26) throw new Error("Encoder submission chunk count changed");
	return Object.freeze(e.map((t) => Object.freeze(t)));
}
const Qh = Xh();
function Jh(e) {
	const t = e === "fp16" ? 2 : 4, r = [];
	let a = 0;
	const n = (s, i, u, l) => {
		const c = 188 * l, d = a * t, h = c * t;
		r.push({
			label: s,
			kind: i,
			layerIndex: u,
			rows: 188,
			channels: l,
			elementOffset: a,
			elementCount: c,
			byteOffset: d,
			byteLength: h
		}), a += c;
	};
	n("subsampling", "subsampling", null, R);
	for (let s = 0; s < 24; s += 1) n(`layer-${s.toString().padStart(2, "0")}`, "layer", s, R);
	n("projector", "projector", null, 640);
	const o = a * t;
	return {
		precision: e,
		elementBytes: t,
		elementCount: a,
		byteLength: o,
		widenedFloat32ByteLength: a * Float32Array.BYTES_PER_ELEMENT,
		checkpoints: r
	};
}
function ef() {
	return {
		unconditionalPerMicrobatch: 5,
		conditionalFinalMasksPerMicrobatch: 1
	};
}
function tf(e) {
	const r = [
		[16, 40],
		[48, 40],
		[32, 40],
		[16, 1],
		[32, 1],
		[16, 1]
	];
	return {
		bufferCount: 6,
		uniqueSlotCount: r.reduce((a, [, n]) => a + n, 0),
		byteLength: r.reduce((a, [n, o]) => a + ri(n, o, e).byteLength, 0)
	};
}
function fu(e = "fp16") {
	if (e === "fp32") return rf();
	const t = Gh, r = 40, a = 3, n = ve([r, 188], "encoder rows"), o = ve([
		n,
		R,
		t
	], "encoder slot bytes"), s = ve([
		n,
		Tt,
		t
	], "encoder big temporary bytes"), i = ve([
		n,
		Tt,
		t
	], "encoder feed-forward temporary bytes"), u = ve([
		n,
		640,
		t
	], "encoder projected output bytes"), l = N("encoder-slot-0", 0, o), c = N("feature-valid-lengths", gt(l), r * ca), d = N("encoder-valid-lengths", gt(c), r * ca), h = gt(d), f = N("fbank-feature-major", h, ve([
		r,
		128,
		tt,
		wa
	], "feature input bytes")), p = pa(a, Rr, Br, 256 * t), _ = pa(a, Ar, Qt, 256 * t), b = Math.max(p, _), w = gt(f), g = p, y = _, B = Math.max(g, y), P = yt(w + b, St), x = P + B, A = N("encoder-slot-1", h, o), T = N("encoder-big-temporary", gt(A), s), L = N("encoder-feed-forward-temporary", T.byteOffset, i), ae = N("encoder-attention-qkv", T.byteOffset, o * 3), H = N("encoder-attention-context", T.byteOffset + o * 3, o), W = N("encoder-convolution-pointwise", T.byteOffset, o * 2), v = N("encoder-convolution-output", T.byteOffset + o * 2, o), V = N("encoder-projector-output", T.byteOffset, u), de = T.byteOffset + T.byteLength, _e = {
		stage376: N("subsampling-stage-376", w, p),
		stage188: N("subsampling-stage-188", w, _),
		projected376: N("subsampling-projected-376", P, g),
		projected188: N("subsampling-projected-188", P, y)
	}, q = ve([
		188,
		R,
		t
	], "per-batch encoder bytes"), F = [];
	for (let Ae = 1; Ae <= r; Ae++) {
		const ne = Ae % a, ye = ne === 0 ? a : ne, Le = Ae - ye;
		F.push({
			batchOffset: Le,
			batchSize: ye,
			output: N(`encoder-slot-0-batch-${Le}-size-${ye}`, l.byteOffset + Le * q, ye * q)
		});
	}
	const we = Array.from({ length: 24 }, (Ae, ne) => (ne + 1) % 2), Z = yt(Math.max(x, de), St);
	return {
		precision: e,
		batchSize: r,
		rows: n,
		intermediateChannels: Tt,
		subsamplingMicrobatchSize: a,
		byteLength: Z,
		buffers: [{
			label: "parakeet-encoder-arena",
			byteLength: Z
		}],
		featureInput: f,
		featureLengths: c,
		encoderLengths: d,
		encoderSlots: [l, A],
		bigTemporary: T,
		feedForwardTemporary: L,
		attentionQkv: ae,
		attentionContext: H,
		convolutionPointwise: W,
		convolutionOutput: v,
		projectedOutput: V,
		decoderScratch: l,
		subsampling: _e,
		microbatches: F,
		layerOutputSlots: we
	};
}
function rf() {
	const e = "fp32", t = Wh, r = 40, a = 3, n = ve([r, 188], "encoder rows"), o = ve([
		n,
		R,
		t
	], "encoder slot bytes"), s = ve([
		n,
		Tt,
		t
	], "encoder big temporary bytes"), i = ve([
		n,
		640,
		t
	], "encoder projected output bytes"), u = N("encoder-slot-0", 0, o, 0), l = N("feature-valid-lengths", gt(u), r * ca, 0), c = yt(l.byteOffset + l.byteLength, St), d = N("encoder-slot-1", 0, o, 1), h = N("encoder-valid-lengths", gt(d), r * ca, 1), f = yt(h.byteOffset + h.byteLength, St), p = N("fbank-feature-major", 0, ve([
		r,
		128,
		tt,
		wa
	], "feature input bytes"), 1), _ = pa(a, Rr, Br, 256 * t), b = pa(a, Ar, Qt, 256 * t), w = Math.max(_, b), g = w, y = 0, B = yt(w, St), P = B + g, x = N("encoder-big-temporary", 0, s, 2), A = N("encoder-feed-forward-temporary", 0, s, 2), T = N("encoder-attention-qkv", 0, o * 3, 2), L = N("encoder-attention-context", o * 3, o, 2), ae = N("encoder-convolution-pointwise", 0, o * 2, 2), H = N("encoder-convolution-output", o * 2, o, 2), W = yt(Math.max(P, s), St), v = N("encoder-projector-output", 0, i, 1), V = gt(v), de = N("tdt-decoder-scratch", V, o - V, 1), _e = {
		stage376: N("subsampling-stage-376", y, _, 2),
		stage188: N("subsampling-stage-188", y, b, 2),
		projected376: N("subsampling-projected-376", B, _, 2),
		projected188: N("subsampling-projected-188", B, b, 2)
	}, q = ve([
		188,
		R,
		t
	], "per-batch encoder bytes"), F = [];
	for (let ne = 1; ne <= r; ne++) {
		const ye = ne % a, Le = ye === 0 ? a : ye, sr = ne - Le;
		F.push({
			batchOffset: sr,
			batchSize: Le,
			output: N(`encoder-slot-0-batch-${sr}-size-${Le}`, sr * q, Le * q, 0)
		});
	}
	const we = Array.from({ length: 24 }, (ne, ye) => (ye + 1) % 2);
	if (we.at(-1) !== 0) throw new Error("FP32 projector aliasing requires the fixed even encoder layer count");
	const Z = [
		{
			label: "parakeet-encoder-fp32-slot-zero",
			byteLength: c
		},
		{
			label: "parakeet-encoder-fp32-slot-one",
			byteLength: f
		},
		{
			label: "parakeet-encoder-fp32-temporary",
			byteLength: W
		}
	], Ae = Z.reduce((ne, ye) => ne + ye.byteLength, 0);
	return {
		precision: e,
		batchSize: r,
		rows: n,
		intermediateChannels: Tt,
		subsamplingMicrobatchSize: a,
		byteLength: Ae,
		buffers: Z,
		featureInput: p,
		featureLengths: l,
		encoderLengths: h,
		encoderSlots: [u, d],
		bigTemporary: x,
		feedForwardTemporary: A,
		attentionQkv: T,
		attentionContext: L,
		convolutionPointwise: ae,
		convolutionOutput: H,
		projectedOutput: v,
		decoderScratch: de,
		subsampling: _e,
		microbatches: F,
		layerOutputSlots: we
	};
}
var af = class pu {
	device;
	subsamplingPreparedWeights;
	subsamplingCommands;
	layerDispatches;
	projectorDispatch;
	allDispatches;
	ownedKernels;
	arena;
	plan;
	batchSize;
	frames = 188;
	transientPaletteParameterPoolBytes;
	transientPaletteParameterPoolUsedSlots;
	transientPaletteMatrixCount;
	transientPaletteExpansionDispatches;
	transientPaletteExpandedBytesPerGraph;
	portableF16GemmLoadEncoding;
	uniformParameterPoolBytes;
	uniformParameterPoolBufferCount;
	uniformParameterPoolUsedSlots;
	destroyed = !1;
	featureInput;
	featureLengths;
	constructor(t, r, a, n, o, s, i, u, l, c, d) {
		this.device = t, this.subsamplingPreparedWeights = n, this.subsamplingCommands = o, this.layerDispatches = s, this.projectorDispatch = i, this.allDispatches = u, this.ownedKernels = l, this.plan = r, this.arena = a, this.featureInput = r.featureInput, this.featureLengths = r.featureLengths, this.batchSize = r.batchSize, this.transientPaletteParameterPoolBytes = c.transientPaletteParameterBytes, this.transientPaletteParameterPoolUsedSlots = c.transientPaletteParameterUsedSlots, this.transientPaletteMatrixCount = au, this.transientPaletteExpansionDispatches = c.transientPaletteDispatchCount, this.transientPaletteExpandedBytesPerGraph = c.transientPaletteExpandedBytes, this.portableF16GemmLoadEncoding = c.portableF16LoadEncoding;
		const h = r.precision === "fp16" ? nu : xh;
		if (this.transientPaletteParameterPoolBytes !== qd(t.limits.minUniformBufferOffsetAlignment) || this.transientPaletteParameterPoolUsedSlots !== 11 || this.transientPaletteExpansionDispatches !== Ih || this.transientPaletteExpandedBytesPerGraph !== h) throw new Error("Transient palette parameter pool inventory changed");
		const f = tf(t.limits.minUniformBufferOffsetAlignment);
		if (this.uniformParameterPoolBytes = d.reduce((p, _) => p + _.uniformParameterPoolBytes, 0), this.uniformParameterPoolBufferCount = d.length, this.uniformParameterPoolUsedSlots = d.reduce((p, _) => p + _.uniformParameterPoolUsedSlots, 0), this.uniformParameterPoolBytes !== f.byteLength || this.uniformParameterPoolBufferCount !== f.bufferCount || this.uniformParameterPoolUsedSlots !== f.uniqueSlotCount) throw new Error("Encoder uniform parameter pool inventory changed");
	}
	static async create(t, r, a = J) {
		sf(r, a);
		const n = fu(a.precision);
		if (n.batchSize > t.limits.maxComputeWorkgroupsPerDimension) throw new RangeError("Encoder batch exceeds the WebGPU dispatch limit");
		const o = a.precision === "fp16" ? new vo(t, n.byteLength, "parakeet-encoder-arena") : new vo(t, n.buffers), s = [], i = [], u = [];
		try {
			const l = a.precision === "fp16" ? await rs.create(t, o, n.microbatches.length) : await rs.create(t, o, n.microbatches.length, a);
			i.push(l), u.push(l);
			const c = a.precision === "fp16" ? await as.create(t, o, n.microbatches.length) : await as.create(t, o, n.microbatches.length, a);
			i.push(c), u.push(c);
			const d = a.precision === "fp16" ? await ns.create(t, o, n.microbatches.length) : await ns.create(t, o, n.microbatches.length, a);
			i.push(d), u.push(d);
			const h = a.precision === "fp16" ? a.kernelBackend === "subgroups" ? await za.create(t, o) : await za.create(t, o, a) : a.kernelBackend === "subgroups" ? await Do.create(t, o) : await Do.create(t, o, a), f = h instanceof za ? Dh(h) : zh(h);
			i.push(h);
			const p = a.precision === "fp16" && a.kernelBackend === "subgroups" ? await Vo.create(t, o, 1) : await Vo.create(t, o, 1, a);
			i.push(p), u.push(p);
			const _ = await fh.create(t, o, R, a.precision === "fp16");
			i.push(_);
			const b = a.precision === "fp16" && a.kernelBackend === "subgroups" ? await Bo.create(t, o, 1) : await Bo.create(t, o, 1, a);
			i.push(b), u.push(b);
			const w = a.precision === "fp16" ? await Mo.create(t, o, 1) : await Mo.create(t, o, 1, a);
			i.push(w), u.push(w);
			const g = of(r, n, l, c, d, f, a), y = g.commands;
			for (const L of g.preparedWeights) s.push(L.preparation);
			for (const L of y) s.push(...L.beforeFinalMaskDispatches, L.finalMaskDispatch, ...L.afterFinalMaskDispatches);
			const B = {
				gemm: f,
				layerNorm: p,
				attention: b,
				conformerConv: w,
				adapterResidual: _
			}, P = [];
			let x = 0;
			for (let L = 0; L < 24; L++) {
				const ae = nf(r, n, B, L, x, a);
				if (ae.outputSlot !== n.layerOutputSlots[L]) throw new Error(`Internal encoder slot rotation failed at layer ${L}`);
				x = ae.outputSlot, P.push(...ae.dispatches), s.push(...ae.dispatches);
			}
			const A = n.layerOutputSlots.at(-1) ?? 0;
			if (x !== A) throw new Error("The encoder did not reach its planned final slot");
			const T = f.createDispatch({
				label: "encoder-projector",
				a: n.encoderSlots[x],
				...Re(r, "encoder_projector.weight", R, 640, a),
				bias: He(r, "encoder_projector.bias", {
					dtype: "float32",
					logicalShape: [640],
					storageShape: [640],
					layout: "output-channel"
				}),
				output: n.projectedOutput,
				rows: n.rows,
				inner: R,
				columns: 640
			});
			return s.push(T), new pu(t, n, o, g.preparedWeights, y, P, T, s, i, f, u);
		} catch (l) {
			for (const c of s.toReversed()) c.destroy();
			for (const c of i.toReversed()) c.destroy();
			throw o.destroy(), l;
		}
	}
	uploadFeatures(t) {
		this.assertAlive();
		const r = 128 * tt * wa;
		if (t.byteLength <= 0 || t.byteLength > this.featureInput.byteLength || t.byteLength % r !== 0) throw new RangeError(`Expected 1-${this.batchSize} complete feature items, got ${t.byteLength} bytes`);
		this.arena.upload(this.device, this.featureInput, t);
	}
	uploadValidFeatureLengths(t) {
		this.assertAlive();
		const r = ra(t.length), a = new Uint32Array(r.batchSize);
		for (let o = 0; o < t.length; o++) {
			const s = t[o];
			if (s === void 0 || !Number.isSafeInteger(s) || s <= 0 || s > 1501) throw new RangeError(`Feature length ${o} must be in [1, ${tt}]`);
			a[o] = s;
		}
		const n = hu(t, r.batchSize);
		return this.arena.upload(this.device, this.featureLengths, a), this.arena.upload(this.device, this.plan.encoderLengths, n), n;
	}
	encodeSubsampling(t, r, a) {
		this.assertAlive();
		for (const n of this.subsamplingPreparedWeights) n.preparation.encode(t);
		for (let n = 0; n < a.microbatchCount; n += 1) {
			const o = Math.min((n + 1) * 3, a.batchSize), s = this.subsamplingCommands[o - 1];
			for (const i of s.beforeFinalMaskDispatches) i.encode(t);
			Vh(r, s.batchOffset, s.batchSize) && s.finalMaskDispatch.encode(t);
			for (const i of s.afterFinalMaskDispatches) i.encode(t);
		}
	}
	encodeConformer(t, r) {
		this.assertAlive();
		for (let a = 0; a < 24; a += 1) this.encodeConformerLayer(t, r, a);
	}
	encodeConformerLayer(t, r, a) {
		if (this.assertAlive(), !Number.isSafeInteger(a) || a < 0 || a >= 24) throw new RangeError("Encoder layer index is out of range");
		const n = ou;
		if (this.layerDispatches.length !== 24 * n) throw new Error("Encoder layer boundaries changed");
		const o = a * n, s = o + n;
		for (let i = o; i < s; i += 1) this.layerDispatches[i].encode(t, void 0, r);
	}
	encodeProjector(t, r) {
		this.assertAlive(), this.projectorDispatch.encode(t, void 0, r);
	}
	encode(t, r) {
		const a = ra(r.length), n = this.uploadValidFeatureLengths(r);
		this.encodeSubsampling(t, n, a), this.encodeConformer(t, a), this.encodeProjector(t, a);
	}
	encodeSubmissionChunks(t) {
		const r = ra(t.length), a = this.uploadValidFeatureLengths(t);
		return Zh().map((n) => {
			const o = this.device.createCommandEncoder({ label: n.label });
			switch (n.kind) {
				case "subsampling":
					this.encodeSubsampling(o, a, r);
					break;
				case "conformer-layer":
					this.encodeConformerLayer(o, r, n.layerIndex);
					break;
				case "projector":
					this.encodeProjector(o, r);
					break;
			}
			return o.finish({ label: n.label });
		});
	}
	encodeDiagnosticB1Checkpoints(t, r, a, n = 0) {
		this.assertAlive();
		const o = Jh(this.plan.precision);
		if (!Number.isSafeInteger(n) || n < 0 || n % 4 !== 0) throw new RangeError("Encoder checkpoint destination offset must be a non-negative 4-byte multiple");
		if ((a.usage & GPUBufferUsage.COPY_DST) === 0 || n + o.byteLength > a.size) throw new RangeError("Encoder checkpoint capture does not fit a COPY_DST buffer");
		const s = ra(1), i = this.uploadValidFeatureLengths([r]);
		this.encodeSubsampling(t, i, s), this.copyDiagnosticCheckpoint(t, this.plan.encoderSlots[0], o.checkpoints[0], a, n);
		for (let u = 0; u < 24; u += 1) {
			this.encodeConformerLayer(t, s, u);
			const l = this.plan.layerOutputSlots[u];
			this.copyDiagnosticCheckpoint(t, this.plan.encoderSlots[l], o.checkpoints[u + 1], a, n);
		}
		return this.encodeProjector(t, s), this.copyDiagnosticCheckpoint(t, this.plan.projectedOutput, o.checkpoints.at(-1), a, n), o;
	}
	decoderInput() {
		return this.assertAlive(), {
			encoderProjected: this.plan.projectedOutput,
			encodedLengths: this.plan.encoderLengths,
			batchSize: this.batchSize,
			frames: this.frames
		};
	}
	destroy() {
		if (!this.destroyed) {
			this.destroyed = !0;
			for (const t of this.allDispatches.toReversed()) t.destroy();
			for (const t of this.ownedKernels.toReversed()) t.destroy();
			this.arena.destroy();
		}
	}
	assertAlive() {
		if (this.destroyed) throw new Error("Parakeet encoder graph was destroyed");
	}
	copyDiagnosticCheckpoint(t, r, a, n, o) {
		t.copyBufferToBuffer(this.arena.bufferFor(r), r.byteOffset, n, o + a.byteOffset, a.byteLength);
	}
};
function nf(e, t, r, a, n, o) {
	const s = `encoder.layers.${a}`, i = Kh(t, n), u = i.input, l = i.alternate, c = i.postFeedForward1, d = i.moduleScratch, h = i.outputSlot, f = t.rows, p = i.feedForwardTemporary, _ = Tt, b = [
		Ft(e, r.layerNorm, `${s}.norm_feed_forward1`, u, l, f),
		r.gemm.createDispatch({
			label: `${s}-feed-forward1-linear1`,
			a: l,
			...Re(e, `${s}.feed_forward1.linear1.weight`, R, _, o),
			output: p,
			rows: f,
			inner: R,
			columns: _,
			activation: "silu"
		}),
		r.gemm.createDispatch({
			label: `${s}-feed-forward1-linear2-residual`,
			a: p,
			...Re(e, `${s}.feed_forward1.linear2.weight`, _, R, o),
			output: l,
			residual: u,
			residualScale: .5,
			rows: f,
			inner: _,
			columns: R
		})
	];
	b.push(Ft(e, r.layerNorm, `${s}.norm_self_att`, c, d, f), r.gemm.createDispatch({
		label: `${s}-self-attention-qkv`,
		a: d,
		...Re(e, `${s}.self_attn.qkv.weight`, R, ss, o),
		output: i.attentionQkv,
		rows: f,
		inner: R,
		columns: ss
	}), r.attention.createDispatch({
		label: `${s}-relative-attention`,
		qkv: i.attentionQkv,
		projectedPositions: He(e, `${s}.self_attn.projected_positions`, {
			dtype: fa(o),
			logicalShape: [us, R],
			storageShape: [
				8,
				32,
				us,
				4
			],
			layout: "head-vector-position-vec4"
		}),
		biasU: He(e, `${s}.self_attn.bias_u`, {
			dtype: "float32",
			logicalShape: [8, 128],
			storageShape: [8, 128],
			layout: "head-by-channel"
		}),
		biasV: He(e, `${s}.self_attn.bias_v`, {
			dtype: "float32",
			logicalShape: [8, 128],
			storageShape: [8, 128],
			layout: "head-by-channel"
		}),
		validLengths: t.encoderLengths,
		output: i.attentionContext,
		batchSize: t.batchSize,
		frames: 188
	}), r.gemm.createDispatch({
		label: `${s}-self-attention-output-residual`,
		a: i.attentionContext,
		...Re(e, `${s}.self_attn.o_proj.weight`, R, R, o),
		output: d,
		residual: c,
		rows: f,
		inner: R,
		columns: R
	})), b.push(Ft(e, r.layerNorm, `${s}.norm_conv`, d, c, f), r.gemm.createDispatch({
		label: `${s}-convolution-pointwise1`,
		a: c,
		...Re(e, `${s}.conv.pointwise_conv1.weight`, R, is, o),
		output: i.convolutionPointwise,
		rows: f,
		inner: R,
		columns: is
	}), r.conformerConv.createDispatch({
		label: `${s}-convolution-glu-depthwise-bn-silu`,
		pointwiseInput: i.convolutionPointwise,
		depthwiseWeights: He(e, `${s}.conv.depthwise_conv.weight`, {
			dtype: fa(o),
			logicalShape: [9, R],
			storageShape: [
				9,
				R / 4,
				4
			],
			layout: "kernel-channel-vec4"
		}),
		batchNormScale: da(e, `${s}.conv.norm.scale`),
		batchNormShift: da(e, `${s}.conv.norm.shift`),
		validLengths: t.encoderLengths,
		output: i.convolutionOutput,
		batchSize: t.batchSize,
		frames: 188
	}), r.gemm.createDispatch({
		label: `${s}-convolution-pointwise2-residual`,
		a: i.convolutionOutput,
		...Re(e, `${s}.conv.pointwise_conv2.weight`, R, R, o),
		output: c,
		residual: d,
		rows: f,
		inner: R,
		columns: R
	})), b.push(Ft(e, r.layerNorm, `${s}.norm_feed_forward2`, c, d, f), r.gemm.createDispatch({
		label: `${s}-feed-forward2-linear1`,
		a: d,
		...Re(e, `${s}.feed_forward2.linear1.weight`, R, _, o),
		output: p,
		rows: f,
		inner: R,
		columns: _,
		activation: "silu"
	}), r.gemm.createDispatch({
		label: `${s}-feed-forward2-linear2-residual`,
		a: p,
		...Re(e, `${s}.feed_forward2.linear2.weight`, _, R, o),
		output: d,
		residual: c,
		residualScale: .5,
		rows: f,
		inner: _,
		columns: R
	}), Ft(e, r.layerNorm, `${s}.norm_out`, d, c, f)), b.push(Ft(e, r.layerNorm, `${s}.adapter.norm`, c, d, f), r.gemm.createDispatch({
		label: `${s}-adapter-down`,
		a: d,
		...Re(e, `${s}.adapter.down.weight`, R, ta, o),
		output: p,
		rows: f,
		inner: R,
		columns: ta,
		activation: "silu"
	}), r.gemm.createDispatch({
		label: `${s}-adapter-up`,
		a: p,
		...Re(e, `${s}.adapter.up.weight`, ta, R, o),
		output: d,
		rows: f,
		inner: ta,
		columns: R
	}), r.adapterResidual.createDispatch({
		label: `${s}-adapter-residual`,
		source: d,
		accumulator: c,
		rows: f,
		channels: R
	}));
	const w = Yh();
	if (b.length !== w.logicalDispatches) throw new Error(`Internal encoder layer ${a} dispatch structure mismatch`);
	return {
		dispatches: b,
		outputSlot: h
	};
}
function of(e, t, r, a, n, o, s) {
	const i = fa(s), u = s.precision === "fp16" ? {
		flatten: Nh,
		pointwise3: iu,
		pointwise6: uu
	} : {
		flatten: Uh,
		pointwise3: cu,
		pointwise6: du
	}, l = He(e, "encoder.subsampling.layers.0.weight", {
		dtype: i,
		logicalShape: [
			3,
			3,
			256
		],
		storageShape: [
			3,
			3,
			256 / 4,
			4
		],
		layout: "kh-kw-output-channel-vec4"
	}), c = Ut(e, "encoder.subsampling.layers.0.bias", 256), d = He(e, "encoder.subsampling.layers.2.weight", {
		dtype: i,
		logicalShape: [
			3,
			3,
			256
		],
		storageShape: [
			3,
			3,
			256 / 4,
			4
		],
		layout: "kh-kw-channel-vec4"
	}), h = Ut(e, "encoder.subsampling.layers.2.bias", 256), f = Re(e, "encoder.subsampling.layers.3.weight", 256, 256, s), p = Ut(e, "encoder.subsampling.layers.3.bias", 256), _ = He(e, "encoder.subsampling.layers.5.weight", {
		dtype: i,
		logicalShape: [
			3,
			3,
			256
		],
		storageShape: [
			3,
			3,
			256 / 4,
			4
		],
		layout: "kh-kw-channel-vec4"
	}), b = Ut(e, "encoder.subsampling.layers.5.bias", 256), w = Re(e, "encoder.subsampling.layers.6.weight", 256, 256, s), g = Ut(e, "encoder.subsampling.layers.6.bias", 256), y = Re(e, "encoder.subsampling.linear.weight", Tr, R, s), B = Ut(e, "encoder.subsampling.linear.bias", R), P = [], x = [], A = (T) => (x.push(T), T);
	try {
		const T = o.createPreparedPaletteWeight({
			label: "subsampling-flatten-project-shared",
			a: t.subsampling.projected188,
			...y,
			bias: B,
			output: t.microbatches[0].output,
			rows: 188,
			inner: Tr,
			columns: R
		}, u.flatten);
		P.push(T);
		const L = o.createPreparedPaletteWeight({
			label: "subsampling-pointwise3-shared",
			a: t.subsampling.stage376,
			...f,
			bias: p,
			output: t.subsampling.projected376,
			rows: Rr * Br,
			inner: 256,
			columns: 256,
			activation: "relu"
		}, u.pointwise3);
		P.push(L);
		const ae = o.createPreparedPaletteWeight({
			label: "subsampling-pointwise6-shared",
			a: t.subsampling.stage188,
			...w,
			bias: g,
			output: t.subsampling.projected188,
			rows: Ar * Qt,
			inner: 256,
			columns: 256,
			activation: "relu"
		}, u.pointwise6);
		return P.push(ae), {
			preparedWeights: P,
			commands: t.microbatches.map((H) => {
				const W = H.batchSize, v = `batch-${H.batchOffset}-size-${H.batchSize}`, V = 128 * tt * wa, de = N(`fbank-feature-major-batch-${H.batchOffset}`, t.featureInput.byteOffset + H.batchOffset * V, W * V, t.featureInput.bufferIndex ?? 0), _e = [
					A(r.createDispatch({
						label: `subsampling-fused-conv0-depthwise2-${v}`,
						input: de,
						conv0Weights: l,
						conv0Bias: c,
						depthwiseWeights: d,
						depthwiseBias: h,
						output: t.subsampling.stage376,
						validLengths: t.featureLengths,
						validLengthBatchOffset: H.batchOffset,
						batchSize: W,
						inputHeight: tt,
						inputWidth: 128,
						channels: 256
					})),
					A(o.createDispatch({
						label: `subsampling-pointwise3-${v}`,
						a: t.subsampling.stage376,
						...f,
						bias: p,
						output: t.subsampling.projected376,
						rows: W * Rr * Br,
						inner: 256,
						columns: 256,
						activation: "relu",
						preparedPaletteWeight: L
					})),
					A(a.createDispatch({
						label: `subsampling-depthwise5-${v}`,
						input: t.subsampling.projected376,
						weights: _,
						bias: b,
						output: t.subsampling.stage188,
						validLengths: t.featureLengths,
						validLengthBatchOffset: H.batchOffset,
						validLengthSubsamplingSteps: 3,
						batchSize: W,
						inputHeight: Rr,
						inputWidth: Br,
						channels: 256
					})),
					A(o.createDispatch({
						label: `subsampling-pointwise6-${v}`,
						a: t.subsampling.stage188,
						...w,
						bias: g,
						output: t.subsampling.projected188,
						rows: W * Ar * Qt,
						inner: 256,
						columns: 256,
						activation: "relu",
						preparedPaletteWeight: ae
					}))
				], q = A(n.createDispatch({
					label: `subsampling-pointwise6-mask-${v}`,
					values: t.subsampling.projected188,
					validLengths: t.featureLengths,
					batchSize: W,
					height: Ar,
					width: Qt,
					channels: 256,
					validLengthBatchOffset: H.batchOffset,
					validLengthSubsamplingSteps: 3
				})), F = [A(o.createDispatch({
					label: `subsampling-flatten-project-${v}`,
					a: t.subsampling.projected188,
					...y,
					bias: B,
					output: H.output,
					rows: W * 188,
					inner: Tr,
					columns: R,
					preparedPaletteWeight: T
				}))], we = ef();
				if (_e.length + F.length !== we.unconditionalPerMicrobatch) throw new Error("Internal subsampling dispatch structure mismatch");
				return {
					batchOffset: H.batchOffset,
					batchSize: W,
					beforeFinalMaskDispatches: _e,
					finalMaskDispatch: q,
					afterFinalMaskDispatches: F
				};
			})
		};
	} catch (T) {
		for (const L of x.toReversed()) L.destroy();
		for (const L of P.toReversed()) L.preparation.destroy();
		throw T;
	}
}
function Ft(e, t, r, a, n, o) {
	return t.createDispatch({
		label: r,
		input: a,
		output: n,
		gamma: da(e, `${r}.weight`),
		beta: da(e, `${r}.bias`),
		rows: o,
		channels: R,
		epsilon: qh
	});
}
function Re(e, t, r, a, n) {
	const o = t.endsWith(".self_attn.o_proj.weight") ? 6 : 5, s = o === 5 ? 32 : 16, i = o === 5 ? 5 : 3, u = ve([r, a], `${t} palette scalar count`) / s;
	if (!Number.isSafeInteger(u)) throw new Error(`${t} is not palette packing aligned`);
	const l = e.tensor(t), c = {
		dtype: "uint32",
		logicalShape: [r, a],
		storageShape: [u, i],
		layout: `k-by-output-row-major-palette${o}-lsb-u32`
	};
	ha(t, l.sourceRecord, c, "source"), ha(t, l.runtimeRecord, c, "runtime");
	const d = t.endsWith(".self_attn.qkv.weight") ? 3 : 1, h = 1 << o;
	return {
		b: l,
		bPalette: He(e, `${t}.palette`, {
			dtype: fa(n),
			logicalShape: [d, h],
			storageShape: [d, h],
			layout: "output-group-by-palette-lut"
		}),
		paletteGroupColumns: a / d
	};
}
function da(e, t) {
	return He(e, t, {
		dtype: "float32",
		logicalShape: [R],
		storageShape: [R],
		layout: "channel"
	});
}
function Ut(e, t, r) {
	return He(e, t, {
		dtype: "float32",
		logicalShape: [r],
		storageShape: [r],
		layout: "output-channel"
	});
}
function He(e, t, r) {
	const a = e.tensor(t);
	return ha(t, a.sourceRecord, r, "source"), ha(t, a.runtimeRecord, r, "runtime"), a;
}
function ha(e, t, r, a) {
	const n = ve(r.storageShape, `${e} storage elements`) * (r.dtype === "float16" ? Uint16Array.BYTES_PER_ELEMENT : r.dtype === "float32" ? Float32Array.BYTES_PER_ELEMENT : Uint32Array.BYTES_PER_ELEMENT);
	if (t.dtype !== r.dtype || t.layout !== r.layout || t.byteLength !== n || !ls(t.logicalShape, r.logicalShape) || !ls(t.storageShape, r.storageShape)) throw new Error(`${e} ${a} must be ${r.dtype} ${r.layout}, logical [${r.logicalShape.join(",")}], storage [${r.storageShape.join(",")}]`);
}
function sf(e, t) {
	if (e.precision !== t.precision) throw new Error(`Parakeet ${t.precision} encoder cannot use ${e.precision} model weights`);
	const r = e.manifest.config, a = {
		featureBins: 128,
		encoderLayers: 24,
		encoderHiddenSize: R,
		attentionHeads: 8,
		attentionHeadSize: 128,
		convolutionKernelSize: 9,
		decoderHiddenSize: 640,
		subsamplingFactor: 8
	};
	for (const [o, s] of Object.entries(a)) if (r[o] !== s) throw new Error(`Unsupported Parakeet encoder config ${o}=${String(r[o])}`);
	if (r.encoderAdapter !== "medical-1d-r128") throw new Error(`Unsupported encoder adapter ${String(r.encoderAdapter)} — this runtime build requires the OmiMed medical-1d-r128 package`);
	const n = t.precision === "fp16" ? Ms : Cs;
	if (!(r.encoderWeightFormat === n && r.intermediateSize === Tt)) throw new Error("Unsupported Parakeet fixed encoder package contract");
}
function fa(e) {
	return e.precision === "fp16" ? "float16" : "float32";
}
function pa(e, t, r, a) {
	return ve([
		e,
		t,
		r,
		a
	], "activation bytes");
}
function N(e, t, r, a = 0) {
	if (!Number.isSafeInteger(a) || a < 0 || t % St !== 0 || r <= 0 || r % 4 !== 0) throw new RangeError(`Invalid planned arena slice ${e}`);
	return a === 0 ? {
		label: e,
		byteOffset: t,
		byteLength: r
	} : {
		label: e,
		bufferIndex: a,
		byteOffset: t,
		byteLength: r
	};
}
function gt(e) {
	return yt(e.byteOffset + e.byteLength, St);
}
function ve(e, t) {
	const r = e.reduce((a, n) => a * n, 1);
	if (!Number.isSafeInteger(r) || r <= 0) throw new RangeError(`${t} exceeds the safe integer range`);
	return r;
}
function Cn(e, t) {
	if (!Number.isSafeInteger(e) || e <= 0) throw new RangeError(`${t} must be a positive integer`);
}
function ls(e, t) {
	return e.length === t.length && e.every((r, a) => r === t[a]);
}
const $ = 640, et = $ * 4, _a = $ * 2, _u = 1025, Xe = 1024, rr = 1032, G = 256, Jt = 32, bt = G / Jt, mu = et / 4, re = Math.floor(mu / G), Fr = mu - re * G, rt = Math.floor(_u / 4 / G), gu = 5, bu = 32, uf = bu * 4;
const lf = 25808, cf = 29776;
function wu(e) {
	if (!Number.isSafeInteger(e) || e <= 0) throw new RangeError("TDT decoder batchSize must be a positive integer");
	return {
		workgroupCount: Math.ceil(e / 2),
		predictorScratchByteLength: e * gu * $ * 4
	};
}
var df = class {
	label;
	device;
	pipeline;
	bindGroup;
	uniformBuffer;
	batchCapacity;
	destroyed = !1;
	activeBatchSize;
	constructor(e, t, r, a, n, o) {
		this.label = e, this.device = t, this.pipeline = r, this.bindGroup = a, this.uniformBuffer = n, this.batchCapacity = o, this.activeBatchSize = o;
	}
	encode(e, t, r = this.batchCapacity) {
		if (this.destroyed) throw new Error(`${this.label} was destroyed`);
		if (!Number.isSafeInteger(r) || r <= 0 || r > this.batchCapacity) throw new RangeError(`${this.label} active batch must be in [1, ${this.batchCapacity}]`);
		r !== this.activeBatchSize && (this.device.queue.writeBuffer(this.uniformBuffer, 0, new Uint32Array([r])), this.activeBatchSize = r);
		const a = e.beginComputePass(t === void 0 ? { label: this.label } : {
			label: this.label,
			timestampWrites: t
		});
		a.setPipeline(this.pipeline), a.setBindGroup(0, this.bindGroup), a.dispatchWorkgroups(wu(r).workgroupCount, 1, 1), a.end();
	}
	destroy() {
		this.destroyed || (this.destroyed = !0, this.uniformBuffer.destroy());
	}
}, hf = class yu {
	device;
	arena;
	decoderWeights;
	pipeline;
	layout;
	weights;
	executionProfile;
	constructor(t, r, a, n, o, s, i) {
		this.device = t, this.arena = r, this.decoderWeights = a, this.pipeline = n, this.layout = o, this.weights = s, this.executionProfile = i;
	}
	static async create(t, r, a, n = J) {
		if (t.limits.maxComputeInvocationsPerWorkgroup < G) throw new Error(`TDT decoder requires ${G} workgroup lanes`);
		const o = n.kernelBackend === "portable" ? cf : lf;
		if (t.limits.maxComputeWorkgroupStorageSize < o) throw new Error(`TDT decoder requires ${o} bytes of workgroup storage`);
		if (n.kernelBackend === "subgroups" && !t.features.has("subgroups")) throw new Error("TDT decoder requires WebGPU subgroups");
		if (n.precision === "fp16" && !t.features.has("shader-f16")) throw new Error("TDT decoder requires WebGPU shader-f16");
		if (a.precision !== n.precision) throw new Error(`TDT decoder ${n.precision} profile cannot use ${a.precision} decoder weights`);
		const s = ff(a, n), i = n.kernelBackend === "portable" ? n.precision === "fp16" ? "parakeet-persistent-tdt-decoder-portable" : "parakeet-persistent-tdt-decoder-fp32-portable" : n.precision === "fp16" ? "parakeet-persistent-tdt-decoder" : "parakeet-persistent-tdt-decoder-fp32", u = t.createBindGroupLayout({
			label: "parakeet-tdt-decoder-bindings",
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.COMPUTE,
					buffer: { type: "read-only-storage" }
				},
				{
					binding: 1,
					visibility: GPUShaderStage.COMPUTE,
					buffer: { type: "storage" }
				},
				{
					binding: 2,
					visibility: GPUShaderStage.COMPUTE,
					buffer: { type: "uniform" }
				},
				{
					binding: 3,
					visibility: GPUShaderStage.COMPUTE,
					buffer: { type: "read-only-storage" }
				}
			]
		}), l = t.createShaderModule({
			label: i,
			code: Mf(n)
		}), c = (await l.getCompilationInfo()).messages.filter((h) => h.type === "error");
		if (c.length > 0) throw new Error(`TDT decoder WGSL failed: ${c.map((h) => h.message).join("; ")}`);
		const d = await t.createComputePipelineAsync({
			label: i,
			layout: t.createPipelineLayout({ bindGroupLayouts: [u] }),
			compute: {
				module: l,
				entryPoint: "main"
			}
		});
		return new yu(t, r, s.buffer, d, u, s.offsets, n);
	}
	createDispatch(t) {
		_f(t, this.executionProfile);
		const r = new Uint32Array(bu);
		r[0] = t.batchSize, r[1] = t.frames, r[2] = t.maxTokens, r[3] = Me(t.encoderProjected), r[4] = Me(t.encodedLengths), r[5] = Me(t.state), r[6] = Me(t.tokens), r[7] = Me(t.tokenFrames), r[8] = Me(t.tokenDurations), r[9] = Me(t.metadata), r[10] = Me(t.metadata) + t.batchSize, r[11] = this.weights.embedding, r[12] = this.weights.lstm0, r[13] = this.weights.lstmBias0, r[14] = this.weights.lstm1, r[15] = this.weights.lstmBias1, r[16] = this.weights.decoderProjector, r[17] = this.weights.decoderProjectorBias, r[18] = this.weights.head, r[19] = this.weights.headBias, r[20] = Me(t.predictorScratch), r[21] = Me(t.decodeStarts), r[22] = Me(t.decodeEnds), r[23] = Me(t.flushFinals);
		const a = t.label ?? "parakeet-persistent-tdt-decode", n = this.device.createBuffer({
			label: `${a}-params`,
			size: uf,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});
		this.device.queue.writeBuffer(n, 0, r);
		const o = pf(this.arena, t), s = this.device.createBindGroup({
			label: `${a}-bindings`,
			layout: this.layout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.decoderWeights,
						offset: 0,
						size: this.decoderWeights.size
					}
				},
				{
					binding: 1,
					resource: {
						buffer: o.buffer,
						offset: 0,
						size: o.byteLength
					}
				},
				{
					binding: 2,
					resource: { buffer: n }
				},
				{
					binding: 3,
					resource: {
						buffer: this.decoderWeights,
						offset: 0,
						size: this.decoderWeights.size
					}
				}
			]
		});
		return new df(a, this.device, this.pipeline, s, n, t.batchSize);
	}
};
function ff(e, t) {
	const r = t.precision === "fp16" ? "float16" : "float32", a = st(e.tensor("decoder.embedding.weight"), r, [_u, $], "token-by-channel-row-major"), n = st(e.tensor("decoder.lstm.weight_l0"), r, [_a, et], "input-hidden-k-by-ifgo-row-major-vec4"), o = st(e.tensor("decoder.lstm.weight_l1"), r, [_a, et], "input-hidden-k-by-ifgo-row-major-vec4"), s = st(e.tensor("decoder.decoder_projector.weight"), r, [$, $], "k-by-output-row-major-vec4"), i = st(e.tensor("joint.head.weight"), r, [$, rr], "k-by-output-row-major-vec4"), u = {
		embedding: a,
		lstm0: n,
		lstmBias0: st(e.tensor("decoder.lstm.bias_l0"), "float32", [et], "ifgo-gates"),
		lstm1: o,
		lstmBias1: st(e.tensor("decoder.lstm.bias_l1"), "float32", [et], "ifgo-gates"),
		decoderProjector: s,
		decoderProjectorBias: st(e.tensor("decoder.decoder_projector.bias"), "float32", [$], "output-channel"),
		head: i,
		headBias: st(e.tensor("joint.head.bias"), "float32", [rr], "output-channel-padded-vec4")
	}, l = a.buffer;
	for (const c of Object.values(u)) if (c.sourceRecord.shard !== "decoder.bin" || c.runtimeRecord.bufferId !== "source-shard-decoder.bin" || c.buffer !== l) throw new Error("Persistent TDT decoder requires one resident decoder source shard");
	return {
		buffer: l,
		offsets: Object.fromEntries(Object.entries(u).map(([c, d]) => [c, d.runtimeRecord.byteOffset / 4]))
	};
}
function st(e, t, r, a) {
	const n = e.sourceRecord, o = e.runtimeRecord;
	if (n.dtype !== t || n.storageShape.join(",") !== r.join(",") || n.layout !== a || o.dtype !== t || o.storageShape.join(",") !== r.join(",") || o.layout !== a || o.byteLength !== n.byteLength || o.byteOffset % 4 !== 0) throw new Error(`Unexpected decoder tensor ${n.layout} [${n.storageShape.join(",")}]`);
	return e;
}
function pf(e, t) {
	const r = [
		t.encoderProjected,
		t.encodedLengths,
		t.decodeStarts,
		t.decodeEnds,
		t.flushFinals,
		t.state,
		t.predictorScratch,
		t.tokens,
		t.tokenFrames,
		t.tokenDurations,
		t.metadata
	], a = e.bufferFor(r[0]);
	for (const n of r.slice(1)) if (e.bufferFor(n) !== a) throw new Error("TDT decoder slices must share one physical arena buffer");
	return {
		buffer: a,
		byteLength: e.bufferByteLengthFor(r[0])
	};
}
function _f(e, t) {
	for (const [a, n] of [
		["batchSize", e.batchSize],
		["frames", e.frames],
		["maxTokens", e.maxTokens]
	]) if (!Number.isSafeInteger(n) || n <= 0) throw new RangeError(`Invalid TDT decoder ${a}`);
	De(e.encoderProjected, e.batchSize * e.frames * $ * (t.precision === "fp16" ? 2 : 4)), De(e.encodedLengths, e.batchSize * 4), De(e.decodeStarts, e.batchSize * 4), De(e.decodeEnds, e.batchSize * 4), De(e.flushFinals, e.batchSize * 4), De(e.state, e.batchSize * 4 * $ * 4), De(e.predictorScratch, wu(e.batchSize).predictorScratchByteLength);
	const r = e.batchSize * e.maxTokens * 4;
	De(e.tokens, r), De(e.tokenFrames, r), De(e.tokenDurations, r), De(e.metadata, e.batchSize * 2 * 4);
}
function De(e, t) {
	if (e.byteLength < t) throw new RangeError(`${e.label} is too small for TDT decoding`);
}
function Me(e) {
	if (e.byteOffset % 4 !== 0) throw new RangeError(`${e.label} is not word aligned`);
	return e.byteOffset / 4;
}
function mf(e, t) {
	const r = Array.from({ length: re }, (a, n) => `      var ${e}${n} = vec4<f16>(read_weight_f32x4(${t}, (lane + ${n * G}u) * 4u));
      var ${e}${n}_odd = vec4<f16>(0.0);`);
	return r.push(`      var ${e}${re} = vec4<f16>(0.0);
      var ${e}${re}_odd = vec4<f16>(0.0);
      if (lane < ${Fr}u) {
        ${e}${re} = vec4<f16>(
          read_weight_f32x4(
            ${t},
            (lane + ${re * G}u) * 4u
          )
        );
      }`), r.join(`
`);
}
function gf(e, t) {
	const r = Array.from({ length: re }, (a, n) => `      var ${e}${n} = read_weight_f32x4(${t}, (lane + ${n * G}u) * 4u);
      var ${e}${n}_odd = vec4<f32>(0.0);`);
	return r.push(`      var ${e}${re} = vec4<f32>(0.0);
      var ${e}${re}_odd = vec4<f32>(0.0);
      if (lane < ${Fr}u) {
        ${e}${re} = read_weight_f32x4(
          ${t},
          (lane + ${re * G}u) * 4u
        );
      }`), r.join(`
`);
}
function bf(e, t, r, a, n) {
	const o = Array.from({ length: re }, (s, i) => `        ${e}${i}${n} = fma(vec4<f16>(f16(${r})), read_weight_vec4_f16(${t}, ${a} * ${et}u + (lane + ${i * G}u) * 4u), ${e}${i}${n});`);
	return o.push(`        if (lane < ${Fr}u) {
          ${e}${re}${n} = fma(
            vec4<f16>(f16(${r})),
            read_weight_vec4_f16(
              ${t},
              ${a} * ${et}u +
                (lane + ${re * G}u) * 4u
            ),
            ${e}${re}${n}
          );
        }`), o.join(`
`);
}
function wf(e, t, r, a, n) {
	const o = Array.from({ length: re }, (s, i) => `        ${e}${i}${n} = fma(vec4<f32>(${r}), read_weight_vec4(${t}, ${a} * ${et}u + (lane + ${i * G}u) * 4u), ${e}${i}${n});`);
	return o.push(`        if (lane < ${Fr}u) {
          ${e}${re}${n} = fma(
            vec4<f32>(${r}),
            read_weight_vec4(
              ${t},
              ${a} * ${et}u +
                (lane + ${re * G}u) * 4u
            ),
            ${e}${re}${n}
          );
        }`), o.join(`
`);
}
function cs(e) {
	const t = [];
	for (let r = 0; r < re; r += 1) for (let a = 0; a < 4; a += 1) t.push(`      gate_values[(lane + ${r * G}u) * 4u + ${a}u] = f32((${e}${r} + ${e}${r}_odd)[${a}u]);`);
	t.push(`      if (lane < ${Fr}u) {`);
	for (let r = 0; r < 4; r += 1) t.push(`        gate_values[(lane + ${re * G}u) * 4u + ${r}u] = f32((${e}${re} + ${e}${re}_odd)[${r}u]);`);
	return t.push("      }"), t.join(`
`);
}
function yf() {
	return Array.from({ length: rt }, (e, t) => `  let head_bias${t} = vec4<f16>(read_weight_f32x4(
    params.head_bias_offset,
    (lane + ${t * G}u) * 4u
  ));
  var head_a${t} = head_bias${t};
  var head_b${t} = head_bias${t};`).join(`
`);
}
function Ef() {
	return Array.from({ length: rt }, (e, t) => t).map((e) => `    let head_bias${e} = read_weight_f32x4(
      params.head_bias_offset,
      (lane + ${e * G}u) * 4u
    );
    var head_a${e} = head_bias${e};
    var head_b${e} = head_bias${e};`).join(`
`);
}
function Sf() {
	return Array.from({ length: rt }, (e, t) => `      let head_weight${t} = read_weight_vec4_f16(
        params.head_offset,
        k * ${rr}u +
          (lane + ${t * G}u) * 4u
      );
      if (!skip_a) {
        head_a${t} = fma(
          vec4<f16>(f16(input_a)),
          head_weight${t},
          head_a${t}
        );
      }
      if (!skip_b) {
        head_b${t} = fma(
          vec4<f16>(f16(input_b)),
          head_weight${t},
          head_b${t}
        );
      }`).join(`
`);
}
function vf() {
	return Array.from({ length: rt }, (e, t) => t).map((e) => `        let head_weight${e} = read_weight_vec4(
          params.head_offset,
          k * ${rr}u +
            (lane + ${e * G}u) * 4u
        );
        if (!skip_a) {
          head_a${e} = fma(
            vec4<f32>(input_a),
            head_weight${e},
            head_a${e}
          );
        }
        if (!skip_b) {
          head_b${e} = fma(
            vec4<f32>(input_b),
            head_weight${e},
            head_b${e}
          );
        }`).join(`
`);
}
function kf(e) {
	const t = [];
	for (let r = 0; r < rt; r += 1) for (let a = 0; a < 4; a += 1) t.push(`  {
    let output = (lane + ${r * G}u) * 4u + ${a}u;
    let score = sanitize_score(f32(head_${e}${r}[${a}u]));
    if (choose_better(
      local_token_value_${e},
      local_token_id_${e},
      score,
      output
    )) {
      local_token_value_${e} = score;
      local_token_id_${e} = output;
    }
  }`);
	return t.join(`
`);
}
function ds(e) {
	const t = e === "a" ? 0 : 1;
	return `
  var local_token_value_${e} = -3.402823466e+38;
  var local_token_id_${e} = 0xffffffffu;
  var local_duration_value_${e} = -3.402823466e+38;
  var local_duration_id_${e} = 0xffffffffu;
${kf(e)}
  if (lane == 0u) {
    let blank_score = sanitize_score(f32(tail_${e}[0u]));
    if (choose_better(
      local_token_value_${e},
      local_token_id_${e},
      blank_score,
      ${Xe}u
    )) {
      local_token_value_${e} = blank_score;
      local_token_id_${e} = ${Xe}u;
    }
    for (var component = 1u; component < 4u; component += 1u) {
      let duration = component - 1u;
      let score = sanitize_score(f32(tail_${e}[component]));
      if (choose_better(
        local_duration_value_${e},
        local_duration_id_${e},
        score,
        duration
      )) {
        local_duration_value_${e} = score;
        local_duration_id_${e} = duration;
      }
    }
  } else if (lane == 1u) {
    for (var component = 0u; component < 2u; component += 1u) {
      let duration = component + 3u;
      let score = sanitize_score(f32(tail_${e}[component]));
      if (choose_better(
        local_duration_value_${e},
        local_duration_id_${e},
        score,
        duration
      )) {
        local_duration_value_${e} = score;
        local_duration_id_${e} = duration;
      }
    }
  }
  reduce_joint_result(
    ${t}u,
    lane,
    subgroup_lane,
    subgroup_slot,
    local_token_value_${e},
    local_token_id_${e},
    local_duration_value_${e},
    local_duration_id_${e}
  );`;
}
function hs(e) {
	const t = [];
	for (let r = 0; r < rt; r += 1) for (let a = 0; a < 4; a += 1) t.push(`    {
      let output = (lane + ${r * G}u) * 4u + ${a}u;
      let score = sanitize_score(f32(head_${e}${r}[${a}u]));
      if (choose_better(
        local_token_value_${e},
        local_token_id_${e},
        score,
        output
      )) {
        local_token_value_${e} = score;
        local_token_id_${e} = output;
      }
    }`);
	return t.join(`
`);
}
function Pf() {
	return `  {
    // V2's complete 1024-token block and joint tail share one increasing-K pass.
${Ef()}
    var zero_skip_safe_a = true;
    var zero_skip_safe_b = true;
    for (var k = 0u; k < ${$}u; k += 1u) {
      let input_a = joint_input_a[k];
      let input_b = joint_input_b[k];
      let input_a_bits = bitcast<u32>(input_a);
      let input_b_bits = bitcast<u32>(input_b);
      let input_a_is_nan =
        (input_a_bits & 0x7fffffffu) > 0x7f800000u;
      let input_b_is_nan =
        (input_b_bits & 0x7fffffffu) > 0x7f800000u;
      let exceptional_a =
        input_a_bits == 0x80000000u || input_a_is_nan;
      let exceptional_b =
        input_b_bits == 0x80000000u || input_b_is_nan;
      zero_skip_safe_a = zero_skip_safe_a && !exceptional_a;
      zero_skip_safe_b = zero_skip_safe_b && !exceptional_b;
      let skip_a = zero_skip_safe_a && input_a_bits == 0u;
      let skip_b = zero_skip_safe_b && input_b_bits == 0u;
      // These shared inputs make the outer branch workgroup-uniform for each k.
      if (!skip_a || !skip_b) {
${vf()}
        if (lane < 2u) {
          let tail_weight = read_weight_vec4(
            params.head_offset,
            k * ${rr}u +
              (lane + ${rt * G}u) * 4u
          );
          if (!skip_a) {
            tail_a = fma(vec4<f32>(input_a), tail_weight, tail_a);
          }
          if (!skip_b) {
            tail_b = fma(vec4<f32>(input_b), tail_weight, tail_b);
          }
        }
      }
    }
${hs("a")}
${hs("b")}
  }`;
}
function fs(e) {
	return `  if (lane == 0u) {
    let blank_score = sanitize_score(f32(tail_${e}[0u]));
    if (choose_better(
      local_token_value_${e},
      local_token_id_${e},
      blank_score,
      ${Xe}u
    )) {
      local_token_value_${e} = blank_score;
      local_token_id_${e} = ${Xe}u;
    }
    for (var component = 1u; component < 4u; component += 1u) {
      let duration = component - 1u;
      let score = sanitize_score(f32(tail_${e}[component]));
      if (choose_better(
        local_duration_value_${e},
        local_duration_id_${e},
        score,
        duration
      )) {
        local_duration_value_${e} = score;
        local_duration_id_${e} = duration;
      }
    }
  } else if (lane == 1u) {
    for (var component = 0u; component < 2u; component += 1u) {
      let duration = component + 3u;
      let score = sanitize_score(f32(tail_${e}[component]));
      if (choose_better(
        local_duration_value_${e},
        local_duration_id_${e},
        score,
        duration
      )) {
        local_duration_value_${e} = score;
        local_duration_id_${e} = duration;
      }
    }
  }
  reduce_joint_result(
    ${e === "a" ? 0 : 1}u,
    lane,
    subgroup_lane,
    subgroup_slot,
    local_token_value_${e},
    local_token_id_${e},
    local_duration_value_${e},
    local_duration_id_${e}
  );`;
}
function $f() {
	return `${yf()}
  var tail_a = vec4<f16>(-65504.0);
  var tail_b = vec4<f16>(-65504.0);
  if (lane < 2u) {
    let tail_bias = vec4<f16>(
      read_weight_f32x4(
        params.head_bias_offset,
        (lane + ${rt * G}u) * 4u
      )
    );
    tail_a = tail_bias;
    tail_b = tail_bias;
  }
  var zero_skip_safe_a = true;
  var zero_skip_safe_b = true;
  for (var k = 0u; k < ${$}u; k += 1u) {
    let input_a = joint_input_a[k];
    let input_b = joint_input_b[k];
    let input_a_bits = bitcast<u32>(input_a);
    let input_b_bits = bitcast<u32>(input_b);
    let input_a_is_nan =
      (input_a_bits & 0x7fffffffu) > 0x7f800000u;
    let input_b_is_nan =
      (input_b_bits & 0x7fffffffu) > 0x7f800000u;
    let exceptional_a =
      input_a_bits == 0x80000000u || input_a_is_nan;
    let exceptional_b =
      input_b_bits == 0x80000000u || input_b_is_nan;
    zero_skip_safe_a = zero_skip_safe_a && !exceptional_a;
    zero_skip_safe_b = zero_skip_safe_b && !exceptional_b;
    let skip_a = zero_skip_safe_a && input_a_bits == 0u;
    let skip_b = zero_skip_safe_b && input_b_bits == 0u;
    // These shared inputs make the outer branch workgroup-uniform for each k.
    if (!skip_a || !skip_b) {
${Sf()}
      if (lane < 2u) {
        let tail_weight = read_weight_vec4_f16(
          params.head_offset,
          k * ${rr}u +
            (lane + ${rt * G}u) * 4u
        );
        if (!skip_a) {
          tail_a = fma(vec4<f16>(f16(input_a)), tail_weight, tail_a);
        }
        if (!skip_b) {
          tail_b = fma(vec4<f16>(f16(input_b)), tail_weight, tail_b);
        }
      }
    }
  }

${ds("a")}
${ds("b")}`;
}
function Rf() {
	return `  var local_token_value_a = -3.402823466e+38;
  var local_token_id_a = 0xffffffffu;
  var local_duration_value_a = -3.402823466e+38;
  var local_duration_id_a = 0xffffffffu;
  var local_token_value_b = -3.402823466e+38;
  var local_token_id_b = 0xffffffffu;
  var local_duration_value_b = -3.402823466e+38;
  var local_duration_id_b = 0xffffffffu;

  var tail_a = vec4<f32>(-3.402823466e+38);
  var tail_b = vec4<f32>(-3.402823466e+38);
  if (lane < 2u) {
    let tail_bias = vec4<f32>(
      read_weight_f32x4(
        params.head_bias_offset,
        (lane + ${rt * G}u) * 4u
      )
    );
    tail_a = tail_bias;
    tail_b = tail_bias;
  }
${Pf()}
${fs("a")}
${fs("b")}`;
}
function Bf() {
	return `fn read_weight_f16(base_word: u32, element: u32) -> f32 {
  let pair = weight_pairs[base_word + element / 2u];
  return f32(select(pair.x, pair.y, (element & 1u) != 0u));
}

fn read_weight_vec4(base_word: u32, element: u32) -> vec4<f32> {
  let first = weight_pairs[base_word + element / 2u];
  let second = weight_pairs[base_word + element / 2u + 1u];
  return vec4<f32>(vec2<f32>(first), vec2<f32>(second));
}

fn read_weight_vec4_f16(base_word: u32, element: u32) -> vec4<f16> {
  let first = weight_pairs[base_word + element / 2u];
  let second = weight_pairs[base_word + element / 2u + 1u];
  return vec4<f16>(first, second);
}

fn read_weight_f32(base_word: u32, element: u32) -> f32 {
  return bitcast<f32>(weights[base_word + element]);
}

fn read_weight_f32x4(base_word: u32, element: u32) -> vec4<f32> {
  return vec4<f32>(
    read_weight_f32(base_word, element),
    read_weight_f32(base_word, element + 1u),
    read_weight_f32(base_word, element + 2u),
    read_weight_f32(base_word, element + 3u)
  );
}`;
}
function Af() {
	return `fn read_weight_f32(base_word: u32, element: u32) -> f32 {
  return bitcast<f32>(weights[base_word + element]);
}

fn read_weight_vec4(base_word: u32, element: u32) -> vec4<f32> {
  return weight_vectors[(base_word + element) / 4u];
}

fn read_weight_f32x4(base_word: u32, element: u32) -> vec4<f32> {
  return read_weight_vec4(base_word, element);
}`;
}
function Tf() {
	return `fn read_arena_f16(base_word: u32, element: u32) -> f32 {
  let pair = unpack2x16float(arena[base_word + element / 2u]);
  return select(pair.x, pair.y, (element & 1u) != 0u);
}

fn read_arena_vec4(base_word: u32, element: u32) -> vec4<f32> {
  let first = unpack2x16float(arena[base_word + element / 2u]);
  let second = unpack2x16float(arena[base_word + element / 2u + 1u]);
  return vec4<f32>(first, second);
}`;
}
function Lf() {
	return `fn read_arena_f32(base_word: u32, element: u32) -> f32 {
  return bitcast<f32>(arena[base_word + element]);
}

fn read_arena_vec4(base_word: u32, element: u32) -> vec4<f32> {
  return vec4<f32>(
    read_arena_f32(base_word, element),
    read_arena_f32(base_word, element + 1u),
    read_arena_f32(base_word, element + 2u),
    read_arena_f32(base_word, element + 3u)
  );
}`;
}
function Eu() {
	return vu("fp16");
}
function Su() {
	return vu("fp32");
}
function Mf(e = J) {
	return e.kernelBackend === "portable" ? e.precision === "fp16" ? ps("fp16") : ps("fp32") : e.precision === "fp16" ? Eu() : Su();
}
function vu(e) {
	const t = e === "fp16" ? "enable f16;" : "", r = e === "fp16" ? "@group(0) @binding(3) var<storage, read> weight_pairs: array<vec2<f16>>;" : "@group(0) @binding(3) var<storage, read> weight_vectors: array<vec4<f32>>;", a = e === "fp16" ? Bf() : Af(), n = e === "fp16" ? Tf() : Lf(), o = e === "fp16" ? mf : gf, s = e === "fp16" ? bf : wf, i = e === "fp16" ? $f() : Rf(), u = e === "fp16" ? "read_weight_f16" : "read_weight_f32";
	return `
enable subgroups;
${t}

struct Params {
  batch_size: u32,
  frames: u32,
  max_tokens: u32,
  encoder_offset: u32,
  lengths_offset: u32,
  state_offset: u32,
  tokens_offset: u32,
  token_frames_offset: u32,
  token_durations_offset: u32,
  counts_offset: u32,
  status_offset: u32,
  embedding_offset: u32,
  lstm0_offset: u32,
  lstm_bias0_offset: u32,
  lstm1_offset: u32,
  lstm_bias1_offset: u32,
  decoder_projector_offset: u32,
  decoder_projector_bias_offset: u32,
  head_offset: u32,
  head_bias_offset: u32,
  predictor_scratch_offset: u32,
  decode_starts_offset: u32,
  decode_ends_offset: u32,
  flush_finals_offset: u32,
  _pad3: u32,
  _pad4: u32,
  _pad5: u32,
  _pad6: u32,
  _pad7: u32,
  _pad8: u32,
  _pad9: u32,
  _pad10: u32,
};

@group(0) @binding(0) var<storage, read> weights: array<u32>;
@group(0) @binding(1) var<storage, read_write> arena: array<u32>;
@group(0) @binding(2) var<uniform> params: Params;
${r}

var<workgroup> candidate_h0: array<f32, ${$}>;
var<workgroup> candidate_c0: array<f32, ${$}>;
var<workgroup> candidate_h1: array<f32, ${$}>;
var<workgroup> candidate_c1: array<f32, ${$}>;
var<workgroup> gate_values: array<f32, ${et}>;
var<workgroup> joint_input_a: array<f32, ${$}>;
var<workgroup> joint_input_b: array<f32, ${$}>;
var<workgroup> token_values: array<f32, ${bt}>;
var<workgroup> token_ids: array<u32, ${bt}>;
var<workgroup> duration_values: array<f32, ${bt}>;
var<workgroup> duration_ids: array<u32, ${bt}>;
var<workgroup> decode_time_a: u32;
var<workgroup> decode_time_b: u32;
var<workgroup> output_count_a: u32;
var<workgroup> output_count_b: u32;
var<workgroup> decode_status_a: u32;
var<workgroup> decode_status_b: u32;
var<workgroup> best_token_a: u32;
var<workgroup> best_token_b: u32;
var<workgroup> best_duration_a: u32;
var<workgroup> best_duration_b: u32;
var<workgroup> encoded_length_a: u32;
var<workgroup> encoded_length_b: u32;
var<workgroup> symbols_at_time_a: u32;
var<workgroup> symbols_at_time_b: u32;
var<workgroup> emitted_nonblank_a: u32;
var<workgroup> emitted_nonblank_b: u32;
var<workgroup> flush_blanks_a: u32;
var<workgroup> flush_blanks_b: u32;
var<workgroup> flush_time_a: u32;
var<workgroup> flush_time_b: u32;

${a}

${n}

fn state_index(sequence: u32, slot: u32, channel: u32) -> u32 {
  return params.state_offset +
    sequence * ${4 * $}u +
    slot * ${$}u +
    channel;
}

fn predictor_scratch_index(sequence: u32, slot: u32, channel: u32) -> u32 {
  return params.predictor_scratch_offset +
    sequence * ${gu * $}u +
    slot * ${$}u +
    channel;
}

fn read_state(sequence: u32, slot: u32, channel: u32) -> f32 {
  return bitcast<f32>(arena[state_index(sequence, slot, channel)]);
}

fn read_state_vec4(sequence: u32, slot: u32, channel: u32) -> vec4<f32> {
  return vec4<f32>(
    read_state(sequence, slot, channel),
    read_state(sequence, slot, channel + 1u),
    read_state(sequence, slot, channel + 2u),
    read_state(sequence, slot, channel + 3u)
  );
}

fn read_predictor_scratch_vec4(
  sequence: u32,
  slot: u32,
  channel: u32,
) -> vec4<f32> {
  return vec4<f32>(
    bitcast<f32>(arena[predictor_scratch_index(sequence, slot, channel)]),
    bitcast<f32>(arena[predictor_scratch_index(sequence, slot, channel + 1u)]),
    bitcast<f32>(arena[predictor_scratch_index(sequence, slot, channel + 2u)]),
    bitcast<f32>(arena[predictor_scratch_index(sequence, slot, channel + 3u)])
  );
}

fn sigmoid(value: f32) -> f32 {
  return 1.0 / (1.0 + exp(-clamp(value, -20.0, 20.0)));
}

fn sigmoid_vec4(value: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(1.0) /
    (vec4<f32>(1.0) + exp(-clamp(value, vec4<f32>(-20.0), vec4<f32>(20.0))));
}

fn stable_tanh(value: f32) -> f32 {
  // Metal's fast tanh can produce NaN for large finite cell states instead of
  // saturating. At +/-10 the correctly rounded f32 result is already +/-1.
  return tanh(clamp(value, -10.0, 10.0));
}

fn stable_tanh_vec4(value: vec4<f32>) -> vec4<f32> {
  return tanh(clamp(value, vec4<f32>(-10.0), vec4<f32>(10.0)));
}

fn read_gate_vec4(element: u32) -> vec4<f32> {
  return vec4<f32>(
    gate_values[element],
    gate_values[element + 1u],
    gate_values[element + 2u],
    gate_values[element + 3u]
  );
}

fn sanitize_score(value: f32) -> f32 {
  return select(value, -3.402823466e+38, value != value);
}

fn prepare_predictor(
  sequence: u32,
  token: u32,
  initial: bool,
  lane: u32,
) {
  {
${o("layer0_gate", "params.lstm_bias0_offset")}
    // SOS has exact zero x/h. Its layer-0 matrix product is therefore zero.
    if (!initial) {
      for (var k = 0u; k < ${_a}u; k += 2u) {
        var input_even = 0.0;
        if (k < ${$}u) {
          input_even = ${u}(
            params.embedding_offset,
            token * ${$}u + k
          );
        } else {
          input_even = read_state(sequence, 0u, k - ${$}u);
        }
        let odd_k = k + 1u;
        var input_odd = 0.0;
        if (odd_k < ${$}u) {
          input_odd = ${u}(
            params.embedding_offset,
            token * ${$}u + odd_k
          );
        } else {
          input_odd = read_state(sequence, 0u, odd_k - ${$}u);
        }
${s("layer0_gate", "params.lstm0_offset", "input_even", "k", "")}
${s("layer0_gate", "params.lstm0_offset", "input_odd", "odd_k", "_odd")}
      }
    }
${cs("layer0_gate")}
  }
  workgroupBarrier();

  if (lane < ${$ / 4}u) {
    let channel = lane * 4u;
    let input_gate = sigmoid_vec4(read_gate_vec4(channel));
    let forget_gate = sigmoid_vec4(read_gate_vec4(${$}u + channel));
    let cell_gate = stable_tanh_vec4(
      read_gate_vec4(${$ * 2}u + channel)
    );
    let output_gate = sigmoid_vec4(
      read_gate_vec4(${$ * 3}u + channel)
    );
    let cell = fma(
      forget_gate,
      read_state_vec4(sequence, 1u, channel),
      input_gate * cell_gate
    );
    let hidden = output_gate * stable_tanh_vec4(cell);
    let stable_cell = cell;
    let stable_hidden = hidden;
    candidate_c0[channel] = stable_cell.x;
    candidate_c0[channel + 1u] = stable_cell.y;
    candidate_c0[channel + 2u] = stable_cell.z;
    candidate_c0[channel + 3u] = stable_cell.w;
    candidate_h0[channel] = stable_hidden.x;
    candidate_h0[channel + 1u] = stable_hidden.y;
    candidate_h0[channel + 2u] = stable_hidden.z;
    candidate_h0[channel + 3u] = stable_hidden.w;
  }
  workgroupBarrier();

  {
${o("layer1_gate", "params.lstm_bias1_offset")}
    // Initial recurrent h1 is also exact zero, so only candidate h0 contributes.
    let layer1_input_limit = select(${_a}u, ${$}u, initial);
    for (var k = 0u; k < layer1_input_limit; k += 2u) {
      var input_even = 0.0;
      if (k < ${$}u) {
        input_even = candidate_h0[k];
      } else {
        input_even = read_state(sequence, 2u, k - ${$}u);
      }
      let odd_k = k + 1u;
      var input_odd = 0.0;
      if (odd_k < ${$}u) {
        input_odd = candidate_h0[odd_k];
      } else {
        input_odd = read_state(sequence, 2u, odd_k - ${$}u);
      }
${s("layer1_gate", "params.lstm1_offset", "input_even", "k", "")}
${s("layer1_gate", "params.lstm1_offset", "input_odd", "odd_k", "_odd")}
    }
${cs("layer1_gate")}
  }
  workgroupBarrier();

  if (lane < ${$ / 4}u) {
    let channel = lane * 4u;
    let input_gate = sigmoid_vec4(read_gate_vec4(channel));
    let forget_gate = sigmoid_vec4(read_gate_vec4(${$}u + channel));
    let cell_gate = stable_tanh_vec4(
      read_gate_vec4(${$ * 2}u + channel)
    );
    let output_gate = sigmoid_vec4(
      read_gate_vec4(${$ * 3}u + channel)
    );
    let cell = fma(
      forget_gate,
      read_state_vec4(sequence, 3u, channel),
      input_gate * cell_gate
    );
    let hidden = output_gate * stable_tanh_vec4(cell);
    let stable_cell = cell;
    let stable_hidden = hidden;
    candidate_c1[channel] = stable_cell.x;
    candidate_c1[channel + 1u] = stable_cell.y;
    candidate_c1[channel + 2u] = stable_cell.z;
    candidate_c1[channel + 3u] = stable_cell.w;
    candidate_h1[channel] = stable_hidden.x;
    candidate_h1[channel + 1u] = stable_hidden.y;
    candidate_h1[channel + 2u] = stable_hidden.z;
    candidate_h1[channel + 3u] = stable_hidden.w;
  }
  workgroupBarrier();

  if (lane < ${$ / 4}u) {
    let output = lane * 4u;
    for (var component = 0u; component < 4u; component += 1u) {
      let channel = output + component;
      arena[predictor_scratch_index(sequence, 0u, channel)] =
        bitcast<u32>(candidate_h0[channel]);
      arena[predictor_scratch_index(sequence, 1u, channel)] =
        bitcast<u32>(candidate_c0[channel]);
      arena[predictor_scratch_index(sequence, 2u, channel)] =
        bitcast<u32>(candidate_h1[channel]);
      arena[predictor_scratch_index(sequence, 3u, channel)] =
        bitcast<u32>(candidate_c1[channel]);
    }
    var projection = read_weight_f32x4(
      params.decoder_projector_bias_offset,
      output
    );
    for (var k = 0u; k < ${$}u; k += 1u) {
      projection = fma(
        vec4<f32>(candidate_h1[k]),
        read_weight_vec4(
          params.decoder_projector_offset,
          k * ${$}u + output
        ),
        projection
      );
    }
    arena[predictor_scratch_index(sequence, 4u, output)] =
      bitcast<u32>(projection.x);
    arena[predictor_scratch_index(sequence, 4u, output + 1u)] =
      bitcast<u32>(projection.y);
    arena[predictor_scratch_index(sequence, 4u, output + 2u)] =
      bitcast<u32>(projection.z);
    arena[predictor_scratch_index(sequence, 4u, output + 3u)] =
      bitcast<u32>(projection.w);
  }
  storageBarrier();
  workgroupBarrier();
}

fn commit_predictor(sequence: u32, lane: u32) {
  for (var channel = lane; channel < ${$}u; channel += ${G}u) {
    arena[state_index(sequence, 0u, channel)] =
      arena[predictor_scratch_index(sequence, 0u, channel)];
    arena[state_index(sequence, 1u, channel)] =
      arena[predictor_scratch_index(sequence, 1u, channel)];
    arena[state_index(sequence, 2u, channel)] =
      arena[predictor_scratch_index(sequence, 2u, channel)];
    arena[state_index(sequence, 3u, channel)] =
      arena[predictor_scratch_index(sequence, 3u, channel)];
  }
  storageBarrier();
  workgroupBarrier();
}

fn choose_better(
  left_value: f32,
  left_id: u32,
  right_value: f32,
  right_id: u32,
) -> bool {
  return right_value > left_value ||
    (right_value == left_value && right_id < left_id);
}

fn reduce_joint_result(
  pair_slot: u32,
  lane: u32,
  subgroup_lane: u32,
  subgroup_slot: u32,
  local_token_value: f32,
  local_token_id: u32,
  local_duration_value: f32,
  local_duration_id: u32,
) {
  let subgroup_token_value = subgroupMax(local_token_value);
  let subgroup_token_id = subgroupMin(
    select(
      0xffffffffu,
      local_token_id,
      local_token_value == subgroup_token_value
    )
  );
  let subgroup_duration_value = subgroupMax(local_duration_value);
  let subgroup_duration_id = subgroupMin(
    select(
      0xffffffffu,
      local_duration_id,
      local_duration_value == subgroup_duration_value
    )
  );
  if (subgroup_lane == 0u) {
    token_values[subgroup_slot] = subgroup_token_value;
    token_ids[subgroup_slot] = subgroup_token_id;
    duration_values[subgroup_slot] = subgroup_duration_value;
    duration_ids[subgroup_slot] = subgroup_duration_id;
  }
  workgroupBarrier();

  if (lane == 0u) {
    var token_value = -3.402823466e+38;
    var token_id = 0xffffffffu;
    var duration_value = -3.402823466e+38;
    var duration_id = 0xffffffffu;
    for (
      var subgroup = 0u;
      subgroup < ${bt}u;
      subgroup += 1u
    ) {
      if (
        choose_better(
          token_value,
          token_id,
          token_values[subgroup],
          token_ids[subgroup]
        )
      ) {
        token_value = token_values[subgroup];
        token_id = token_ids[subgroup];
      }
      if (
        choose_better(
          duration_value,
          duration_id,
          duration_values[subgroup],
          duration_ids[subgroup]
        )
      ) {
        duration_value = duration_values[subgroup];
        duration_id = duration_ids[subgroup];
      }
    }
    if (pair_slot == 0u) {
      best_token_a = token_id;
      best_duration_a = duration_id;
    } else {
      best_token_b = token_id;
      best_duration_b = duration_id;
    }
  }
  workgroupBarrier();
}

fn run_joint_pair(
  sequence_a: u32,
  sequence_b: u32,
  active_a: bool,
  active_b: bool,
  lane: u32,
  subgroup_lane: u32,
  subgroup_slot: u32,
) {
  if (lane < ${$ / 4}u) {
    let channel = lane * 4u;
    var joint_a = vec4<f32>(0.0);
    if (active_a) {
      let encoder_element =
        (sequence_a * params.frames + decode_time_a) * ${$}u +
        channel;
      let encoder_value = read_arena_vec4(
        params.encoder_offset,
        encoder_element
      );
      let decoder_value = read_predictor_scratch_vec4(
        sequence_a,
        4u,
        channel
      );
      joint_a = max(encoder_value + decoder_value, vec4<f32>(0.0));
    }
    joint_input_a[channel] = joint_a.x;
    joint_input_a[channel + 1u] = joint_a.y;
    joint_input_a[channel + 2u] = joint_a.z;
    joint_input_a[channel + 3u] = joint_a.w;

    var joint_b = vec4<f32>(0.0);
    if (active_b) {
      let encoder_element =
        (sequence_b * params.frames + decode_time_b) * ${$}u +
        channel;
      let encoder_value = read_arena_vec4(
        params.encoder_offset,
        encoder_element
      );
      let decoder_value = read_predictor_scratch_vec4(
        sequence_b,
        4u,
        channel
      );
      joint_b = max(encoder_value + decoder_value, vec4<f32>(0.0));
    }
    joint_input_b[channel] = joint_b.x;
    joint_input_b[channel + 1u] = joint_b.y;
    joint_input_b[channel + 2u] = joint_b.z;
    joint_input_b[channel + 3u] = joint_b.w;
  }
  workgroupBarrier();

${i}
}

@compute @workgroup_size(${G}, 1, 1)
fn main(
  @builtin(local_invocation_index) lane: u32,
  @builtin(subgroup_invocation_id) subgroup_lane: u32,
  @builtin(workgroup_id) group: vec3<u32>,
) {
  let sequence_a = group.x * 2u;
  let sequence_b = sequence_a + 1u;
  if (sequence_a >= params.batch_size) {
    return;
  }
  let has_sequence_b = sequence_b < params.batch_size;
  for (var item = lane; item < ${4 * $}u; item += ${G}u) {
    arena[params.state_offset + sequence_a * ${4 * $}u + item] = 0u;
    if (has_sequence_b) {
      arena[params.state_offset + sequence_b * ${4 * $}u + item] = 0u;
    }
  }
  if (lane == 0u) {
    output_count_a = 0u;
    output_count_b = 0u;
    decode_status_a = 0u;
    decode_status_b = 0u;
    symbols_at_time_a = 0u;
    symbols_at_time_b = 0u;
    emitted_nonblank_a = 0u;
    emitted_nonblank_b = 0u;
    encoded_length_a =
      min(
        min(arena[params.lengths_offset + sequence_a], params.frames),
        arena[params.decode_ends_offset + sequence_a]
      );
    decode_time_a =
      min(arena[params.decode_starts_offset + sequence_a], encoded_length_a);
    encoded_length_b = 0u;
    decode_time_b = 0u;
    if (has_sequence_b) {
      encoded_length_b =
        min(
          min(arena[params.lengths_offset + sequence_b], params.frames),
          arena[params.decode_ends_offset + sequence_b]
        );
      decode_time_b =
        min(arena[params.decode_starts_offset + sequence_b], encoded_length_b);
    }
  }
  storageBarrier();
  workgroupBarrier();

  // Chrome/Metal exposes fixed subgroup-32 execution on the target Apple GPU.
  let subgroup_slot = lane / ${Jt}u;

  // Prime each two-layer LSTM sequentially through the one predictor workspace.
  if (
    workgroupUniformLoad(&decode_time_a) <
    workgroupUniformLoad(&encoded_length_a)
  ) {
    prepare_predictor(sequence_a, 0u, true, lane);
  }
  if (
    workgroupUniformLoad(&decode_time_b) <
    workgroupUniformLoad(&encoded_length_b)
  ) {
    prepare_predictor(sequence_b, 0u, true, lane);
  }

  loop {
    let active_a =
      workgroupUniformLoad(&decode_time_a) <
      workgroupUniformLoad(&encoded_length_a);
    let active_b =
      workgroupUniformLoad(&decode_time_b) <
      workgroupUniformLoad(&encoded_length_b);
    if (!active_a && !active_b) {
      break;
    }
    run_joint_pair(
      sequence_a,
      sequence_b,
      active_a,
      active_b,
      lane,
      subgroup_lane,
      subgroup_slot
    );

    if (lane == 0u) {
      emitted_nonblank_a = 0u;
      emitted_nonblank_b = 0u;
      if (active_a) {
        let emission_time = decode_time_a;
        if (best_token_a != ${Xe}u) {
          emitted_nonblank_a = 1u;
          if (output_count_a < params.max_tokens) {
            let output = sequence_a * params.max_tokens + output_count_a;
            arena[params.tokens_offset + output] = best_token_a;
            arena[params.token_frames_offset + output] = emission_time;
            arena[params.token_durations_offset + output] = best_duration_a;
            output_count_a += 1u;
          } else {
            decode_status_a |= 1u;
          }
        }
        symbols_at_time_a += 1u;
        if (best_duration_a != 0u) {
          decode_time_a += best_duration_a;
          symbols_at_time_a = 0u;
        } else if (
          best_token_a == ${Xe}u ||
          symbols_at_time_a >= 10u
        ) {
          decode_time_a += 1u;
          symbols_at_time_a = 0u;
        }
      }
      if (active_b) {
        let emission_time = decode_time_b;
        if (best_token_b != ${Xe}u) {
          emitted_nonblank_b = 1u;
          if (output_count_b < params.max_tokens) {
            let output = sequence_b * params.max_tokens + output_count_b;
            arena[params.tokens_offset + output] = best_token_b;
            arena[params.token_frames_offset + output] = emission_time;
            arena[params.token_durations_offset + output] = best_duration_b;
            output_count_b += 1u;
          } else {
            decode_status_b |= 1u;
          }
        }
        symbols_at_time_b += 1u;
        if (best_duration_b != 0u) {
          decode_time_b += best_duration_b;
          symbols_at_time_b = 0u;
        } else if (
          best_token_b == ${Xe}u ||
          symbols_at_time_b >= 10u
        ) {
          decode_time_b += 1u;
          symbols_at_time_b = 0u;
        }
      }
    }
    workgroupBarrier();

    if (workgroupUniformLoad(&emitted_nonblank_a) != 0u) {
      let next_token = workgroupUniformLoad(&best_token_a);
      commit_predictor(sequence_a, lane);
      prepare_predictor(sequence_a, next_token, false, lane);
    }
    if (workgroupUniformLoad(&emitted_nonblank_b) != 0u) {
      let next_token = workgroupUniformLoad(&best_token_b);
      commit_predictor(sequence_b, lane);
      prepare_predictor(sequence_b, next_token, false, lane);
    }
  }

  // FluidAudio's v2/v3 decoder uses a bounded final-chunk continuation after
  // normal frame exhaustion. This adaptation preserves the native WebGPU decoder's
  // predictor state, while matching its probe-frame cycle and stopping rules.
  // Most windows skip this uniform branch entirely.
  // Stage storage-backed flags through workgroup memory so all barrier-
  // containing control flow is visibly uniform to WGSL validation.
  if (lane == 0u) {
    emitted_nonblank_a = select(
      0u,
      1u,
      arena[params.flush_finals_offset + sequence_a] != 0u &&
        arena[params.decode_starts_offset + sequence_a] < encoded_length_a
    );
    emitted_nonblank_b = 0u;
    if (has_sequence_b) {
      emitted_nonblank_b = select(
        0u,
        1u,
        arena[params.flush_finals_offset + sequence_b] != 0u &&
          arena[params.decode_starts_offset + sequence_b] < encoded_length_b
      );
    }
  }
  workgroupBarrier();
  let flush_requested_a =
    workgroupUniformLoad(&emitted_nonblank_a) != 0u;
  let flush_requested_b =
    workgroupUniformLoad(&emitted_nonblank_b) != 0u;
  if (flush_requested_a || flush_requested_b) {
    if (lane == 0u) {
      symbols_at_time_a = 0u;
      symbols_at_time_b = 0u;
      flush_blanks_a = 0u;
      flush_blanks_b = 0u;
      flush_time_a = decode_time_a;
      flush_time_b = decode_time_b;
    }
    workgroupBarrier();

    loop {
      let flush_active_a =
        flush_requested_a &&
        workgroupUniformLoad(&symbols_at_time_a) < 10u &&
        workgroupUniformLoad(&flush_blanks_a) < 5u;
      let flush_active_b =
        flush_requested_b &&
        workgroupUniformLoad(&symbols_at_time_b) < 10u &&
        workgroupUniformLoad(&flush_blanks_b) < 5u;
      if (!flush_active_a && !flush_active_b) {
        break;
      }

      if (lane == 0u) {
        if (flush_active_a) {
          let variation = symbols_at_time_a % 3u;
          if (variation == 0u) {
            decode_time_a = min(
              flush_time_a,
              min(
                arena[params.lengths_offset + sequence_a],
                params.frames
              ) - 1u
            );
          } else if (variation == 1u) {
            decode_time_a = min(encoded_length_a - 1u, params.frames - 1u);
          } else {
            decode_time_a = min(
              max(encoded_length_a, 2u) - 2u,
              params.frames - 1u
            );
          }
        }
        if (flush_active_b) {
          let variation = symbols_at_time_b % 3u;
          if (variation == 0u) {
            decode_time_b = min(
              flush_time_b,
              min(
                arena[params.lengths_offset + sequence_b],
                params.frames
              ) - 1u
            );
          } else if (variation == 1u) {
            decode_time_b = min(encoded_length_b - 1u, params.frames - 1u);
          } else {
            decode_time_b = min(
              max(encoded_length_b, 2u) - 2u,
              params.frames - 1u
            );
          }
        }
      }
      workgroupBarrier();
      run_joint_pair(
        sequence_a,
        sequence_b,
        flush_active_a,
        flush_active_b,
        lane,
        subgroup_lane,
        subgroup_slot
      );

      if (lane == 0u) {
        emitted_nonblank_a = 0u;
        emitted_nonblank_b = 0u;
        if (flush_active_a) {
          if (best_token_a == ${Xe}u) {
            flush_blanks_a += 1u;
          } else {
            flush_blanks_a = 0u;
            emitted_nonblank_a = 1u;
            if (output_count_a < params.max_tokens) {
              let output = sequence_a * params.max_tokens + output_count_a;
              arena[params.tokens_offset + output] = best_token_a;
              arena[params.token_frames_offset + output] =
                min(flush_time_a, encoded_length_a - 1u);
              arena[params.token_durations_offset + output] = best_duration_a;
              output_count_a += 1u;
            } else {
              decode_status_a |= 1u;
            }
          }
          flush_time_a = min(
            flush_time_a + max(1u, best_duration_a),
            encoded_length_a
          );
          symbols_at_time_a += 1u;
        }
        if (flush_active_b) {
          if (best_token_b == ${Xe}u) {
            flush_blanks_b += 1u;
          } else {
            flush_blanks_b = 0u;
            emitted_nonblank_b = 1u;
            if (output_count_b < params.max_tokens) {
              let output = sequence_b * params.max_tokens + output_count_b;
              arena[params.tokens_offset + output] = best_token_b;
              arena[params.token_frames_offset + output] =
                min(flush_time_b, encoded_length_b - 1u);
              arena[params.token_durations_offset + output] = best_duration_b;
              output_count_b += 1u;
            } else {
              decode_status_b |= 1u;
            }
          }
          flush_time_b = min(
            flush_time_b + max(1u, best_duration_b),
            encoded_length_b
          );
          symbols_at_time_b += 1u;
        }
      }
      workgroupBarrier();

      if (workgroupUniformLoad(&emitted_nonblank_a) != 0u) {
        let next_token = workgroupUniformLoad(&best_token_a);
        commit_predictor(sequence_a, lane);
        prepare_predictor(sequence_a, next_token, false, lane);
      }
      if (workgroupUniformLoad(&emitted_nonblank_b) != 0u) {
        let next_token = workgroupUniformLoad(&best_token_b);
        commit_predictor(sequence_b, lane);
        prepare_predictor(sequence_b, next_token, false, lane);
      }
    }
  }

  if (lane == 0u) {
    arena[params.counts_offset + sequence_a] = output_count_a;
    arena[params.status_offset + sequence_a] = decode_status_a;
    if (has_sequence_b) {
      arena[params.counts_offset + sequence_b] = output_count_b;
      arena[params.status_offset + sequence_b] = decode_status_b;
    }
  }
}
`;
}
function ps(e) {
	let t = e === "fp16" ? Eu() : Su();
	t = pr(t, `enable subgroups;
`, "");
	for (const o of [
		"token_values: array<f32",
		"token_ids: array<u32",
		"duration_values: array<f32",
		"duration_ids: array<u32"
	]) t = pr(t, `var<workgroup> ${o}, ${bt}>;`, `var<workgroup> ${o}, ${G}>;`);
	const r = t.indexOf("fn reduce_joint_result("), a = t.indexOf("fn run_joint_pair(", r);
	if (r < 0 || a < 0) throw new Error("Unable to construct portable TDT reduction");
	t = t.slice(0, r) + Cf() + `

` + t.slice(a), t = pr(t, `  lane: u32,
  subgroup_lane: u32,
  subgroup_slot: u32,
) {`, `  lane: u32,
) {`), t = t.replaceAll(`    lane,
    subgroup_lane,
    subgroup_slot,
    local_token_value_`, `    lane,
    local_token_value_`), t = pr(t, `  @builtin(local_invocation_index) lane: u32,
  @builtin(subgroup_invocation_id) subgroup_lane: u32,
  @builtin(workgroup_id) group: vec3<u32>,`, `  @builtin(local_invocation_index) lane: u32,
  @builtin(workgroup_id) group: vec3<u32>,`), t = pr(t, `  // Chrome/Metal exposes fixed subgroup-32 execution on the target Apple GPU.
  let subgroup_slot = lane / ${Jt}u;

`, ""), t = t.replaceAll(`      lane,
      subgroup_lane,
      subgroup_slot
    );`, `      lane
    );`), t = t.replaceAll(`        lane,
        subgroup_lane,
        subgroup_slot
      );`, `        lane
      );`);
	const n = t.indexOf("subgroup");
	if (n >= 0) throw new Error("Portable TDT shader retained a subgroup dependency near: " + t.slice(Math.max(0, n - 40), n + 80));
	return t;
}
function Cf() {
	return `fn reduce_joint_result(
  pair_slot: u32,
  lane: u32,
  local_token_value: f32,
  local_token_id: u32,
  local_duration_value: f32,
  local_duration_id: u32,
) {
  token_values[lane] = local_token_value;
  token_ids[lane] = local_token_id;
  duration_values[lane] = local_duration_value;
  duration_ids[lane] = local_duration_id;
  workgroupBarrier();

  if (lane < ${bt}u) {
    let base = lane * ${Jt}u;
    var token_value = token_values[base];
    var token_id = token_ids[base];
    var duration_value = duration_values[base];
    var duration_id = duration_ids[base];
    for (var member = 1u; member < ${Jt}u; member += 1u) {
      let right = base + member;
      if (
        choose_better(
          token_value,
          token_id,
          token_values[right],
          token_ids[right]
        )
      ) {
        token_value = token_values[right];
        token_id = token_ids[right];
      }
      if (
        choose_better(
          duration_value,
          duration_id,
          duration_values[right],
          duration_ids[right]
        )
      ) {
        duration_value = duration_values[right];
        duration_id = duration_ids[right];
      }
    }
    token_values[base] = token_value;
    token_ids[base] = token_id;
    duration_values[base] = duration_value;
    duration_ids[base] = duration_id;
  }
  workgroupBarrier();

  if (lane == 0u) {
    var token_value = -3.402823466e+38;
    var token_id = 0xffffffffu;
    var duration_value = -3.402823466e+38;
    var duration_id = 0xffffffffu;
    for (
      var virtual_group = 0u;
      virtual_group < ${bt}u;
      virtual_group += 1u
    ) {
      let winner = virtual_group * ${Jt}u;
      if (
        choose_better(
          token_value,
          token_id,
          token_values[winner],
          token_ids[winner]
        )
      ) {
        token_value = token_values[winner];
        token_id = token_ids[winner];
      }
      if (
        choose_better(
          duration_value,
          duration_id,
          duration_values[winner],
          duration_ids[winner]
        )
      ) {
        duration_value = duration_values[winner];
        duration_id = duration_ids[winner];
      }
    }
    if (pair_slot == 0u) {
      best_token_a = token_id;
      best_duration_a = duration_id;
    } else {
      best_token_b = token_id;
      best_duration_b = duration_id;
    }
  }
  workgroupBarrier();
}`;
}
function pr(e, t, r) {
	if (!e.includes(t)) throw new Error(`Unable to construct portable TDT shader: ${t}`);
	return e.replace(t, r);
}
const In = 40, If = "batch", xf = "submit-to-readback-wall", Of = [], Lr = 2048, Nf = 32 * 1024, Ff = 207734, Uf = 177045, Gf = 4 * 640, Wf = 5 * 640, le = Uint32Array.BYTES_PER_ELEMENT, ku = 3;
const mn = 27, _s = mn - 1;
const qf = "queue-drained-subsampling-layer-projector-decoder", ms = In * 128 * tt * Float32Array.BYTES_PER_ELEMENT, Pu = ku * In * le;
function Df(e, t) {
	return t === "fp16" ? e.fp16ModelUrl : e.fp32ModelUrl;
}
function zf(e, t) {
	if (e.blankTokenId !== t.blankTokenId) throw new Error("Tokenizer blank token does not match the model");
	if (e.vocabularySize !== t.vocabularySize) throw new Error("Tokenizer vocabulary size does not match the model");
}
var jf = class {
	tail = Promise.resolve();
	async acquire() {
		const e = this.tail;
		let t;
		const r = new Promise((n) => {
			t = n;
		});
		this.tail = e.then(() => r), await e;
		let a = !1;
		return () => {
			a || (a = !0, t());
		};
	}
}, Hf = class {
	device;
	model;
	fbank;
	tokenizer;
	inferenceCompute;
	inferenceSlots;
	preferredBatchSize;
	maxInFlightBatches;
	diagnostics;
	previousFbankWindow;
	preparedFbankBatch;
	featureStaging;
	graphSubmissionGate = new jf();
	disposed = !1;
	gpuError;
	uncapturedErrorListener = (e) => {
		this.gpuError ??= /* @__PURE__ */ new Error(`WebGPU ${e.error.constructor.name}: ${e.error.message}`);
	};
	constructor(e, t, r, a, n, o, s) {
		if (this.device = e, this.model = r, this.fbank = a, this.tokenizer = n, this.inferenceCompute = o, this.inferenceSlots = s, s.length !== 2) throw new Error("Raw WebGPU engine requires 2 inference slots");
		const i = o.encoderGraph, u = i.transientPaletteParameterPoolBytes * 1, l = i.plan.precision === "fp16" ? yi : Ci, c = l * 1, d = gn(o.decoderLayout, i.batchSize).readbackByteLength;
		this.preferredBatchSize = i.batchSize, this.maxInFlightBatches = s.length, e.addEventListener("uncapturederror", this.uncapturedErrorListener), e.lost.then((h) => {
			!this.disposed && h.reason !== "destroyed" && (this.gpuError ??= /* @__PURE__ */ new Error(`WebGPU device lost (${h.reason}): ${h.message}`));
		}), this.diagnostics = Object.freeze({
			backend: "raw-webgpu-wgsl-and-simd-wasm",
			model: r.manifest.source.repository,
			revision: r.manifest.source.revision,
			encoderIntermediateSize: r.manifest.config.intermediateSize,
			encoderWeightFormat: r.manifest.config.encoderWeightFormat,
			modelPackageFormat: r.manifest.format,
			executionPrecision: t.executionProfile.precision,
			executionSelection: t.executionProfile.precision === "fp16" ? "adapter-exposes-shader-f16" : "adapter-does-not-expose-shader-f16",
			kernelBackend: t.executionProfile.kernelBackend,
			kernelSelection: t.executionProfile.kernelBackend === "subgroups" ? "adapter-exposes-fixed-32-lane-subgroups" : "adapter-lacks-compatible-subgroups",
			...i.portableF16GemmLoadEncoding === null ? {} : { portableF16GemmLoadEncoding: i.portableF16GemmLoadEncoding },
			modelPrecision: r.precision,
			modelManifestUrl: r.manifestUrl,
			modelManifestSha256: r.manifestSha256,
			modelManifestListedBytes: r.manifestListedBytes,
			batchSize: this.preferredBatchSize,
			maxInFlightBatches: this.maxInFlightBatches,
			inferenceSlotCount: s.length,
			encoderGraphCount: 1,
			subsamplingMicrobatchSize: i.plan.subsamplingMicrobatchSize,
			gemmAccumulation: i.plan.precision === "fp16" ? "float16" : "float32",
			adapter: t.adapterInfo,
			requiredWebGpuFeatures: t.requiredFeatures,
			webGpuFeatures: t.stockFeatures,
			modelRuntimeGpuBytes: r.memory.runtimeGpuBytes,
			modelPackedDownloadBytes: r.memory.packedDownloadBytes,
			modelRetainedGpuBytes: r.memory.retainedRuntimeBytes,
			modelExpandedGpuBytes: r.memory.expandedRuntimeBytes,
			modelLargestRuntimeShardBytes: r.memory.largestRuntimeShardBytes,
			modelLoaderPeakGpuBytes: r.memory.loaderPeakGpuBytes,
			modelRuntimeBufferCount: r.memory.runtimeBufferCount,
			modelTransientWeightScratchBytesPerGraph: l,
			modelTransientWeightScratchCount: 1,
			modelTransientWeightScratchTotalBytes: c,
			modelTransientWeightParameterPoolBytesPerGraph: i.transientPaletteParameterPoolBytes,
			modelTransientWeightParameterPoolCount: 1,
			modelTransientWeightParameterPoolBufferCountPerGraph: 1,
			modelTransientWeightParameterPoolUsedSlotsPerGraph: i.transientPaletteParameterPoolUsedSlots,
			modelTransientWeightParameterPoolTotalBytes: u,
			modelTransientWeightMatrixCount: i.transientPaletteMatrixCount,
			modelTransientWeightExpansionDispatchesPerGraph: i.transientPaletteExpansionDispatches,
			modelTransientWeightExpandedBytesPerGraph: i.transientPaletteExpandedBytesPerGraph,
			modelSteadyGpuBytes: r.memory.runtimeGpuBytes + c + u,
			activationArenaBytes: i.arena.byteLength,
			activationArenaCount: 1,
			activationArenaBufferCount: i.arena.bufferCount,
			activationArenaBufferBytes: i.arena.bufferByteLengths,
			activationArenaLargestBufferBytes: i.arena.largestBufferByteLength,
			activationArenaTotalBytes: i.arena.byteLength * 1,
			encoderUniformParameterPoolBytesPerGraph: i.uniformParameterPoolBytes,
			encoderUniformParameterPoolCount: 1,
			encoderUniformParameterPoolBufferCountPerGraph: i.uniformParameterPoolBufferCount,
			encoderUniformParameterPoolUsedSlotsPerGraph: i.uniformParameterPoolUsedSlots,
			encoderUniformParameterPoolTotalBytes: i.uniformParameterPoolBytes * 1,
			decoderDispatchCount: 1,
			decoderReadbackBytesPerSlot: d,
			decoderReadbackCount: s.length,
			decoderReadbackTotalBytes: d * s.length,
			decoderControlStagingBytes: Pu,
			decoderControlStagingBufferCount: 1,
			wasmHeapBytes: a.memoryStats.heapBytes,
			fbankMode: "local-simd-wasm",
			featureStagingBytes: ms,
			featureStagingBufferCount: 1,
			fbankHopSamples: a.hopSamples,
			decoderMode: "gpu",
			tdtRecurrentState: "f32",
			featureUploadMode: If,
			encoderPreset: "full",
			gpuTimingSource: xf,
			gpuSubmissionMode: qf,
			encoderCommandBuffersPerGraph: 26,
			commandBuffersPerGraph: mn,
			queueDrainFencesPerGraph: _s,
			cooperativeGpuTaskYieldsPerGraph: _s,
			cooperativeGpuIdleMilliseconds: 1,
			maxQueuedParakeetCommandBuffers: 1,
			graphSubmissionConcurrency: 1,
			conformerLayersPerCommandBuffer: 1,
			maxTokensPerWindow: Lr
		}), r.releaseInitializationMetadata();
	}
	beginTranscription() {
		if (this.assertAlive(), this.inferenceSlots.some((e) => e.busy)) throw new Error("Cannot begin transcription with inference in flight");
		this.previousFbankWindow = void 0, this.preparedFbankBatch = void 0, this.fbank.resetReuse();
	}
	prepareWindowBatch(e, t) {
		if (this.assertAlive(), this.preparedFbankBatch !== void 0) throw new Error("A prepared FBank batch is already pending");
		const r = this.acquireInferenceSlot();
		let a;
		try {
			a = this.fbank.beginPreparedBatch(e, t);
		} catch (s) {
			throw r.busy = !1, s;
		}
		const n = {
			inferenceSlot: r,
			batchSize: e,
			sampleCount: t,
			windows: [],
			validFeatureCounts: [],
			featureStaging: this.featureStagingForBatch(e),
			releaseGraphSubmission: void 0,
			frontendMs: 0,
			finished: !1
		};
		this.preparedFbankBatch = n;
		let o = !0;
		return {
			samples: a,
			commit: (s, i, u) => {
				if (this.assertAlive(), !o || this.preparedFbankBatch !== n) throw new Error("Prepared FBank batch is no longer active");
				if (i !== n.windows.length || i >= n.batchSize) throw new RangeError(`Prepared FBank item index must be ${n.windows.length}`);
				if (s.windowSampleCount !== n.sampleCount) throw new RangeError("Prepared FBank window shape changed");
				const l = performance.now();
				let c;
				if (u !== void 0) {
					const p = u.sampleOffset + u.frameCount * k;
					if (!Number.isSafeInteger(u.sampleOffset) || u.sampleOffset < 0 || !Number.isSafeInteger(u.frameCount) || u.frameCount < 1 || p > s.validSampleCount) throw new RangeError("Incremental RMS range exceeds the real PCM window");
					c = this.fbank.computeRmsBits(u.sampleOffset, u.frameCount);
				}
				const d = {
					startSample: s.sourceStartSample,
					sampleCount: s.windowSampleCount,
					validSampleCount: s.validSampleCount
				}, h = tl(this.previousFbankWindow, d), f = this.fbank.computePreparedItem(i, {
					reusableFrameShift: h,
					validSampleCount: s.validSampleCount
				});
				if (f.frameCount !== 1501 || f.binCount !== 128) throw new Error("SIMD Wasm frontend returned an incompatible feature shape");
				return n.featureStaging.set(f.data, i * 128 * tt), n.validFeatureCounts.push(f.validFrameCount), n.windows.push(s), n.frontendMs += performance.now() - l, this.previousFbankWindow = d, c;
			},
			finish: async () => {
				if (this.assertAlive(), !o || this.preparedFbankBatch !== n) throw new Error("Prepared FBank batch is no longer active");
				if (n.windows.length !== n.batchSize) throw new Error(`Prepared ${n.windows.length}/${n.batchSize} windows`);
				const s = performance.now();
				this.fbank.finishPreparedBatch(), n.frontendMs += performance.now() - s;
				const i = await this.graphSubmissionGate.acquire();
				try {
					if (this.assertAlive(), !o || this.preparedFbankBatch !== n) throw new Error("Prepared FBank batch is no longer active");
					n.releaseGraphSubmission = i;
					const u = performance.now();
					this.inferenceCompute.encoderGraph.uploadFeatures(n.featureStaging), n.frontendMs += performance.now() - u, n.finished = !0, o = !1;
				} catch (u) {
					throw n.releaseGraphSubmission = void 0, i(), u;
				}
			},
			abort: () => {
				const s = this.preparedFbankBatch === n;
				!o && !s || (o = !1, s && (this.preparedFbankBatch = void 0, Ru(n), n.inferenceSlot.busy = !1, this.previousFbankWindow = void 0, this.fbank.resetReuse()));
			}
		};
	}
	async transcribeWindows(e, t, r) {
		const a = this.preparedFbankBatch;
		this.preparedFbankBatch = void 0;
		try {
			this.assertAlive();
		} catch (i) {
			throw aa(a), i;
		}
		if (e.length < 1 || e.length > this.preferredBatchSize) throw aa(a), /* @__PURE__ */ new RangeError(`Raw WebGPU engine batch must contain 1-${this.preferredBatchSize} windows`);
		const n = performance.now();
		if (a === void 0 || !a.finished || a.batchSize !== e.length || a.windows.length !== e.length || !e.every((i, u) => op(i, a.windows[u]))) throw aa(a), /* @__PURE__ */ new Error("Raw WebGPU inference requires a complete prepared FBank batch");
		const o = a.inferenceSlot;
		let s = a.releaseGraphSubmission;
		if (a.releaseGraphSubmission = void 0, s === void 0) throw o.busy = !1, /* @__PURE__ */ new Error("Raw WebGPU inference requires graph-submission ownership");
		if (!e.every((i) => i.samples.length === i.windowSampleCount && i.samples.byteLength === i.windowSampleCount * Float32Array.BYTES_PER_ELEMENT)) throw s(), s = void 0, o.busy = !1, /* @__PURE__ */ new RangeError(`Local FBank source windows must contain ${a.sampleCount} samples`);
		if (!o.busy) throw s(), s = void 0, /* @__PURE__ */ new Error("Prepared inference slot was released prematurely");
		try {
			wt(t);
			const i = a.validFeatureCounts.map((v) => Math.max(1, v)), u = hu(i), l = a.frontendMs + performance.now() - n;
			wt(t), this.device.pushErrorScope("validation");
			const { encoderGraph: c, decoderDispatch: d, decoderLayout: h } = this.inferenceCompute, f = new Uint32Array(ku * h.batchCapacity), p = f.subarray(0, h.batchCapacity), _ = f.subarray(h.batchCapacity, h.batchCapacity * 2), b = f.subarray(h.batchCapacity * 2);
			for (let v = 0; v < e.length; v += 1) {
				const V = e[v];
				Kf(V, u[v]);
				const de = V.decodeStartFrame, _e = V.decodeEndFrame;
				p[v] = de, _[v] = _e, b[v] = V.flushFinal ? 1 : 0;
			}
			this.device.queue.writeBuffer(this.inferenceCompute.decoderControlStaging, 0, f);
			const w = [...c.encodeSubmissionChunks(i)], g = this.device.createCommandEncoder({ label: "parakeet-decoder-and-readback" });
			ap(g, this.inferenceCompute.decoderControlStaging, c, h), d.encode(g, void 0, e.length);
			const y = gn(h, e.length);
			if (np(g, c.arena.bufferFor(h.tokens), o.decoderReadback, y), w.push(g.finish({ label: "parakeet-decoder-and-readback" })), w.length !== mn) throw new Error("Inference command-buffer topology changed");
			const B = this.device.popErrorScope(), P = performance.now();
			await Vf(this.device.queue, w, t, $u, r === void 0 ? void 0 : (v, V) => {
				r({
					completedWorkUnits: v,
					totalWorkUnits: V
				});
			});
			const [x, A] = await Promise.all([B, this.mapDecoderOutput(o, y)]);
			if (x !== null) throw new Error(`WebGPU validation failed: ${x.message}`);
			this.throwGpuError(), wt(t), r?.({
				completedWorkUnits: w.length,
				totalWorkUnits: w.length
			});
			const T = performance.now() - P;
			s(), s = void 0, wt(t);
			const L = 0, ae = T;
			await new Promise((v) => setTimeout(v, 0)), wt(t);
			const H = e.length, W = [];
			for (let v = 0; v < e.length; v += 1) {
				if (a.validFeatureCounts[v] === 0) {
					W.push({
						tokens: [],
						timings: {
							frontendMs: l / H,
							encoderMs: ae / H,
							decoderMs: L / H
						}
					});
					continue;
				}
				const V = [], de = this.readWord(A, y, y.metadata, v);
				if ((this.readWord(A, y, y.metadata, e.length + v) & 1) !== 0) throw new Error(`TDT output overflow for window ${e[v].index}`);
				if (de > Lr) throw new Error(`TDT decoder returned an invalid token count ${de}`);
				const _e = v * Lr;
				for (let F = 0; F < de; F += 1) {
					const we = _e + F, Z = this.readWord(A, y, y.tokens, we), Ae = this.readWord(A, y, y.tokenFrames, we), ne = this.readWord(A, y, y.tokenDurations, we);
					V.push({
						tokenId: Z,
						frameIndex: Ae,
						durationFrames: ne
					});
				}
				const q = Oc(V, e[v]);
				W.push({
					tokens: q,
					timings: {
						frontendMs: l / H,
						encoderMs: ae / H,
						decoderMs: L / H
					}
				});
			}
			return W;
		} finally {
			s?.(), o.decoderReadback.mapState === "mapped" && o.decoderReadback.unmap(), o.busy = !1;
		}
	}
	decodeTokenIds(e) {
		return this.assertAlive(), this.tokenizer.decode(e);
	}
	tokenPiece(e) {
		return this.assertAlive(), this.tokenizer.pieceForTokenId(e);
	}
	dispose() {
		if (!this.disposed) {
			this.disposed = !0, aa(this.preparedFbankBatch), this.preparedFbankBatch = void 0, this.device.removeEventListener("uncapturederror", this.uncapturedErrorListener);
			for (const e of this.inferenceSlots) e.decoderReadback.mapState === "mapped" && e.decoderReadback.unmap(), e.decoderReadback.destroy();
			this.inferenceCompute.decoderDispatch.destroy(), this.inferenceCompute.decoderControlStaging.destroy(), this.inferenceCompute.encoderGraph.destroy(), this.model.destroy(), this.fbank.dispose(), this.device.destroy();
		}
	}
	acquireInferenceSlot() {
		const e = this.inferenceSlots.find((t) => !t.busy);
		if (e === void 0) throw new Error("Raw WebGPU engine supports at most 2 in-flight batches");
		return e.busy = !0, e;
	}
	featureStagingForBatch(e) {
		this.featureStaging ??= new Float32Array(ms / Float32Array.BYTES_PER_ELEMENT);
		const t = e * 128 * tt;
		return this.featureStaging.subarray(0, t);
	}
	async mapDecoderOutput(e, t) {
		return await e.decoderReadback.mapAsync(GPUMapMode.READ, 0, t.readbackByteLength), new Uint32Array(e.decoderReadback.getMappedRange(0, t.readbackByteLength));
	}
	readWord(e, t, r, a) {
		const n = r.byteOffset + a * le;
		if (n < r.byteOffset || n + le > r.byteOffset + r.byteLength || n + le > t.readbackByteLength) throw new RangeError(`Decoder read exceeded ${r.label}`);
		return e[n / le];
	}
	assertAlive() {
		if (this.disposed) throw new Error("Raw WebGPU Parakeet engine was disposed");
		this.throwGpuError();
	}
	throwGpuError() {
		if (this.gpuError !== void 0) throw this.gpuError;
	}
};
async function Vf(e, t, r, a = $u, n) {
	if (t.length === 0) throw new RangeError("At least one GPU command buffer is required");
	for (let o = 0; o < t.length; o += 1) {
		wt(r);
		const s = t[o];
		if (e.submit([s]), o === t.length - 1) break;
		await e.onSubmittedWorkDone(), wt(r);
		const i = a();
		try {
			n?.(o + 1, t.length);
		} catch (u) {
			throw await i, u;
		}
		await i, wt(r);
	}
}
function $u() {
	return new Promise((e) => {
		setTimeout(e, 1);
	});
}
function Ru(e) {
	const t = e.releaseGraphSubmission;
	t !== void 0 && (e.releaseGraphSubmission = void 0, t());
}
function aa(e) {
	e !== void 0 && (Ru(e), e.inferenceSlot.busy = !1);
}
function Kf(e, t) {
	if (!Number.isSafeInteger(t) || t < 1 || t > 188) throw new RangeError("validEncoderLength is outside graph capacity");
	if (!Number.isSafeInteger(e.decodeStartFrame) || e.decodeStartFrame < 0 || !Number.isSafeInteger(e.decodeEndFrame) || e.decodeEndFrame <= e.decodeStartFrame || e.decodeEndFrame > 188 || e.decodeStartFrame >= t) throw new RangeError(`Window ${e.index} has an invalid decoder range for its valid encoder output`);
}
const Yf = async (e, t) => {
	const r = t.onProgress, a = Math.max(Ml, fu().byteLength);
	r?.({
		phase: "webgpu",
		fraction: 0
	}), t.signal?.throwIfAborted();
	const n = await nd({
		optionalFeatures: Of,
		requiredLimits: {
			maxBufferSize: a,
			maxStorageBufferBindingSize: a,
			maxComputeWorkgroupStorageSize: Nf
		}
	}), { device: o, report: s } = n;
	if (s.requiredFeatures.some((d) => !o.features.has(d))) throw o.destroy(), /* @__PURE__ */ new Error("Raw Parakeet WebGPU inference did not enable its selected profile");
	try {
		t.signal?.throwIfAborted();
	} catch (d) {
		throw o.destroy(), d;
	}
	r?.({
		phase: "webgpu",
		fraction: 1
	});
	let i, u, l;
	const c = [];
	try {
		const d = Df(e, n.executionProfile.precision), h = async () => {
			r?.({
				phase: "wasm",
				fraction: 0
			}), i = await rl.create(e.wasmUrl, t.signal), t.signal?.throwIfAborted(), r?.({
				phase: "wasm",
				fraction: 1
			});
		};
		if (t.modelSource === "cache-or-network" && await h(), u = await Zf(o, d, n.executionProfile.precision, t), t.modelSource === "cache-only" && await h(), i === void 0) throw new Error("Parakeet FBank Wasm was not initialized");
		const f = Ac.fromJSON(u.tokenizer);
		zf(f, u.manifest.config), r?.({
			phase: "pipelines",
			fraction: 0
		}), t.signal?.throwIfAborted(), l = await ep(o, u, n.executionProfile), r?.({
			phase: "pipelines",
			fraction: .5
		});
		for (let p = 0; p < 2; p += 1) c.push(tp(o, l, p)), r?.({
			phase: "pipelines",
			fraction: .5 + .5 * (p + 1) / 2
		});
		return t.signal?.throwIfAborted(), new Hf(o, s, u, i, f, l, c);
	} catch (d) {
		for (const h of c) h.decoderReadback.destroy();
		throw l?.decoderDispatch.destroy(), l?.decoderControlStaging.destroy(), l?.encoderGraph.destroy(), u?.destroy(), i?.dispose(), o.destroy(), d;
	}
};
async function Zf(e, t, r, a) {
	let n;
	const o = new pc(Xf(t, r), {
		cacheOnly: a.modelSource === "cache-only",
		fetch: (i, u) => {
			if (n === void 0) throw new Error("The Parakeet model fetch attempt has not started");
			return n(i, u);
		}
	});
	let s = 0;
	try {
		return await kc(async (i) => (n = i.fetch, await Jl.load(e, t, {
			expectedPrecision: r,
			fetch: o.fetch,
			...a.signal === void 0 ? {} : { signal: a.signal },
			onManifest: async (u) => {
				o.registerAssets(Qf(t, u)), a.modelSource === "cache-only" && await o.requireCachedAssets(Jf(t, u));
			},
			...a.onProgress === void 0 ? {} : { onProgress(u) {
				a.onProgress?.({
					phase: u.phase,
					fraction: u.totalBytes === 0 ? 0 : u.loadedBytes / u.totalBytes,
					loadedBytes: u.loadedBytes,
					totalBytes: u.totalBytes
				});
			} }
		})), {
			...a.signal === void 0 ? {} : { signal: a.signal },
			cleanup: async (i) => {
				await o.cancelInFlight(i);
			},
			recover: () => a.modelSource === "cache-only" || !(o.consumeCacheCorruption() && s < o.maximumCorruptionRetries) ? !1 : (s += 1, a.onProgress?.({
				phase: "cache",
				fraction: 0,
				message: "Replacing a damaged cached model file"
			}), !0),
			onRetry: (i) => {
				a.onProgress?.({
					phase: "retry",
					fraction: 0,
					attempt: i.nextAttempt,
					maxAttempts: i.maxAttempts,
					message: `Temporary model ${i.error.phase} failure; retrying in ${Math.max(.1, i.delayMs / 1e3).toFixed(1)} seconds`
				});
			}
		});
	} catch (i) {
		throw a.modelSource === "cache-only" && (i instanceof Ke || o.consumeCacheCorruption()) ? new Ke() : i;
	} finally {
		n = void 0, await o.settle();
	}
}
function Xf(e, t) {
	return {
		url: e,
		byteLength: t === "fp16" ? Ff : Uf,
		sha256: t === "fp16" ? xs : Is
	};
}
function Qf(e, t) {
	return t.files.map((r) => ({
		url: new URL(r.name, Bu(e)).href,
		byteLength: r.byteLength,
		sha256: r.sha256
	}));
}
function Jf(e, t) {
	const r = Ns(t), a = t.files.find((n) => n.name === "tokenizer.json");
	if (a === void 0) throw new Error("Selected model manifest is missing tokenizer.json");
	return [...r.shards.map(({ file: n }) => n), a].map((n) => ({
		url: new URL(n.name, Bu(e)).href,
		byteLength: n.byteLength,
		sha256: n.sha256
	}));
}
function Bu(e) {
	return new URL(e, globalThis.location?.href ?? "http://localhost/");
}
async function ep(e, t, r) {
	let a, n, o;
	try {
		a = await af.create(e, t, r);
		const s = rp(a, Lr), i = await hf.create(e, a.arena, t, r);
		return o = e.createBuffer({
			label: "parakeet-decoder-control-staging",
			size: Pu,
			usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
		}), n = i.createDispatch({
			label: "parakeet-persistent-tdt-decode",
			...a.decoderInput(),
			state: s.state,
			decodeStarts: s.decodeStarts,
			decodeEnds: s.decodeEnds,
			flushFinals: s.flushFinals,
			predictorScratch: s.predictorScratch,
			tokens: s.tokens,
			tokenFrames: s.tokenFrames,
			tokenDurations: s.tokenDurations,
			metadata: s.metadata,
			maxTokens: Lr
		}), {
			encoderGraph: a,
			decoderDispatch: n,
			decoderLayout: s,
			decoderControlStaging: o
		};
	} catch (s) {
		throw n?.destroy(), o?.destroy(), a?.destroy(), s;
	}
}
function tp(e, t, r) {
	return {
		decoderReadback: e.createBuffer({
			label: `parakeet-decoder-readback-${r}`,
			size: gn(t.decoderLayout, t.encoderGraph.batchSize).readbackByteLength,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
		}),
		busy: !1
	};
}
function rp(e, t) {
	const r = e.batchSize, a = e.plan.decoderScratch;
	let n = a.byteOffset;
	const o = (_, b) => {
		n = yt(n, 256);
		const w = e.arena.slice(_, n, b, a.bufferIndex ?? 0);
		return n += b, w;
	}, s = o("tdt-state", r * Gf * Float32Array.BYTES_PER_ELEMENT), i = o("tdt-decode-starts", r * le), u = o("tdt-decode-ends", r * le), l = o("tdt-flush-finals", r * le), c = o("tdt-predictor-scratch", r * Wf * Float32Array.BYTES_PER_ELEMENT), d = o("tdt-tokens", r * t * le), h = o("tdt-token-frames", r * t * le), f = o("tdt-token-durations", r * t * le), p = o("tdt-metadata", r * 2 * le);
	if (n > a.byteOffset + a.byteLength) throw new Error("TDT scratch does not fit the post-encoder activation slot");
	return {
		batchCapacity: r,
		maxTokens: t,
		decodeStarts: i,
		decodeEnds: u,
		flushFinals: l,
		state: s,
		predictorScratch: c,
		tokens: d,
		tokenFrames: h,
		tokenDurations: f,
		metadata: p
	};
}
function ap(e, t, r, a) {
	const n = a.batchCapacity * le, o = [
		a.decodeStarts,
		a.decodeEnds,
		a.flushFinals
	];
	for (let s = 0; s < o.length; s += 1) {
		const i = o[s];
		if (i.byteLength < n) throw new RangeError(`${i.label} is smaller than the decoder batch`);
		e.copyBufferToBuffer(t, s * n, r.arena.bufferFor(i), i.byteOffset, n);
	}
}
function gn(e, t) {
	if (!Number.isSafeInteger(t) || t <= 0 || t > e.batchCapacity) throw new RangeError(`Decoder active batch must be in [1, ${e.batchCapacity}]`);
	const r = t * e.maxTokens * le, a = t * 2 * le;
	let n = 0;
	const o = (c, d) => {
		const h = {
			label: c,
			byteOffset: n,
			byteLength: d
		};
		return n += d, h;
	}, s = o("tdt-readback-tokens", r), i = o("tdt-readback-token-frames", r), u = o("tdt-readback-token-durations", r), l = o("tdt-readback-metadata", a);
	return {
		activeBatchSize: t,
		tokens: s,
		tokenFrames: i,
		tokenDurations: u,
		metadata: l,
		copies: t === e.batchCapacity ? [{
			sourceByteOffset: e.tokens.byteOffset,
			destinationByteOffset: 0,
			byteLength: n
		}] : [
			{
				sourceByteOffset: e.tokens.byteOffset,
				destinationByteOffset: s.byteOffset,
				byteLength: r
			},
			{
				sourceByteOffset: e.tokenFrames.byteOffset,
				destinationByteOffset: i.byteOffset,
				byteLength: r
			},
			{
				sourceByteOffset: e.tokenDurations.byteOffset,
				destinationByteOffset: u.byteOffset,
				byteLength: r
			},
			{
				sourceByteOffset: e.metadata.byteOffset,
				destinationByteOffset: l.byteOffset,
				byteLength: t * le
			},
			{
				sourceByteOffset: e.metadata.byteOffset + e.batchCapacity * le,
				destinationByteOffset: l.byteOffset + t * le,
				byteLength: t * le
			}
		],
		readbackByteLength: n
	};
}
function np(e, t, r, a, n = 0) {
	if (!Number.isSafeInteger(n) || n < 0 || n % le !== 0) throw new RangeError("Decoder readback destination base is invalid");
	for (const o of a.copies) e.copyBufferToBuffer(t, o.sourceByteOffset, r, n + o.destinationByteOffset, o.byteLength);
}
function op(e, t) {
	return e.index === t.index && e.windowSampleCount === t.windowSampleCount && e.logicalStartSample === t.logicalStartSample && e.logicalEndSample === t.logicalEndSample && e.sourceStartSample === t.sourceStartSample && e.sourceEndSample === t.sourceEndSample && e.readSampleCount === t.readSampleCount && e.timestampOffsetSample === t.timestampOffsetSample && e.emissionStartSample === t.emissionStartSample && e.emissionEndSample === t.emissionEndSample && e.decodeStartFrame === t.decodeStartFrame && e.decodeEndFrame === t.decodeEndFrame && e.flushFinal === t.flushFinal && e.validSampleCount === t.validSampleCount;
}
function wt(e) {
	e.throwIfAborted();
}
function sp(e) {
	if (!ip(e) || typeof e.type != "string") return !1;
	switch (e.type) {
		case "pcm-segment": return _r(e.segmentIndex) && _r(e.startSample) && _r(e.sampleCount) && e.sampleCount > 0 && e.file instanceof File && e.file.size === e.sampleCount * 2;
		case "pcm-end": return _r(e.totalSamples) && _r(e.outputByteLength) && e.outputByteLength === e.totalSamples * 2 && na(e.decoderWallMs) && na(e.decoderActiveMs) && na(e.decoderStartedAtMs) && na(e.decoderEndedAtMs) && e.decoderEndedAtMs >= e.decoderStartedAtMs;
		case "pcm-failed": return typeof e.message == "string";
		default: return !1;
	}
}
function ip(e) {
	return typeof e == "object" && e !== null;
}
function _r(e) {
	return typeof e == "number" && Number.isSafeInteger(e) && e >= 0;
}
function na(e) {
	return typeof e == "number" && Number.isFinite(e) && e >= 0;
}
const mr = Int16Array.BYTES_PER_ELEMENT;
var up = class {
	port;
	sampleRate = 16e3;
	segments = [];
	waiters = /* @__PURE__ */ new Set();
	available = 0;
	end;
	failure;
	disposed = !1;
	consumeTail = Promise.resolve();
	constructor(e) {
		this.port = e, e.addEventListener("message", this.handleMessage), e.start();
	}
	get availableSampleCount() {
		return this.available;
	}
	get ended() {
		return this.end !== void 0;
	}
	get sampleCount() {
		if (this.end === void 0) throw new Error("Streaming PCM sample count is unknown before EOF");
		return this.end.totalSamples;
	}
	get decoderTimings() {
		const e = this.end;
		return e === void 0 ? void 0 : {
			decoderWallMs: e.decoderWallMs,
			decoderActiveMs: e.decoderActiveMs,
			decoderStartedAtMs: e.decoderStartedAtMs,
			decoderEndedAtMs: e.decoderEndedAtMs
		};
	}
	waitForSamples(e, t) {
		return !Number.isSafeInteger(e) || e < 0 ? Promise.reject(/* @__PURE__ */ new RangeError("minimumSamples must be a non-negative safe integer")) : t?.aborted === !0 ? Promise.reject(gs(t)) : this.failure !== void 0 ? Promise.reject(this.failure) : this.available >= e || this.end !== void 0 ? Promise.resolve(this.availability()) : this.disposed ? Promise.reject(/* @__PURE__ */ new Error("Streaming PCM reader was disposed")) : new Promise((r, a) => {
			let n;
			const o = t === void 0 ? void 0 : () => {
				this.waiters.delete(n) && a(gs(t));
			};
			n = {
				minimumSamples: e,
				resolve: r,
				reject: a,
				signal: t,
				abortListener: o
			}, this.waiters.add(n), t?.addEventListener("abort", o, { once: !0 });
		});
	}
	waitForEnd(e) {
		return this.waitForSamples(Number.MAX_SAFE_INTEGER, e);
	}
	async readSamplesInto(e, t, r = 0, a = t.length - r) {
		if (cp(e, t, r, a), this.failure !== void 0) throw this.failure;
		const n = Math.min(a, Math.max(0, this.available - e));
		if (n === 0) return 0;
		const o = this.consumeTail.then(() => this.readAvailableRange(e, t, r, n));
		return this.consumeTail = o.then(() => {}, () => {}), await o, n;
	}
	dispose(e = /* @__PURE__ */ new Error("Streaming PCM reader was disposed")) {
		this.disposed || (this.disposed = !0, this.port.removeEventListener("message", this.handleMessage), this.port.close(), this.rejectWaiters(e), this.segments.length = 0);
	}
	handleMessage = (e) => {
		if (this.disposed || this.failure !== void 0 || this.end !== void 0) return;
		const t = e.data;
		if (!sp(t)) {
			this.fail(/* @__PURE__ */ new Error("Streaming decoder sent an invalid PCM message"));
			return;
		}
		if (t.type === "pcm-failed") {
			this.fail(new Error(t.message));
			return;
		}
		if (t.type === "pcm-segment") {
			if (t.segmentIndex !== this.segments.length || t.startSample !== this.available) {
				this.fail(/* @__PURE__ */ new Error("Streaming decoder sent non-contiguous PCM segments"));
				return;
			}
			this.segments.push(t), this.available += t.sampleCount, this.resolveWaiters();
			return;
		}
		if (t.totalSamples !== this.available || t.outputByteLength !== this.available * mr) {
			this.fail(/* @__PURE__ */ new Error("Streaming decoder EOF does not match PCM segments"));
			return;
		}
		this.end = t, this.resolveWaiters();
	};
	async readAvailableRange(e, t, r, a) {
		let n = e, o = r, s = a, i = lp(this.segments, n);
		for (; s > 0;) {
			const u = this.segments[i];
			if (u === void 0) throw new Error("Streaming PCM segment index is incomplete");
			const l = n - u.startSample, c = u.sampleCount - l, d = Math.min(s, c);
			let h = 0;
			for (; h < d;) {
				const f = Math.min(16e4, d - h), p = (l + h) * mr, _ = new Uint8Array(await u.file.slice(p, p + f * mr).arrayBuffer());
				if (_.byteLength !== f * mr) throw new Error("Immutable PCM segment produced a short read");
				const b = new DataView(_.buffer, _.byteOffset, _.byteLength);
				for (let w = 0; w < f; w += 1) t[o + h + w] = b.getInt16(w * mr, !0) / 32768;
				h += f;
			}
			n += d, o += d, s -= d, i += 1;
		}
	}
	availability() {
		return {
			availableSamples: this.available,
			ended: this.end !== void 0
		};
	}
	resolveWaiters() {
		const e = this.availability();
		for (const t of [...this.waiters]) e.availableSamples < t.minimumSamples && !e.ended || (this.waiters.delete(t), t.abortListener !== void 0 && t.signal?.removeEventListener("abort", t.abortListener), t.resolve(e));
	}
	fail(e) {
		this.failure = e, this.rejectWaiters(e);
	}
	rejectWaiters(e) {
		for (const t of this.waiters) t.abortListener !== void 0 && t.signal?.removeEventListener("abort", t.abortListener), t.reject(e);
		this.waiters.clear();
	}
};
function lp(e, t) {
	let r = 0, a = e.length;
	for (; r < a;) {
		const n = Math.floor((r + a) / 2), o = e[n];
		if (t < o.startSample) a = n;
		else if (t >= o.startSample + o.sampleCount) r = n + 1;
		else return n;
	}
	throw new RangeError("PCM sample is outside the available segments");
}
function cp(e, t, r, a) {
	if (!Number.isSafeInteger(e) || e < 0) throw new RangeError("startSample must be a non-negative safe integer");
	if (!Number.isSafeInteger(r) || r < 0) throw new RangeError("targetOffset must be a non-negative safe integer");
	if (!Number.isSafeInteger(a) || a < 0) throw new RangeError("sampleCount must be a non-negative safe integer");
	if (r + a > t.length) throw new RangeError("target range exceeds the destination array");
}
function gs(e) {
	return e.reason ?? new DOMException("The operation was aborted", "AbortError");
}
const xn = Math.max(2, Math.floor(1.2 / (k / 16e3)));
function Ce(e) {
	return JSON.stringify([
		e.windowSampleCount,
		e.logicalStartSample,
		e.logicalEndSample,
		e.sourceStartSample,
		e.sourceEndSample,
		e.readSampleCount,
		e.timestampOffsetSample,
		e.emissionStartSample,
		e.emissionEndSample,
		e.decodeStartFrame,
		e.decodeEndFrame,
		e.flushFinal,
		e.validSampleCount
	]);
}
function hp(e, t, r, a) {
	if (ma(r, "totalSamples"), !Number.isSafeInteger(t) || t < 0 || t + 1 >= e.length) throw new RangeError("adjacentIndex must identify a token pair");
	const n = e[t], o = e[t + 1], s = _t(n.startSample), i = _t(o.startSample), u = s + Math.max(1, n.durationFrames), l = i;
	if (l - u < xn) return;
	const c = u * k, d = Math.min(l * k, r);
	if (!(d <= c)) return {
		adjacentIndex: t,
		startFrame: u,
		endFrame: l,
		startSample: c,
		endSample: d,
		leadNeighbor: ws(e, t, -1, a),
		tailNeighbor: ws(e, t + 1, 1, a)
	};
}
function bs(e, t, r, a) {
	if (ma(e, "totalSamples"), ma(a, "index"), !Number.isSafeInteger(t.startSample) || !Number.isSafeInteger(t.endSample) || t.startSample < 0 || t.endSample <= t.startSample || t.endSample > e) throw new RangeError("invalid seam-gap sample range");
	const n = r === "gap-start" ? t.startSample : Math.floor((t.startSample + t.endSample) / 2) - Er / 2;
	let o = Math.max(0, Math.min(n, e - Er));
	o = Math.floor(o / k) * k;
	const s = Math.min(o + Er, e), i = s - o;
	if (i <= 0) throw new RangeError("seam-repair window has no source audio");
	return {
		index: a,
		windowSampleCount: kt,
		logicalStartSample: o,
		logicalEndSample: s,
		sourceStartSample: o,
		sourceEndSample: s,
		readSampleCount: i,
		timestampOffsetSample: o,
		emissionStartSample: o,
		emissionEndSample: s,
		decodeStartFrame: 0,
		decodeEndFrame: Math.ceil(i / k),
		flushFinal: s >= e,
		validSampleCount: i
	};
}
function fp(e, t, r) {
	let a = 0, n = e.length;
	for (; a < n;) {
		const s = _t(e[a].startSample);
		if (s > t.startFrame && s < t.endFrame - 1) break;
		a += 1;
	}
	const o = [];
	for (let s = a; s < n; s += 1) {
		const i = e[s], u = _t(i.startSample);
		u > t.startFrame && u < t.endFrame - 1 && o.push(i);
	}
	for (; o.length > 0 && !dt(o[0].tokenId, r);) o.shift();
	for (; o.length > 0 && en(o[0].tokenId, t.leadNeighbor.tokenId, r) && Math.abs(_t(o[0].startSample) - _t(t.leadNeighbor.startSample)) <= 6;) o.shift();
	for (; o.length > 0 && en(o.at(-1).tokenId, t.tailNeighbor.tokenId, r) && Math.abs(_t(t.tailNeighbor.startSample) - _t(o.at(-1).startSample)) <= 6;) o.pop();
	for (; o.length > 0 && (!dt(o[0].tokenId, r) || Xs(o[0].tokenId, r));) o.shift();
	return o;
}
function ws(e, t, r, a) {
	let n = t;
	for (; n + r >= 0 && n + r < e.length && Xs(e[n].tokenId, a);) n += r;
	return e[n];
}
function _t(e) {
	if (ma(e, "token startSample"), e % k !== 0) throw new RangeError("token timestamps must be encoder-frame aligned");
	return e / k;
}
function ma(e, t) {
	if (!Number.isSafeInteger(e) || e < 0) throw new RangeError(`${t} must be a non-negative safe integer`);
}
const ga = Math.fround(.008), ba = Math.fround(5e-4);
const bn = Math.fround(.3), pp = .75, _p = 65536, On = 125;
var mp = class {
	histogram = new Uint32Array(_p);
	nonzeroFrameCount = 0;
	nextSample = 0;
	finished = !1;
	get nextFrameStartSample() {
		return this.nextSample;
	}
	addContiguousFrameBits(e, t) {
		this.requireAppendStart(e);
		for (const r of t) this.addRmsBits(r);
		this.advance(t.length);
	}
	addContiguousFrameRms(e, t) {
		this.requireAppendStart(e), this.addRmsBits(Cu(t)), this.advance(1);
	}
	finishReferenceHighBucket() {
		if (this.finished) throw new Error("Adaptive speech RMS accumulator is already finished");
		if (this.finished = !0, this.nonzeroFrameCount === 0) return {
			histogram: this.histogram,
			nonzeroFrameCount: 0,
			highBits: 0,
			indexWithinHighBucket: 0
		};
		const e = Math.min(this.nonzeroFrameCount - 1, Math.floor(this.nonzeroFrameCount * pp));
		let t = 0, r = 0;
		for (; r < this.histogram.length && (t += this.histogram[r], !(t > e)); r += 1);
		const a = e - (t - this.histogram[r]);
		return {
			histogram: this.histogram,
			nonzeroFrameCount: this.nonzeroFrameCount,
			highBits: r,
			indexWithinHighBucket: a
		};
	}
	addRmsBits(e) {
		if (!Number.isSafeInteger(e) || e < 0 || e > 4294967295 || (e & 2147483648) !== 0 || (e & 2139095040) === 2139095040) throw new RangeError("RMS bits must encode a non-negative finite Float32 value");
		if (e === 0) return;
		const t = e >>> 16;
		this.histogram[t] = this.histogram[t] + 1, this.nonzeroFrameCount += 1;
	}
	requireAppendStart(e) {
		if (this.finished) throw new Error("Adaptive speech RMS accumulator is already finished");
		if (!Number.isSafeInteger(e) || e !== this.nextSample) throw new RangeError(`Adaptive RMS frames must continue at sample ${this.nextSample}`);
	}
	advance(e) {
		const t = this.nextSample + e * k;
		if (!Number.isSafeInteger(t)) throw new RangeError("Adaptive RMS sample position is unsafe");
		this.nextSample = t;
	}
};
function gp(e) {
	if (!Number.isFinite(e) || e < 0) throw new RangeError("referenceRms must be non-negative and finite");
	return Math.min(ga, Math.max(ba, Math.fround(e * bn)));
}
async function ys(e, t) {
	const r = On * k, a = new Float32Array(r);
	let n = e.sampleCount;
	for (; n > 0;) {
		Un(t);
		const o = Math.max(0, n - r), s = n - o;
		await Fn(e, o, a, s);
		for (let i = s; i > 0;) {
			const u = Math.max(0, i - k);
			if (Nn(a, i - u, u) >= ba) return o + i;
			i = u;
		}
		n = o;
	}
	return e.sampleCount;
}
async function Es(e, t, r) {
	const a = Math.floor(e.sampleCount / k) * k;
	if (t.nextFrameStartSample > a) throw new RangeError("Adaptive RMS accumulator extends past the complete audio frames");
	await Au(e, r, (s, i) => {
		t.addContiguousFrameRms(i, s);
	}, t.nextFrameStartSample);
	const n = t.finishReferenceHighBucket();
	if (n.nonzeroFrameCount === 0) return ga;
	const o = wp(n.highBits);
	return o !== void 0 ? o : gp(await bp(e, n, r));
}
async function bp(e, t, r) {
	const { histogram: a, highBits: n, indexWithinHighBucket: o } = t;
	a.fill(0), await Au(e, r, (u) => {
		if (u === 0) return;
		const l = Cu(u);
		if (l >>> 16 === n) {
			const c = l & 65535;
			a[c] = a[c] + 1;
		}
	});
	let s = 0, i = 0;
	for (; i < a.length && (s += a[i], !(s > o)); i += 1);
	return wn(n << 16 | i);
}
function wp(e) {
	const t = wn(e << 16);
	if (Math.fround(t * bn) >= ga) return ga;
	const r = wn(e << 16 | 65535);
	if (Math.fround(r * bn) <= ba) return ba;
}
async function yp(e, t, r, a, n) {
	if (Ep(t, r, e.sampleCount), !Number.isFinite(a) || a < 0) throw new RangeError("threshold must be non-negative and finite");
	const o = On * k, s = new Float32Array(o);
	let i = 0, u = t;
	for (; u + k <= r;) {
		Un(n);
		const l = Math.floor((r - u) / k) * k, c = Math.min(o, l);
		await Fn(e, u, s, c);
		for (let d = 0; d < c; d += k) Nn(s, k, d) > a && (i += 1);
		u += c;
	}
	return i * (k / 16e3);
}
function Nn(e, t, r = 0) {
	let a = Math.fround(0);
	for (let n = r; n < r + t; n += 1) {
		const o = e[n];
		a = Math.fround(a + Math.fround(o * o));
	}
	return Math.fround(Math.sqrt(Math.fround(a / t)));
}
async function Au(e, t, r, a = 0) {
	const n = On * k, o = new Float32Array(n), s = Math.floor(e.sampleCount / k) * k;
	if (!Number.isSafeInteger(a) || a < 0 || a > s || a % k !== 0) throw new RangeError("RMS scan start must be a complete-frame sample boundary");
	for (let i = a; i < s; i += n) {
		Un(t);
		const u = Math.min(n, s - i);
		await Fn(e, i, o, u);
		for (let l = 0; l < u; l += k) r(Nn(o, k, l), i + l);
	}
}
const Tu = /* @__PURE__ */ new ArrayBuffer(4), Lu = new Float32Array(Tu), Mu = new Uint32Array(Tu);
function Cu(e) {
	return Lu[0] = e, Mu[0];
}
function wn(e) {
	return Mu[0] = e >>> 0, Lu[0];
}
async function Fn(e, t, r, a) {
	const n = await e.readSamplesInto(t, r, 0, a);
	if (n !== a) throw new RangeError(`PCM reader wrote ${n} samples for a ${a}-sample request`);
}
function Ep(e, t, r) {
	if (!Number.isSafeInteger(e) || !Number.isSafeInteger(t) || e < 0 || t < e || t > r) throw new RangeError("invalid PCM sample range");
}
function Un(e) {
	e?.throwIfAborted();
}
function Sp(e) {
	if (!yn(e) || typeof e.type != "string") return !1;
	switch (e.type) {
		case "initialize": return Oe(e.requestId) && typeof e.reportProgress == "boolean" && vp(e.modelSource) && yn(e.configuration) && $p(e.configuration, [
			"fp16ModelUrl",
			"fp32ModelUrl",
			"wasmUrl"
		]) && typeof e.configuration.fp16ModelUrl == "string" && typeof e.configuration.fp32ModelUrl == "string" && typeof e.configuration.wasmUrl == "string";
		case "transcribe": return Oe(e.jobId) && e.audio instanceof Blob && kp(e.audioDecoding) && typeof e.reportProgress == "boolean" && typeof e.reportPartialResults == "boolean" && typeof e.reportPacedTranscriptBoundary == "boolean" && (!e.reportPacedTranscriptBoundary || e.reportPartialResults);
		case "prepare-stream": return Oe(e.jobId) && e.port instanceof MessagePort && Oe(e.inputByteLength) && (e.estimatedSampleCount === null || Oe(e.estimatedSampleCount));
		case "transcribe-stream": return Oe(e.jobId) && typeof e.reportProgress == "boolean" && typeof e.reportPartialResults == "boolean" && typeof e.reportPacedTranscriptBoundary == "boolean" && (!e.reportPacedTranscriptBoundary || e.reportPartialResults);
		case "discard-stream": return Oe(e.jobId);
		case "cancel": return Oe(e.jobId);
		case "cancel-initialization": return Oe(e.requestId);
		default: return !1;
	}
}
function vp(e) {
	return e === "cache-only" || e === "cache-or-network";
}
function kp(e) {
	return yn(e) && typeof e.applied == "boolean" && gr(e.wallMs) && gr(e.activeMs) && Oe(e.inputByteLength) && Oe(e.outputByteLength) && gr(e.overlapMs) && gr(e.pcmWaitMs) && gr(e.pcmStarvationMs) && Oe(e.pcmStarvationCount);
}
function Pp(e, t = "INTERNAL_ERROR") {
	if (e instanceof Error) {
		const r = e;
		return {
			name: e.name,
			message: e.message,
			code: typeof r.code == "string" ? r.code : t,
			...e.stack === void 0 ? {} : { stack: e.stack }
		};
	}
	return {
		name: "Error",
		message: String(e),
		code: t
	};
}
function yn(e) {
	return typeof e == "object" && e !== null;
}
function $p(e, t) {
	const r = new Set(t);
	return Object.keys(e).every((a) => r.has(a));
}
function Oe(e) {
	return typeof e == "number" && Number.isSafeInteger(e) && e >= 0;
}
function gr(e) {
	return typeof e == "number" && Number.isFinite(e) && e >= 0;
}
function Ss(e, t, r) {
	if (!Number.isFinite(t) || t <= 0) throw new RangeError("sampleRate must be a positive finite number");
	const a = e.map((c) => c.tokenId), n = r.decodeTokenIds(a), o = e.map((c) => ({
		tokenId: c.tokenId,
		startSeconds: c.startSample / t,
		endSeconds: c.endSample / t
	})), s = [];
	let i;
	for (let c = 0; c < e.length; c += 1) {
		const d = e[c], h = r.tokenPiece(e[c].tokenId);
		Bp(h) || (i === void 0 || h === void 0 || Rp(h) ? (i !== void 0 && s.push(i), i = {
			startIndex: c,
			endIndex: c + 1,
			startSample: d.startSample,
			endSample: d.endSample
		}) : i = {
			...i,
			endIndex: c + 1,
			endSample: Math.max(i.endSample, d.endSample)
		});
	}
	i !== void 0 && s.push(i);
	const u = n.trim(), l = u.length === 0 ? [] : u.split(/\s+/u);
	return {
		text: n,
		tokens: o,
		words: l.length === s.length ? s.map((c, d) => vs(l[d], c, t)) : s.flatMap((c) => {
			const d = r.decodeTokenIds(e.slice(c.startIndex, c.endIndex).map((h) => h.tokenId)).trim();
			return d.length === 0 ? [] : [vs(d, c, t)];
		})
	};
}
function vs(e, t, r) {
	return {
		text: e,
		startSeconds: t.startSample / r,
		endSeconds: t.endSample / r
	};
}
function Rp(e) {
	return e.startsWith("▁") || e.startsWith(" ");
}
function Bp(e) {
	return e === "<unk>" || e === "<pad>" || e === "<blank>";
}
const Ap = .999999;
var ks = class {
	#e;
	#t = /* @__PURE__ */ new Map();
	#o = 0;
	#r;
	#a = 0;
	#n;
	#u;
	#s;
	#h = !0;
	#f = 0;
	#c = 0;
	#d = !1;
	constructor(e) {
		const { totalPrimaryWindows: t, batchCapacity: r, primaryWindowsSealed: a = !0 } = e;
		Wt(t, "totalPrimaryWindows"), Mr(r, "batchCapacity"), this.#e = r, this.#r = t, this.#n = a, this.#u = Ha(t, r), this.#s = this.#_(t);
	}
	get fraction() {
		return this.#i();
	}
	get isFinished() {
		return this.#d;
	}
	get totalPrimaryWindowEstimate() {
		return this.#r;
	}
	get primaryWindowsSealed() {
		return this.#n;
	}
	extendPrimaryWindowEstimate(e) {
		if (this.#l(), this.#n) throw new Error("Primary transcription progress is already sealed");
		if (Wt(e, "totalPrimaryWindows"), e < this.#r) throw new RangeError("Provisional primary-window progress can only grow");
		return this.#p(e), this.#i();
	}
	sealPrimaryWindows(e) {
		if (this.#l(), this.#n) throw new Error("Primary transcription progress is already sealed");
		return Wt(e, "totalPrimaryWindows"), this.#p(e), this.#n = !0, this.#i();
	}
	setEstimatedRepairWaves(e) {
		if (this.#l(), !this.#n) throw new Error("Cannot resolve repair progress before primary work is sealed");
		let t = 0;
		for (const r of e) {
			if (!Number.isFinite(r) || r < 0) throw new RangeError("Estimated repair rows must be finite and non-negative");
			t += Ps(r, this.#e);
		}
		return this.#h = !1, this.#s = t, this.#i();
	}
	beginGraph(e) {
		this.#l();
		const { primaryRows: t, repairRows: r } = e;
		Wt(t, "primaryRows"), Wt(r, "repairRows");
		const a = t + r;
		if (a < 1 || a > this.#e) throw new RangeError("Physical graph rows must fit the fixed batch capacity");
		if (r > 0 && !this.#n) throw new Error("Cannot begin repair work before primary progress is sealed");
		if (t > 0) {
			const i = this.#a + t;
			if (i > this.#r) throw new RangeError("Physical primary graph exceeds the planned primary work");
			this.#a = i, this.#u = Ha(this.#r - this.#a, this.#e);
		}
		r > 0 && (this.#h = !1, this.#s = Math.max(0, this.#s - Lt(r)));
		const n = this.#o;
		this.#o += 1;
		const o = {
			weight: Lt(a),
			fraction: 0,
			completedWorkUnits: 0,
			totalWorkUnits: void 0
		};
		this.#t.set(n, o);
		let s = !1;
		return {
			update: (i, u) => {
				if (s) throw new Error("Cannot update completed transcription graph progress");
				if (Mr(u, "totalWorkUnits"), Mr(i, "completedWorkUnits"), i > u || i <= o.completedWorkUnits || o.totalWorkUnits !== void 0 && u !== o.totalWorkUnits) throw new RangeError("Physical graph progress must be contiguous and monotonic");
				return o.completedWorkUnits = i, o.totalWorkUnits = u, o.fraction = i / u, this.#i();
			},
			complete: () => s ? this.#i() : (s = !0, this.#t.delete(n), this.#f += o.weight, this.#i())
		};
	}
	finish() {
		if (this.#l(), !this.#n) throw new Error("Cannot finish transcription progress before primary work is sealed");
		if (this.#t.size !== 0) throw new Error("Cannot finish transcription progress with a graph in flight");
		if (this.#u !== 0) throw new Error("Cannot finish transcription progress before all primary graphs");
		if (this.#s !== 0) throw new Error("Cannot finish transcription progress before repair is resolved");
		return this.#c = 1, this.#d = !0, 1;
	}
	#i() {
		if (this.#d) return 1;
		let e = 0, t = 0;
		for (const o of this.#t.values()) e += o.weight * o.fraction, t += o.weight * (1 - o.fraction);
		const r = this.#f + e, a = r + t + this.#u + this.#s, n = a > 0 ? r / a : 0;
		return this.#c = Math.max(this.#c, Math.min(Ap, n)), this.#c;
	}
	#l() {
		if (this.#d) throw new Error("Transcription progress is already finished");
	}
	#p(e) {
		if (e < this.#a) throw new RangeError("Primary-window total cannot be below registered physical rows");
		this.#r = e, this.#u = Ha(e - this.#a, this.#e), this.#h && (this.#s = this.#_(e));
	}
	#_(e) {
		return e > 1 ? 2 * Ps(Math.min(32, Math.max(1, e / this.#e)), this.#e) : 0;
	}
};
function Lt(e) {
	if (!Number.isFinite(e) || e <= 0) throw new RangeError("Graph rows must be finite and positive");
	return e + 2;
}
function Ha(e, t) {
	if (Wt(e, "rows"), Mr(t, "batchCapacity"), e === 0) return 0;
	const r = Math.floor(e / t), a = e % t;
	return r * Lt(t) + (a === 0 ? 0 : Lt(a));
}
function Ps(e, t) {
	if (!Number.isFinite(e) || e < 0) throw new RangeError("Estimated graph rows must be finite and non-negative");
	if (Mr(t, "batchCapacity"), e === 0) return 0;
	if (e < 1) return e * Lt(1);
	const r = Math.floor(e / t), a = e - r * t;
	return r * Lt(t) + (a === 0 ? 0 : Lt(a));
}
function Wt(e, t) {
	if (!Number.isSafeInteger(e) || e < 0) throw new RangeError(`${t} must be a non-negative safe integer`);
}
function Mr(e, t) {
	if (!Number.isSafeInteger(e) || e <= 0) throw new RangeError(`${t} must be a positive safe integer`);
}
var Tp = class {
	postMessage;
	engineFactory;
	now;
	engine;
	initialization;
	active;
	preparedStream;
	initializationStartedAtMs;
	initializationEndedAtMs;
	constructor(e) {
		this.postMessage = e.postMessage, this.engineFactory = e.engineFactory, this.now = e.now ?? Mp;
	}
	async handleMessage(e) {
		if (!Sp(e)) {
			this.postRuntimeError(new Se("INVALID_MESSAGE", "Worker received an invalid Parakeet protocol message"));
			return;
		}
		switch (e.type) {
			case "initialize":
				await this.initialize(e);
				return;
			case "transcribe":
				await this.transcribe(e.jobId, e.audio, e.audioDecoding, e.reportProgress, e.reportPartialResults, e.reportPacedTranscriptBoundary);
				return;
			case "prepare-stream":
				this.prepareStream(e.jobId, e.port, e.inputByteLength, e.estimatedSampleCount);
				return;
			case "transcribe-stream":
				await this.transcribeStream(e.jobId, e.reportProgress, e.reportPartialResults, e.reportPacedTranscriptBoundary);
				return;
			case "discard-stream":
				this.discardStream(e.jobId);
				return;
			case "cancel-initialization":
				this.cancelInitialization(e.requestId);
				return;
			case "cancel":
				this.cancel(e.jobId);
				return;
		}
	}
	async initialize(e) {
		if (this.engine !== void 0 || this.initialization !== void 0) {
			this.postRuntimeError(new Se("ALREADY_INITIALIZED", "Parakeet worker is already initialized or loading"), { requestId: e.requestId });
			return;
		}
		const t = {
			requestId: e.requestId,
			controller: new AbortController()
		};
		this.initialization = t, this.initializationStartedAtMs = Ka();
		try {
			const r = await this.engineFactory(e.configuration, {
				modelSource: e.modelSource,
				signal: t.controller.signal,
				...e.reportProgress ? { onProgress: (n) => {
					this.initialization === t && this.postMessage({
						type: "load-progress",
						requestId: e.requestId,
						progress: n
					});
				} } : {}
			});
			let a = !1;
			try {
				t.controller.signal.throwIfAborted(), $s(r.preferredBatchSize), $s(r.maxInFlightBatches);
				const n = r.diagnostics.fbankHopSamples;
				if (n !== 160) throw new Se("ENGINE_TIMELINE_MISMATCH", `Engine reported FBank hop ${String(n)}; expected ${String(160)}`);
				this.engine = r, a = !0, this.postMessage({
					type: "ready",
					requestId: e.requestId,
					diagnostics: Object.freeze({
						...r.diagnostics,
						windowSeconds: 15,
						windowSamples: kt,
						primaryVisibleSamples: ct,
						primaryContextSamples: Nr,
						windowStrideSamples: Ht,
						overlapSeconds: 2,
						overlapSamples: jt,
						repairVisibleSamples: Er,
						seamGapRepairMinFrames: xn,
						seamGapRepairMaxProbes: 32,
						seamGapRepairMaxRounds: 3,
						fbankHopSamples: 160,
						encoderFrameSamples: k
					})
				});
			} finally {
				a || await r.dispose();
			}
		} catch (r) {
			t.controller.signal.aborted ? this.postMessage({
				type: "initialization-cancelled",
				requestId: e.requestId
			}) : this.postRuntimeError(r, { requestId: e.requestId });
		} finally {
			this.initializationEndedAtMs = Ka(), this.initialization === t && (this.initialization = void 0);
		}
	}
	cancelInitialization(e) {
		const t = this.initialization;
		t?.requestId === e && t.controller.abort(new DOMException("Parakeet model loading was cancelled", "AbortError"));
	}
	prepareStream(e, t, r, a) {
		if (this.preparedStream !== void 0 || this.active !== void 0) {
			t.close(), this.postRuntimeError(new Se("BUSY", "Parakeet worker already has a prepared audio stream"), { jobId: e });
			return;
		}
		const n = {
			jobId: e,
			reader: new up(t),
			inputByteLength: r,
			estimatedSampleCount: a,
			failure: void 0,
			failureReported: !1
		};
		this.preparedStream = n, n.reader.waitForEnd().catch((o) => {
			n.failure = o, this.preparedStream === n && this.active === void 0 && !n.failureReported && (n.failureReported = !0, this.postRuntimeError(o, { jobId: e }));
		});
	}
	discardStream(e) {
		const t = this.preparedStream;
		t?.jobId !== e || this.active?.jobId === e || this.releasePreparedStream(t);
	}
	releasePreparedStream(e) {
		this.preparedStream === e && (this.preparedStream = void 0), e.reader.dispose();
	}
	async transcribeStream(e, t, r, a) {
		const n = this.preparedStream;
		if (n?.jobId !== e) {
			this.postRuntimeError(new Se("AUDIO_STREAM_NOT_PREPARED", "Parakeet streaming audio was not prepared"), { jobId: e });
			return;
		}
		if (n.failure !== void 0) {
			n.failureReported || (n.failureReported = !0, this.postRuntimeError(n.failure, { jobId: e })), this.releasePreparedStream(n);
			return;
		}
		if (this.engine === void 0) {
			this.postRuntimeError(new Se("ENGINE_NOT_INITIALIZED", "Parakeet inference engine is not initialized"), { jobId: e }), this.releasePreparedStream(n);
			return;
		}
		if (this.active !== void 0) {
			this.postRuntimeError(new Se("BUSY", `Transcription job ${this.active.jobId} is already running`), { jobId: e }), this.releasePreparedStream(n);
			return;
		}
		const o = new AbortController(), s = {
			jobId: e,
			controller: o
		};
		this.active = s;
		try {
			await this.runStreamingTranscription(e, n, o.signal, this.engine, t, r, a);
		} catch (i) {
			o.signal.aborted || Rs(i) ? this.postMessage({
				type: "cancelled",
				jobId: e
			}) : n.failureReported || (n.failureReported = !0, this.postRuntimeError(i, { jobId: e }));
		} finally {
			this.active === s && (this.active = void 0), this.releasePreparedStream(n);
		}
	}
	async transcribe(e, t, r, a, n, o) {
		if (this.engine === void 0) {
			this.postRuntimeError(new Se("ENGINE_NOT_INITIALIZED", "Parakeet inference engine is not initialized"), { jobId: e });
			return;
		}
		if (this.active !== void 0) {
			this.postRuntimeError(new Se("BUSY", `Transcription job ${this.active.jobId} is already running`), { jobId: e });
			return;
		}
		const s = new AbortController(), i = {
			jobId: e,
			controller: s
		};
		this.active = i;
		try {
			await this.runTranscription(e, t, r, s.signal, this.engine, a, n, o);
		} catch (u) {
			s.signal.aborted || Rs(u) ? this.postMessage({
				type: "cancelled",
				jobId: e
			}) : this.postRuntimeError(u, { jobId: e });
		} finally {
			this.active === i && (this.active = void 0);
		}
	}
	async runStreamingTranscription(e, t, r, a, n, o, s) {
		await this.runTranscription(e, new Blob(), {
			applied: !0,
			wallMs: 0,
			activeMs: 0,
			inputByteLength: t.inputByteLength,
			outputByteLength: 0,
			overlapMs: 0,
			pcmWaitMs: 0,
			pcmStarvationMs: 0,
			pcmStarvationCount: 0
		}, r, a, n, o, s, t);
	}
	async runTranscription(e, t, r, a, n, o, s, i, u) {
		const l = this.now(), c = Ka(), d = () => j(this.now(), l);
		let h = 0, f = 0, p = 0, _ = 0, b = 0, w = 0, g = 0, y = 0, B = 0, P = 0, x = 0, A = 0, T = 0, L = 0, ae = 0, H = 0, W = 0, v = 0, V = 0, de = 0, _e = 0, q = 0;
		const F = [];
		let we = 0, Z = 0, Ae = 0, ne = 0, ye = 0;
		const Le = (m) => {
			o && this.postMessage({
				type: "progress",
				jobId: e,
				progress: m
			});
		};
		o && Le({
			phase: "transcribing",
			fraction: 0,
			metrics: Va({
				audioDecoding: r,
				audioDurationSeconds: 0,
				processedAudioSeconds: g,
				elapsedMs: d(),
				audioReadMs: h,
				inferenceMs: f,
				frontendMs: p,
				encoderMs: _,
				decoderMs: b,
				completedWindows: w,
				totalWindows: 0,
				repairGapProbes: y,
				repairWindowDecodes: B,
				repairRounds: P,
				recoveredTokens: x
			})
		}), ze(a), await n.beginTranscription(), ze(a);
		const sr = this.now(), se = u === void 0 ? await ju.open(t) : u.reader;
		h += j(this.now(), sr), ze(a);
		const Gn = () => {
			if (u === void 0) return r;
			const m = u.reader.decoderTimings;
			if (m === void 0) throw new Se("AUDIO_STREAM_INCOMPLETE", "Streaming decoder completed without final timing metadata");
			const E = Bs(m.decoderStartedAtMs, m.decoderEndedAtMs, this.initializationStartedAtMs, this.initializationEndedAtMs), S = Bs(m.decoderStartedAtMs, m.decoderEndedAtMs, c, m.decoderEndedAtMs);
			return {
				applied: !0,
				wallMs: m.decoderWallMs,
				activeMs: m.decoderActiveMs,
				inputByteLength: u.inputByteLength,
				outputByteLength: u.reader.sampleCount * Int16Array.BYTES_PER_ELEMENT,
				overlapMs: Math.min(m.decoderWallMs, E + S),
				pcmWaitMs: Ae,
				pcmStarvationMs: ne,
				pcmStarvationCount: ye
			};
		};
		let ir = [], Pe = 0, at = 0, Ur = Number.MAX_SAFE_INTEGER, ee;
		if (u === void 0) {
			const m = this.now(), E = await ys(se, a);
			A = j(this.now(), m), h += A, ze(a), ir = Zs(se.sampleCount, E), Pe = ir.length, Ur = Pe, at = se.sampleCount / se.sampleRate, ee = o ? new ks({
				totalPrimaryWindows: Pe,
				batchCapacity: n.preferredBatchSize
			}) : void 0;
		} else o && (ee = new ks({
			totalPrimaryWindows: u.estimatedSampleCount === null || u.estimatedSampleCount === 0 ? 0 : 1 + Math.max(0, Math.ceil((u.estimatedSampleCount - ct) / Ht)),
			batchCapacity: n.preferredBatchSize,
			primaryWindowsSealed: !1
		}));
		let ya = -1;
		const Iu = () => Va({
			audioDecoding: r,
			audioDurationSeconds: at,
			processedAudioSeconds: g,
			elapsedMs: d(),
			audioReadMs: h,
			inferenceMs: f,
			frontendMs: p,
			encoderMs: _,
			decoderMs: b,
			completedWindows: w,
			totalWindows: Pe,
			repairGapProbes: y,
			repairWindowDecodes: B,
			repairRounds: P,
			recoveredTokens: x
		}), he = (m = !1) => {
			if (!o || ee === void 0) return;
			const E = ee.fraction;
			!m && E <= ya || (ya = Math.max(ya, E), Le({
				phase: "transcribing",
				fraction: E,
				metrics: Iu()
			}));
		};
		he(!0);
		const Gr = new Nc({ tokenPiece: (m) => n.tokenPiece(m) }), Wn = (m, E, S) => {
			const M = Ss(m, se.sampleRate, n);
			q += 1, this.postMessage({
				type: "partial-result",
				jobId: e,
				snapshot: {
					revision: q,
					...M,
					audioDurationSeconds: at,
					processedAudioSeconds: E
				}
			}), de += j(this.now(), S);
		}, Wr = new mp();
		let qn = u === void 0 ? Math.floor(se.sampleCount / k) * k : Number.MAX_SAFE_INTEGER, Ea = Pe, Sa;
		const qr = /* @__PURE__ */ new Map(), ur = /* @__PURE__ */ new Set(), va = /* @__PURE__ */ new Map(), ka = /* @__PURE__ */ new Set(), Dn = /* @__PURE__ */ new Map(), Dr = (m, E) => {
			const S = this.now(), M = m.map((D) => ({
				probe: D,
				plan: bs(se.sampleCount, D.gap, E, Ea++)
			})).sort((D, O) => D.plan.sourceStartSample - O.plan.sourceStartSample || D.probe.id - O.probe.id);
			return v += j(this.now(), S), M;
		}, zn = (m, E) => m.map((S, M) => ({
			probe: S,
			plan: bs(se.sampleCount, S.gap, E, Ea + M)
		})), xu = (m) => {
			let E = 0, S = 0, M = 0, D = 0;
			for (const z of m) {
				if (z.index < Ur) {
					E += 1;
					continue;
				}
				const I = va.get(Ce(z));
				I === "final-primary" ? M += 1 : I === "cross-round" ? D += 1 : S += 1;
			}
			const O = S + M + D;
			return {
				batchClass: E === 0 ? "repair" : O === 0 ? "primary" : "mixed",
				activeRows: m.length,
				primaryRows: E,
				repairRows: O,
				officialRepairRows: S,
				finalPrimaryPrefetchRows: M,
				crossRoundPrefetchRows: D
			};
		}, Ou = (m) => {
			if (m.index >= Ur) return;
			const E = Wr.nextFrameStartSample, S = Math.min(m.sourceEndSample, qn);
			if (E < m.sourceStartSample || E + k > S) return;
			const M = Math.floor((S - E) / k);
			return {
				sampleOffset: E - m.sourceStartSample,
				frameCount: M
			};
		}, Ct = [];
		let Pa = 0, $a;
		const jn = () => {
			const m = this.now();
			return Pa -= 1, $a = Math.max($a ?? m, m), m;
		}, Hn = async (m) => {
			const { decodedBatch: E, completedAt: S } = await m.result, M = j(S, m.submissionStartedAt);
			if (ze(a), E.length !== m.batch.length) throw new Se("ENGINE_BATCH_RESULT_MISMATCH", `Parakeet engine returned ${E.length} results for a batch of ${m.batch.length} windows`);
			let D = 0, O = 0, z = 0;
			for (const I of E) {
				const C = Gt(I.timings?.frontendMs), U = Gt(I.timings?.encoderMs), ie = Gt(I.timings?.decoderMs);
				O += C, z += U + ie, D += C + U + ie;
			}
			f += D === 0 ? M : D, m.retainTimelineRecord && F.push({
				submissionIndex: m.submissionIndex,
				...m.rows,
				preparationStartedOffsetMs: j(m.preparationStartedAt, l),
				submissionStartedOffsetMs: j(m.submissionStartedAt, l),
				completionOffsetMs: j(S, l),
				preparationMs: j(m.submissionStartedAt, m.preparationStartedAt),
				submissionToCompletionMs: M,
				frontendMs: O,
				gpuIntervalMs: z
			}), m.progress?.complete(), he();
			for (let I = 0; I < m.batch.length; I += 1) {
				const C = E[I];
				p += Gt(C.timings?.frontendMs), _ += Gt(C.timings?.encoderMs), b += Gt(C.timings?.decoderMs);
				const U = {
					window: m.batch[I],
					decoded: C
				};
				m.executedWindows.push(U), m.onWindow?.(U);
			}
			m.onBatch?.();
		}, Nu = async () => {
			for (; Ct.length > 0;) await Hn(Ct.shift());
		}, Vn = async () => {
			await Promise.all(Ct.splice(0).map(async (m) => {
				try {
					await m.result;
				} catch {}
			}));
		}, It = async (m, E, S, M = !0) => {
			const D = [];
			try {
				for (let O = 0; O < m.length; O += n.preferredBatchSize) {
					const z = m.slice(O, O + n.preferredBatchSize), I = this.now(), C = z[0].windowSampleCount, U = n.prepareWindowBatch(z.length, C);
					if (U.samples.length !== C) throw new Se("ENGINE_INPUT_STORAGE_MISMATCH", `Engine prepared ${U.samples.length} samples for a ${C}-sample reusable window`);
					const ie = [];
					try {
						for (let K = 0; K < z.length; K += 1) {
							ze(a);
							const me = z[K], Rt = U.samples;
							me.readSampleCount < C && Rt.fill(0, me.readSampleCount);
							const Du = this.now(), eo = await se.readSamplesInto(me.sourceStartSample, Rt, 0, me.readSampleCount);
							if (eo !== me.readSampleCount) throw new RangeError(`PCM reader wrote ${eo} samples for a ${me.readSampleCount}-sample request`);
							h += j(this.now(), Du), ze(a);
							const zr = Ou(me), jr = U.commit(me, K, zr);
							if (zr !== void 0 && jr !== void 0) {
								if (!(jr instanceof Uint32Array) || jr.length !== zr.frameCount) throw new Se("ENGINE_RMS_RESULT_MISMATCH", `Parakeet engine returned an invalid RMS result for window ${me.index}`);
								Wr.addContiguousFrameBits(me.sourceStartSample + zr.sampleOffset, jr);
							}
							ie.push({
								...me,
								samples: Rt
							});
						}
						await U.finish();
					} catch (K) {
						try {
							await U.abort();
						} catch (me) {
							throw new AggregateError([K, me], "Prepared FBank batch failed and could not be aborted");
						}
						throw K;
					}
					const Ge = Z;
					Z += 1;
					const We = xu(z), $e = ee?.beginGraph({
						primaryRows: We.primaryRows,
						repairRows: We.repairRows
					});
					he();
					const qe = Ge < 11;
					qe || (we += 1);
					const fe = this.now();
					let $t = 0, Y;
					const oe = o ? (K) => {
						if (!Number.isSafeInteger(K.completedWorkUnits) || !Number.isSafeInteger(K.totalWorkUnits) || K.totalWorkUnits < 1 || K.completedWorkUnits < 1 || K.completedWorkUnits > K.totalWorkUnits || K.completedWorkUnits <= $t || Y !== void 0 && K.totalWorkUnits !== Y) throw new Se("ENGINE_PROGRESS_MISMATCH", "Parakeet engine returned invalid batch execution progress");
						Y = K.totalWorkUnits, $t = K.completedWorkUnits, $e?.update(K.completedWorkUnits, K.totalWorkUnits), he();
					} : void 0, pe = n.transcribeWindows(ie, a, oe);
					Pa += 1;
					const Ee = {
						batch: ie,
						rows: We,
						progress: $e,
						submissionIndex: Ge,
						retainTimelineRecord: qe,
						preparationStartedAt: I,
						submissionStartedAt: fe,
						result: pe.then((K) => ({
							decodedBatch: K,
							completedAt: jn()
						}), (K) => {
							throw jn(), K;
						}),
						executedWindows: D,
						onWindow: E,
						onBatch: S
					};
					Ct.push(Ee), Ct.length >= n.maxInFlightBatches && await Hn(Ct.shift());
				}
				M && await Nu();
			} catch (O) {
				throw await Vn(), O;
			}
			return D;
		}, nt = (m) => {
			const E = /* @__PURE__ */ new Map();
			for (const { plan: S } of m) {
				const M = Ce(S);
				!qr.has(M) && !E.has(M) && E.set(M, S);
			}
			return [...E.values()].sort((S, M) => S.sourceStartSample - M.sourceStartSample || S.index - M.index);
		}, Kn = async (m) => {
			const E = nt(m);
			if (E.length === 0) return;
			const S = await It(E);
			B += S.length;
			for (const { window: M, decoded: D } of S) qr.set(Ce(M), D.tokens);
		}, Yn = (m) => {
			const E = this.now(), S = /* @__PURE__ */ new Map();
			for (const { probe: M, plan: D } of m) {
				const O = Ce(D), z = qr.get(O);
				if (z === void 0) throw new Se("ENGINE_REPAIR_RESULT_MISMATCH", `Missing repair result for window ${D.index}`);
				ur.has(O) && ka.add(O), S.set(M.id, fp(z, M.gap, (I) => n.tokenPiece(I)));
			}
			return V += j(this.now(), E), S;
		}, Ra = async (m, E) => {
			const S = `${m.startSample}:${m.endSample}`, M = Dn.get(S);
			if (M !== void 0) return M;
			const D = this.now(), O = await yp(se, m.startSample, m.endSample, E, a), z = j(this.now(), D);
			return h += z, L += z, Dn.set(S, O), O;
		}, Ba = (m, E) => hp(m, E, se.sampleCount, (S) => n.tokenPiece(S)), lr = ({ window: m, decoded: E }) => {
			const S = this.now();
			Gr.append({
				index: m.index,
				startSample: m.logicalStartSample,
				endSample: m.logicalEndSample,
				tokens: E.tokens
			}), ae += j(this.now(), S), w += 1, g = m.logicalEndSample / se.sampleRate;
		}, cr = () => {
			if (!(!o && !s)) {
				if (u !== void 0 && (at = u.reader.availableSampleCount / se.sampleRate), s) {
					const m = this.now();
					Wn(Gr.snapshot().tokens, g, m);
				}
				he(!0);
			}
		};
		let dr = ir;
		if (u !== void 0) try {
			const m = u.reader, E = new Cc(), S = [], M = () => {
				if (ee === void 0) return;
				const I = E.plannedWindowCount, C = ee.totalPrimaryWindowEstimate, U = !m.ended && I >= C, ie = Math.max(C, I + (U ? n.preferredBatchSize : 0));
				ie !== C && (ee.extendPrimaryWindowEstimate(ie), he());
			};
			for (; !m.ended;) {
				for (S.push(...E.takeStablePrefix(m.availableSampleCount)); S.length >= n.preferredBatchSize;) {
					const ie = S.splice(0, n.preferredBatchSize);
					M(), await It(ie, lr, cr, !1);
				}
				if (m.ended) break;
				const I = (E.plannedWindowCount + (n.preferredBatchSize - S.length) - 1) * Ht + ct + 1, C = this.now();
				await m.waitForSamples(I, a);
				const U = this.now();
				if (Ae += j(U, C), Pa === 0) {
					const ie = j(U, Math.max(C, $a ?? C));
					ie > 0 && (ne += ie, ye += 1);
				}
				ze(a);
			}
			for (S.push(...E.takeStablePrefix(m.availableSampleCount)); S.length >= n.preferredBatchSize;) {
				const I = S.splice(0, n.preferredBatchSize);
				M(), await It(I, lr, cr, !1);
			}
			const D = this.now(), O = await ys(se, a);
			A = j(this.now(), D), h += A, ze(a);
			const z = E.finish(se.sampleCount, O);
			ir = z.allPlans, Pe = ir.length, Ur = Pe, at = se.sampleCount / se.sampleRate, qn = Math.floor(se.sampleCount / k) * k, Ea = Pe, r = Gn(), dr = [...S, ...z.remainingPlans], ee !== void 0 && (ee.sealPrimaryWindows(Pe), he(!0));
		} catch (m) {
			throw await Vn(), m;
		}
		const Aa = Pe % n.preferredBatchSize;
		if (!(Aa > 0 && Pe > 2 * n.preferredBatchSize)) await It(dr, lr, cr);
		else {
			const m = dr.length - Aa;
			await It(dr.slice(0, m), lr, cr);
			const E = this.now(), S = Gr.snapshot();
			H += j(this.now(), E);
			let M = [];
			if (S.tokens.length > 1) {
				const I = this.now();
				Sa = await Es(se, Wr, a);
				const C = j(this.now(), I);
				h += C, T += C;
				const U = Math.min(32, n.preferredBatchSize - Aa), ie = this.now(), Ge = L, We = /* @__PURE__ */ new Set(), $e = [];
				for (let qe = 0; qe + 1 < S.tokens.length && $e.length < U; qe += 1) {
					const fe = Ba(S.tokens, qe);
					fe === void 0 || We.has(fe.startFrame) || await Ra(fe, Sa) < .5 || (We.add(fe.startFrame), $e.push({
						id: -($e.length + 1),
						gap: fe
					}));
				}
				v += Math.max(0, j(this.now(), ie) - (L - Ge)), M = Dr($e, "gap-start");
			}
			const D = dr.slice(m), O = nt(M);
			if (ee !== void 0 && M.length > 0) {
				const I = new Set(O.map(Ce)), C = nt(zn(M.map(({ probe: U }) => U), "centered")).filter((U) => !I.has(Ce(U))).length;
				ee.setEstimatedRepairWaves([O.length, C]), he();
			}
			for (const I of O) {
				const C = Ce(I);
				ur.add(C), va.set(C, "final-primary");
			}
			const z = await It([...D, ...O], (I) => {
				I.window.index < Pe && lr(I);
			}, cr);
			for (const { window: I, decoded: C } of z) I.index < Pe || (B += 1, qr.set(Ce(I), C.tokens));
		}
		ze(a), i && this.postMessage({
			type: "paced-transcript-flush",
			jobId: e
		}), g = at, he(!0);
		const Fu = this.now(), Uu = Gr.snapshot();
		W = j(this.now(), Fu);
		let Zn = W, ot = [...Uu.tokens], Xn = 0;
		if (w > 1 && ot.length > 1) {
			const m = this.now();
			he(!0);
			let E = Sa;
			if (E === void 0) {
				const O = this.now();
				E = await Es(se, Wr, a);
				const z = j(this.now(), O);
				h += z, T += z;
			}
			const S = /* @__PURE__ */ new Set();
			let M = 0;
			const D = async (O, z, I, C) => {
				const U = n.preferredBatchSize - I, ie = 32 - y;
				if (C + 1 >= 3 || I === 0 || U <= 0 || ie <= 0) return [];
				const Ge = this.now(), We = L, $e = z.flatMap(({ id: pe }) => {
					const Ee = O.get(pe) ?? [];
					return Ee.length > 0 ? [...Ee] : [];
				});
				if ($e.length === 0) return v += j(this.now(), Ge), [];
				const qe = new Set($e), fe = [...ot, ...$e];
				fe.sort((pe, Ee) => pe.startSample - Ee.startSample);
				const $t = new Set(S), Y = Math.min(U, ie), oe = [];
				for (let pe = 0; pe + 1 < fe.length && oe.length < Y; pe += 1) {
					if (!qe.has(fe[pe]) && !qe.has(fe[pe + 1])) continue;
					const Ee = Ba(fe, pe);
					Ee === void 0 || $t.has(Ee.startFrame) || await Ra(Ee, E) < .5 || ($t.add(Ee.startFrame), oe.push({
						id: -(oe.length + 1),
						gap: Ee
					}));
				}
				return v += Math.max(0, j(this.now(), Ge) - (L - We)), Dr(oe, "gap-start");
			};
			for (let O = 0; O < 3 && y < 32; O += 1) {
				const z = this.now(), I = L, C = [];
				for (let Y = 0; Y + 1 < ot.length && y < 32; Y += 1) {
					const oe = Ba(ot, Y);
					oe === void 0 || S.has(oe.startFrame) || await Ra(oe, E) < .5 || (S.add(oe.startFrame), y += 1, C.push({
						id: M++,
						gap: oe
					}));
				}
				if (v += Math.max(0, j(this.now(), z) - (L - I)), C.length === 0) {
					ee?.setEstimatedRepairWaves([]), he(!0);
					break;
				}
				P += 1;
				const U = Dr(C, "gap-start"), ie = O + 1 < 3 && y < 32;
				if (ee !== void 0) {
					const Y = nt(U), oe = new Set(Y.map(Ce)), pe = nt(zn(C, "centered")).filter((Ee) => !oe.has(Ce(Ee))).length;
					ee.setEstimatedRepairWaves([Y.length, pe]), he();
				}
				await Kn(U);
				const Ge = Yn(U), We = C.filter(({ id: Y }) => (Ge.get(Y)?.length ?? 0) === 0);
				let $e = /* @__PURE__ */ new Map();
				if (We.length > 0) {
					const Y = Dr(We, "centered"), oe = nt(Y).length;
					ee?.setEstimatedRepairWaves([oe]), he();
					const pe = await D(Ge, C, oe, O), Ee = new Set(nt(Y).map((me) => Ce(me)));
					for (const me of nt(pe)) {
						const Rt = Ce(me);
						Ee.has(Rt) || (ur.add(Rt), va.set(Rt, "cross-round"));
					}
					const K = [...Y, ...pe];
					ee?.setEstimatedRepairWaves([nt(K).length]), he(), await Kn(K), $e = Yn(Y);
				} else ee?.setEstimatedRepairWaves([]), he();
				const qe = this.now(), fe = [];
				for (const Y of C) {
					const oe = Ge.get(Y.id) ?? [], pe = oe.length > 0 ? oe : $e.get(Y.id) ?? [];
					fe.push(...pe);
				}
				if (V += j(this.now(), qe), fe.length === 0) {
					ee?.setEstimatedRepairWaves([]), he(!0);
					break;
				}
				x += fe.length;
				const $t = this.now();
				if (ot = [...ot, ...fe], ot.sort((Y, oe) => Y.startSample - oe.startSample), V += j(this.now(), $t), s) {
					const Y = this.now();
					Wn(ot, at, Y);
				}
				ee?.setEstimatedRepairWaves(ie ? [1, 1] : []), he(!0);
			}
			Xn = j(this.now(), m);
		} else ee?.setEstimatedRepairWaves([]);
		ee?.setEstimatedRepairWaves([]), he(!0);
		const Gu = this.now(), Wu = Ss(ot, se.sampleRate, n);
		_e = j(this.now(), Gu), Zn += ae + _e, ze(a);
		const Qn = d();
		u !== void 0 && (r = Gn()), F.sort((m, E) => m.submissionIndex - E.submissionIndex);
		const qu = {
			trailingSpeechScanMs: A,
			adaptiveThresholdScanMs: T,
			gapEnergyScanMs: L,
			incrementalStitchMs: ae,
			prefixStitchMs: H,
			finalStitchMs: W,
			repairPlanningMs: v,
			repairSplicingMs: V,
			partialResultMs: de,
			tokenDecodeMs: _e
		}, Jn = {
			...Va({
				audioDecoding: r,
				audioDurationSeconds: at,
				processedAudioSeconds: at,
				elapsedMs: Qn,
				audioReadMs: h,
				inferenceMs: f,
				frontendMs: p,
				encoderMs: _,
				decoderMs: b,
				completedWindows: w,
				totalWindows: Pe,
				repairGapProbes: y,
				repairWindowDecodes: B,
				repairRounds: P,
				recoveredTokens: x
			}),
			stitchingMs: Zn,
			repairMs: Xn,
			repairPrefetchWindowDecodes: ur.size,
			repairPrefetchCacheHits: ka.size,
			repairPrefetchUnusedDecodes: ur.size - ka.size,
			batchSubmissionTimeline: F,
			batchSubmissionTimelineOmitted: we,
			phaseTimings: qu,
			totalMs: Qn
		};
		o && Le({
			phase: "done",
			fraction: ee.finish(),
			metrics: Jn
		}), this.postMessage({
			type: "result",
			jobId: e,
			result: {
				...Wu,
				metrics: Jn
			}
		});
	}
	cancel(e) {
		this.active?.jobId === e && this.active.controller.abort();
	}
	postRuntimeError(e, t = {}) {
		this.postMessage({
			type: "error",
			...t.requestId === void 0 ? {} : { requestId: t.requestId },
			...t.jobId === void 0 ? {} : { jobId: t.jobId },
			error: Pp(e)
		});
	}
};
function Lp(e, t) {
	const r = new Tp({
		postMessage: (a) => e.postMessage(a),
		engineFactory: t
	});
	return e.addEventListener("message", (a) => {
		r.handleMessage(a.data);
	}), r;
}
var Se = class extends Error {
	code;
	constructor(e, t) {
		super(t), this.name = "ParakeetRuntimeError", this.code = e;
	}
};
function Va(e) {
	const t = e.elapsedMs <= 0 ? 0 : e.processedAudioSeconds / (e.elapsedMs / 1e3);
	return {
		...e,
		speedFactor: t
	};
}
function Mp() {
	return performance.now();
}
function j(e, t) {
	return Math.max(0, e - t);
}
function Gt(e) {
	return e !== void 0 && Number.isFinite(e) && e >= 0 ? e : 0;
}
function $s(e) {
	if (!Number.isSafeInteger(e) || e <= 0) throw new Se("INVALID_ENGINE_BATCH_SIZE", "Parakeet engine preferredBatchSize must be a positive safe integer");
}
function ze(e) {
	e.throwIfAborted();
}
function Rs(e) {
	return e instanceof Error && e.name === "AbortError";
}
function Ka() {
	return performance.timeOrigin + performance.now();
}
function Bs(e, t, r, a) {
	return r === void 0 || a === void 0 ? 0 : Math.max(0, Math.min(t, a) - Math.max(e, r));
}
Lp(globalThis, Yf);
