const Fe = "parakeet-wgsl-audio-decoding";
async function Qt() {
	if (en()) try {
		const v = await (await navigator.storage.getDirectory()).getDirectoryHandle(Fe), l = v, R = Date.now() - 864e5;
		for await (const [T, z] of l.entries()) {
			if (z.kind !== "directory") continue;
			const b = Number.parseInt(T.split("-", 1)[0] ?? "", 10);
			Number.isFinite(b) && b < R && await v.removeEntry(T, { recursive: !0 }).catch(() => {});
		}
	} catch (v) {
		if (rn(v)) return;
		console.warn("[parakeet.wgsl] Failed to remove stale audio-decoding scratch data", v);
	}
}
function en() {
	return typeof navigator < "u" && navigator.storage !== void 0 && typeof navigator.storage.getDirectory == "function";
}
function rn(v) {
	return v instanceof DOMException && v.name === "NotFoundError";
}
async function Je(v = {}) {
	var l = v, R = !1, T = !0;
	const z = 0, b = Uint32Array.BYTES_PER_ELEMENT, P = [
		"./ffmpeg",
		"-nostdin",
		"-y"
	];
	l.NULL = z, l.SIZE_I32 = b, l.DEFAULT_ARGS = P, l.ret = -1, l.timeout = -1, l.logger = () => {}, l.progress = () => {};
	function B(e) {
		const r = l.lengthBytesUTF8(e) + 1, t = l._malloc(r);
		return l.stringToUTF8(e, t, r), t;
	}
	function U(e) {
		const r = [], t = l._malloc(e.length * b);
		for (let o = 0; o < e.length; o += 1) {
			const a = B(e[o]);
			r.push(a), l.setValue(t + b * o, a, "i32");
		}
		return {
			ptr: t,
			pointers: r
		};
	}
	function q(e) {
		l.logger({
			type: "stdout",
			message: e
		});
	}
	function ae(e) {
		e.startsWith("Aborted(native code called abort())") || l.logger({
			type: "stderr",
			message: e
		});
	}
	function x(...e) {
		const r = [...P, ...e], t = U(r);
		try {
			l._ffmpeg(r.length, t.ptr);
		} catch (o) {
			if (!(o instanceof Error) || !o.message.startsWith("Aborted")) throw o;
		} finally {
			for (const o of t.pointers) l._free(o);
			l._free(t.ptr);
		}
		return l.ret;
	}
	function ve(e) {
		l.logger = e;
	}
	function he(e) {
		l.timeout = e;
	}
	function tr(e) {
		l.progress = e;
	}
	function nr(e, r) {
		l.progress({
			progress: e,
			time: r
		});
	}
	function or() {
		l.ret = -1, l.timeout = -1;
	}
	function ar(e, r) {
		if (!r || typeof r.read != "function" || typeof r.write != "function" || typeof r.truncate != "function" || typeof r.getSize != "function" || typeof r.flush != "function" || typeof r.close != "function") throw new TypeError("Expected a FileSystemSyncAccessHandle");
		r.truncate(0);
		try {
			n.unlink(e);
		} catch (a) {
			if (!(a instanceof n.ErrnoError)) throw a;
		}
		n.writeFile(e, /* @__PURE__ */ new Uint8Array(0));
		const t = n.lookupPath(e).node, o = t.node_ops;
		t.usedBytes = 0, t.contents = /* @__PURE__ */ new Uint8Array(0), t.node_ops = {
			...o,
			setattr(a, i) {
				for (const s of [
					"mode",
					"atime",
					"mtime",
					"ctime"
				]) i[s] !== void 0 && (a[s] = i[s]);
				i.size !== void 0 && (r.truncate(i.size), a.usedBytes = i.size);
			}
		}, t.stream_ops = {
			close() {
				r.flush();
			},
			read(a, i, s, f, c) {
				const u = r.read(i.subarray(s, s + f), { at: c });
				return u > 0 && (a.node.atime = Date.now()), u;
			},
			write(a, i, s, f, c) {
				const u = r.write(i.subarray(s, s + f), { at: c });
				return a.node.usedBytes = Math.max(a.node.usedBytes, c + u), a.node.mtime = a.node.ctime = Date.now(), u;
			},
			allocate(a, i, s) {
				const f = i + s;
				f > a.node.usedBytes && (r.truncate(f), a.node.usedBytes = f, a.node.mtime = a.node.ctime = Date.now());
			},
			fsync() {
				return r.flush(), 0;
			},
			llseek(a, i, s) {
				let f;
				if (s === 0) f = i;
				else if (s === 1) f = a.position + i;
				else if (s === 2) f = a.node.usedBytes + i;
				else throw new RangeError(`Unsupported seek origin: ${s}`);
				if (!Number.isSafeInteger(f) || f < 0) throw new RangeError(`Invalid seek position: ${f}`);
				return f;
			}
		};
	}
	function ir(e, r) {
		const t = l.wasmURL;
		return t && e.endsWith(".wasm") ? t : r + e;
	}
	l.print = q, l.printErr = ae, l.locateFile = ir, l.exec = x, l.setLogger = ve, l.setTimeout = he, l.setProgress = tr, l.reset = or, l.receiveProgress = nr, l.createOPFSBackedFile = ar;
	let ie = !1;
	function sr(e) {
		if (typeof e != "string" || e.length === 0) throw new TypeError("inputPath must be a non-empty WORKERFS path");
		if (ie) throw new Error("Only one incremental audio decoder may be open per core");
		const r = [], t = l.logger, o = (g) => {
			r.push(g), r.length > 20 && r.shift(), t(g);
		};
		l.logger = o;
		function a() {
			l.logger === o && (l.logger = t);
		}
		function i(g) {
			const S = r.map((A) => A.message).filter(Boolean).join(`
`), N = new Error(S ? `${g}
${S}` : g);
			return N.ffmpegLog = r.slice(), N;
		}
		const s = B(e);
		let f;
		try {
			f = l._parakeet_audio_decoder_open(s);
		} catch (g) {
			try {
				l._parakeet_audio_decoder_cancel();
			} catch (S) {
				throw a(), new AggregateError([g, S], "Audio decoder open failed and cleanup also failed");
			}
			throw a(), g;
		} finally {
			l._free(s);
		}
		if (f < 0) throw a(), i(`Could not open audio input (FFmpeg error ${f})`);
		let c;
		try {
			c = l._parakeet_audio_decoder_estimated_sample_count();
		} catch (g) {
			try {
				l._parakeet_audio_decoder_cancel();
			} catch (S) {
				throw a(), new AggregateError([g, S], "Audio duration estimate failed and cleanup also failed");
			}
			throw a(), g;
		}
		const u = typeof c == "bigint" && c >= 0n && c <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(c) : null;
		ie = !0;
		let m = !1, d = 0;
		function h() {
			if (m) throw new Error("Incremental audio decoder is closed");
		}
		function p(g) {
			if (!m) {
				m = !0, ie = !1;
				try {
					l[g]();
				} finally {
					a();
				}
			}
		}
		return {
			sampleRate: 16e3,
			channels: 1,
			sampleFormat: "s16",
			estimatedSampleCount: u,
			decodeNext(g) {
				if (h(), !Number.isSafeInteger(g) || g <= 0 || g > 1073741823) throw new RangeError("maxSamples must be an integer from 1 to 1073741823");
				const S = l._malloc(g * 2);
				if (!S) throw new Error("Could not allocate the PCM pull buffer");
				const N = performance.now();
				let A = 0, O, L;
				try {
					if (O = l._parakeet_audio_decoder_pull(S, g), A = performance.now() - N, O < 0) throw i(`Audio decoding failed (FFmpeg error ${O})`);
					L = j.slice(S >>> 1, (S >>> 1) + O);
				} catch (D) {
					m = !0, ie = !1;
					try {
						l._parakeet_audio_decoder_cancel();
					} catch (Jt) {
						throw a(), new AggregateError([D, Jt], "Audio decoding failed and cleanup also failed");
					}
					throw a(), D;
				} finally {
					A === 0 && (A = performance.now() - N), d += A, l._free(S);
				}
				const W = l._parakeet_audio_decoder_done() !== 0;
				if (O === 0 && !W) throw p("_parakeet_audio_decoder_cancel"), /* @__PURE__ */ new Error("Audio decoder returned zero samples before EOF");
				return {
					samples: L,
					sampleCount: O,
					done: W,
					decodeMs: A,
					totalDecodeMs: d
				};
			},
			close() {
				p("_parakeet_audio_decoder_close");
			},
			cancel() {
				p("_parakeet_audio_decoder_cancel");
			}
		};
	}
	l.createIncrementalAudioDecoder = sr;
	var Ae = "./this.program", fr = (e, r) => {
		throw r;
	}, lr = import.meta.url, we = "";
	function cr(e) {
		return l.locateFile ? l.locateFile(e, we) : we + e;
	}
	var ge, se;
	if (R || T) {
		try {
			we = new URL(".", lr).href;
		} catch {}
		T && (se = (e) => {
			var r = new XMLHttpRequest();
			return r.open("GET", e, !1), r.responseType = "arraybuffer", r.send(null), new Uint8Array(r.response);
		}), ge = async (e) => {
			var r = await fetch(e, { credentials: "same-origin" });
			if (r.ok) return r.arrayBuffer();
			throw new Error(r.status + " : " + r.url);
		};
	}
	var fe = console.log.bind(console), Y = console.error.bind(console), Me, ye = !1;
	function Te(e, r) {
		e || I(r);
	}
	class $ {}
	class dr extends $ {}
	function ur() {
		return de.buffer;
	}
	function Ne() {
		if (!C?.buffer?.resizable) {
			var e = ur();
			C = new Int8Array(e), j = new Int16Array(e), Z = new Uint8Array(e), br = new Uint16Array(e), w = new Int32Array(e), E = new Uint32Array(e), Ce = new Float32Array(e), pe = new Float64Array(e), F = new BigInt64Array(e), Dr = new BigUint64Array(e);
		}
	}
	function mr() {
		var e = l.preRun;
		e && (typeof e == "function" && (e = [e]), Le.push(...e)), Pe(Le);
	}
	function vr() {
		!l.noFSInit && !n.initialized && n.init(), X.init(), ue.R(), n.ignorePermissions = !1;
	}
	function hr() {
		var e = l.postRun;
		e && (typeof e == "function" && (e = [e]), Ie.push(...e)), Pe(Ie);
	}
	function I(e) {
		throw l.onAbort?.(e), e = `Aborted(${e})`, Y(e), ye = !0, e += ". Build with -sASSERTIONS for more info.", new WebAssembly.RuntimeError(e);
	}
	var Re;
	function wr() {
		return l.locateFile ? cr("parakeet-wgsl-ffmpeg-core.wasm") : new URL("./parakeet-wgsl-ffmpeg-core-DVGVlEyK.wasm", "" + import.meta.url).href;
	}
	function gr(e) {
		if (se) return se(e);
		throw "both async and sync fetching of the wasm failed";
	}
	async function yr(e) {
		if (!Me) try {
			var r = await ge(e);
			return new Uint8Array(r);
		} catch {}
		return gr(e);
	}
	async function pr(e, r) {
		try {
			var t = await yr(e);
			return await WebAssembly.instantiate(t, r);
		} catch (o) {
			Y(`failed to asynchronously prepare wasm: ${o}`), I(o);
		}
	}
	async function _r(e, r, t) {
		if (!e) try {
			var o = fetch(r, { credentials: "same-origin" });
			return await WebAssembly.instantiateStreaming(o, t);
		} catch (a) {
			Y(`wasm streaming compile failed: ${a}`), Y("falling back to ArrayBuffer instantiation");
		}
		return pr(r, t);
	}
	function Er() {
		return { a: $t };
	}
	async function kr() {
		function e(a) {
			return ue = a.exports, xt(ue), Ne(), ue;
		}
		function r(a) {
			return e(a.instance);
		}
		var t = Er(), o = l.instantiateWasm;
		return o ? new Promise((a) => {
			o(t, (i) => a(e(i)));
		}) : (Re ??= wr(), r(await _r(Me, Re, t)));
	}
	class Sr {
		name = "ExitStatus";
		constructor(r) {
			this.message = `Program terminated with exit(${r})`, this.status = r;
		}
	}
	var j, w, F, C, Ce, pe, br, E, Dr, Z, Pe = (e) => {
		for (; e.length > 0;) e.shift()(l);
	}, Ie = [], Le = [], Oe = !0;
	function Fr(e, r, t = "i8") {
		switch (t.endsWith("*") && (t = "*"), t) {
			case "i1":
				C[e] = r;
				break;
			case "i8":
				C[e] = r;
				break;
			case "i16":
				j[e >> 1] = r;
				break;
			case "i32":
				w[e >> 2] = r;
				break;
			case "i64":
				F[e >> 3] = BigInt(r);
				break;
			case "float":
				Ce[e >> 2] = r;
				break;
			case "double":
				pe[e >> 3] = r;
				break;
			case "*":
				E[e >> 2] = r;
				break;
			default: I(`invalid type for setValue: ${t}`);
		}
	}
	var G = (e) => Ke(e), V = () => qe(), k = {
		isAbs: (e) => e.charAt(0) === "/",
		splitPath: (e) => /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/.exec(e).slice(1),
		normalizeArray: (e, r) => {
			for (var t = 0, o = e.length - 1; o >= 0; o--) {
				var a = e[o];
				a === "." ? e.splice(o, 1) : a === ".." ? (e.splice(o, 1), t++) : t && (e.splice(o, 1), t--);
			}
			if (r) for (; t; t--) e.unshift("..");
			return e;
		},
		normalize: (e) => {
			var r = k.isAbs(e), t = e.slice(-1) === "/";
			return e = k.normalizeArray(e.split("/").filter((o) => !!o), !r).join("/"), !e && !r && (e = "."), e && t && (e += "/"), (r ? "/" : "") + e;
		},
		dirname: (e) => {
			var r = k.splitPath(e), t = r[0], o = r[1];
			return !t && !o ? "." : (o && (o = o.slice(0, -1)), t + o);
		},
		basename: (e) => e && e.match(/([^\/]+|\/)\/*$/)[1],
		join: (...e) => k.normalize(e.join("/")),
		join2: (e, r) => k.normalize(e + "/" + r)
	}, Ar = () => (e) => (crypto.getRandomValues(e), 0), ze = (e) => (ze = Ar())(e), ee = {
		resolve: (...e) => {
			for (var r = "", t = !1, o = e.length - 1; o >= -1 && !t; o--) {
				var a = o >= 0 ? e[o] : n.cwd();
				if (typeof a != "string") throw new TypeError("Arguments to path.resolve must be strings");
				if (!a) return "";
				r = a + "/" + r, t = k.isAbs(a);
			}
			return r = k.normalizeArray(r.split("/").filter((i) => !!i), !t).join("/"), (t ? "/" : "") + r || ".";
		},
		relative: (e, r) => {
			e = ee.resolve(e).slice(1), r = ee.resolve(r).slice(1);
			function t(u) {
				for (var m = 0; m < u.length && u[m] === ""; m++);
				for (var d = u.length - 1; d >= 0 && u[d] === ""; d--);
				return m > d ? [] : u.slice(m, d - m + 1);
			}
			for (var o = t(e.split("/")), a = t(r.split("/")), i = Math.min(o.length, a.length), s = i, f = 0; f < i; f++) if (o[f] !== a[f]) {
				s = f;
				break;
			}
			for (var c = [], f = s; f < o.length; f++) c.push("..");
			return c = c.concat(a.slice(s)), c.join("/");
		}
	}, Be = globalThis.TextDecoder && new TextDecoder(), Mr = (e, r, t, o) => {
		var a = r + t;
		if (o) return a;
		for (; e[r] && !(r >= a);) ++r;
		return r;
	}, re = (e, r = 0, t, o) => {
		var a = Mr(e, r, t, o);
		if (a - r > 16 && e.buffer && Be) return Be.decode(e.subarray(r, a));
		for (var i = ""; r < a;) {
			var s = e[r++];
			if (!(s & 128)) {
				i += String.fromCharCode(s);
				continue;
			}
			var f = e[r++] & 63;
			if ((s & 224) == 192) {
				i += String.fromCharCode((s & 31) << 6 | f);
				continue;
			}
			var c = e[r++] & 63;
			if ((s & 240) == 224 ? s = (s & 15) << 12 | f << 6 | c : s = (s & 7) << 18 | f << 12 | c << 6 | e[r++] & 63, s < 65536) i += String.fromCharCode(s);
			else {
				var u = s - 65536;
				i += String.fromCharCode(55296 | u >> 10, 56320 | u & 1023);
			}
		}
		return i;
	}, _e = [], Ee = (e) => {
		for (var r = 0, t = 0; t < e.length; ++t) {
			var o = e.charCodeAt(t);
			o <= 127 ? r++ : o <= 2047 ? r += 2 : o >= 55296 && o <= 57343 ? (r += 4, ++t) : r += 3;
		}
		return r;
	}, Ue = (e, r, t, o) => {
		if (!(o > 0)) return 0;
		for (var a = t, i = t + o - 1, s = 0; s < e.length; ++s) {
			var f = e.codePointAt(s);
			if (f <= 127) {
				if (t >= i) break;
				r[t++] = f;
			} else if (f <= 2047) {
				if (t + 1 >= i) break;
				r[t++] = 192 | f >> 6, r[t++] = 128 | f & 63;
			} else if (f <= 65535) {
				if (t + 2 >= i) break;
				r[t++] = 224 | f >> 12, r[t++] = 128 | f >> 6 & 63, r[t++] = 128 | f & 63;
			} else {
				if (t + 3 >= i) break;
				r[t++] = 240 | f >> 18, r[t++] = 128 | f >> 12 & 63, r[t++] = 128 | f >> 6 & 63, r[t++] = 128 | f & 63, s++;
			}
		}
		return r[t] = 0, t - a;
	}, ke = (e, r, t) => {
		var o = t > 0 ? t : Ee(e) + 1, a = new Array(o), i = Ue(e, a, 0, a.length);
		return r && (a.length = i), a;
	}, Tr = () => {
		if (!_e.length) {
			var e = null;
			if (!e) return null;
			_e = ke(e, !0);
		}
		return _e.shift();
	}, X = {
		ttys: [],
		init() {},
		shutdown() {},
		register(e, r) {
			X.ttys[e] = {
				input: [],
				output: [],
				ops: r
			}, n.registerDevice(e, X.stream_ops);
		},
		stream_ops: {
			open(e) {
				var r = X.ttys[e.node.rdev];
				if (!r) throw new n.ErrnoError(43);
				e.tty = r, e.seekable = !1;
			},
			close(e) {
				e.tty.ops.fsync(e.tty);
			},
			fsync(e) {
				e.tty.ops.fsync(e.tty);
			},
			read(e, r, t, o, a) {
				if (!e.tty || !e.tty.ops.get_char) throw new n.ErrnoError(60);
				for (var i = 0, s = 0; s < o; s++) {
					var f;
					try {
						f = e.tty.ops.get_char(e.tty);
					} catch {
						throw new n.ErrnoError(29);
					}
					if (f === void 0 && i === 0) throw new n.ErrnoError(6);
					if (f == null) break;
					i++, r[t + s] = f;
				}
				return i && (e.node.atime = Date.now()), i;
			},
			write(e, r, t, o, a) {
				if (!e.tty || !e.tty.ops.put_char) throw new n.ErrnoError(60);
				try {
					for (var i = 0; i < o; i++) e.tty.ops.put_char(e.tty, r[t + i]);
				} catch {
					throw new n.ErrnoError(29);
				}
				return o && (e.node.mtime = e.node.ctime = Date.now()), i;
			}
		},
		default_tty_ops: {
			get_char(e) {
				return Tr();
			},
			put_char(e, r) {
				r === null || r === 10 ? (fe(re(e.output)), e.output = []) : r != 0 && e.output.push(r);
			},
			fsync(e) {
				e.output?.length > 0 && (fe(re(e.output)), e.output = []);
			},
			ioctl_tcgets(e) {
				return {
					c_iflag: 25856,
					c_oflag: 5,
					c_cflag: 191,
					c_lflag: 35387,
					c_cc: [
						3,
						28,
						127,
						21,
						4,
						0,
						1,
						0,
						17,
						19,
						26,
						0,
						18,
						15,
						23,
						22,
						0,
						0,
						0,
						0,
						0,
						0,
						0,
						0,
						0,
						0,
						0,
						0,
						0,
						0,
						0,
						0
					]
				};
			},
			ioctl_tcsets(e, r, t) {
				return 0;
			},
			ioctl_tiocgwinsz(e) {
				return [24, 80];
			}
		},
		default_tty1_ops: {
			put_char(e, r) {
				r === null || r === 10 ? (Y(re(e.output)), e.output = []) : r != 0 && e.output.push(r);
			},
			fsync(e) {
				e.output?.length > 0 && (Y(re(e.output)), e.output = []);
			}
		}
	}, je = (e) => {
		I();
	}, y = {
		ops_table: null,
		mount(e) {
			return y.createNode(null, "/", 16895, 0);
		},
		createNode(e, r, t, o) {
			if (n.isBlkdev(t) || n.isFIFO(t)) throw new n.ErrnoError(63);
			y.ops_table ||= {
				dir: {
					node: {
						getattr: y.node_ops.getattr,
						setattr: y.node_ops.setattr,
						lookup: y.node_ops.lookup,
						mknod: y.node_ops.mknod,
						rename: y.node_ops.rename,
						unlink: y.node_ops.unlink,
						rmdir: y.node_ops.rmdir,
						readdir: y.node_ops.readdir,
						symlink: y.node_ops.symlink
					},
					stream: { llseek: y.stream_ops.llseek }
				},
				file: {
					node: {
						getattr: y.node_ops.getattr,
						setattr: y.node_ops.setattr
					},
					stream: {
						llseek: y.stream_ops.llseek,
						read: y.stream_ops.read,
						write: y.stream_ops.write,
						mmap: y.stream_ops.mmap,
						msync: y.stream_ops.msync
					}
				},
				link: {
					node: {
						getattr: y.node_ops.getattr,
						setattr: y.node_ops.setattr,
						readlink: y.node_ops.readlink
					},
					stream: {}
				},
				chrdev: {
					node: {
						getattr: y.node_ops.getattr,
						setattr: y.node_ops.setattr
					},
					stream: n.chrdev_stream_ops
				}
			};
			var a = n.createNode(e, r, t, o);
			return n.isDir(a.mode) ? (a.node_ops = y.ops_table.dir.node, a.stream_ops = y.ops_table.dir.stream, a.contents = {}) : n.isFile(a.mode) ? (a.node_ops = y.ops_table.file.node, a.stream_ops = y.ops_table.file.stream, a.usedBytes = 0, a.contents = y.emptyFileContents ??= /* @__PURE__ */ new Uint8Array(0)) : n.isLink(a.mode) ? (a.node_ops = y.ops_table.link.node, a.stream_ops = y.ops_table.link.stream) : n.isChrdev(a.mode) && (a.node_ops = y.ops_table.chrdev.node, a.stream_ops = y.ops_table.chrdev.stream), a.atime = a.mtime = a.ctime = Date.now(), e && (e.contents[r] = a, e.atime = e.mtime = e.ctime = a.atime), a;
		},
		getFileDataAsTypedArray(e) {
			return e.contents.subarray(0, e.usedBytes);
		},
		expandFileStorage(e, r) {
			var t = e.contents.length;
			if (!(t >= r)) {
				r = Math.max(r, t * (t < 1024 * 1024 ? 2 : 1.125) >>> 0), t && (r = Math.max(r, 256));
				var o = y.getFileDataAsTypedArray(e);
				e.contents = new Uint8Array(r), e.contents.set(o);
			}
		},
		resizeFileStorage(e, r) {
			if (e.usedBytes != r) {
				var t = e.contents;
				e.contents = new Uint8Array(r), e.contents.set(t.subarray(0, Math.min(r, e.usedBytes))), e.usedBytes = r;
			}
		},
		node_ops: {
			getattr(e) {
				var r = {};
				return r.dev = n.isChrdev(e.mode) ? e.id : 1, r.ino = e.id, r.mode = e.mode, r.nlink = 1, r.uid = 0, r.gid = 0, r.rdev = e.rdev, n.isDir(e.mode) ? r.size = 4096 : n.isFile(e.mode) ? r.size = e.usedBytes : n.isLink(e.mode) ? r.size = e.link.length : r.size = 0, r.atime = new Date(e.atime), r.mtime = new Date(e.mtime), r.ctime = new Date(e.ctime), r.blksize = 4096, r.blocks = Math.ceil(r.size / r.blksize), r;
			},
			setattr(e, r) {
				for (const t of [
					"mode",
					"atime",
					"mtime",
					"ctime"
				]) r[t] != null && (e[t] = r[t]);
				r.size !== void 0 && y.resizeFileStorage(e, r.size);
			},
			lookup(e, r) {
				throw y.doesNotExistError || (y.doesNotExistError = new n.ErrnoError(44), y.doesNotExistError.stack = "<generic error, no stack>"), y.doesNotExistError;
			},
			mknod(e, r, t, o) {
				return y.createNode(e, r, t, o);
			},
			rename(e, r, t) {
				var o;
				try {
					o = n.lookupNode(r, t);
				} catch {}
				if (o) {
					if (n.isDir(e.mode)) for (var a in o.contents) throw new n.ErrnoError(55);
					n.hashRemoveNode(o);
				}
				delete e.parent.contents[e.name], r.contents[t] = e, e.name = t, r.ctime = r.mtime = e.parent.ctime = e.parent.mtime = Date.now();
			},
			unlink(e, r) {
				delete e.contents[r], e.ctime = e.mtime = Date.now();
			},
			rmdir(e, r) {
				for (var t in n.lookupNode(e, r).contents) throw new n.ErrnoError(55);
				delete e.contents[r], e.ctime = e.mtime = Date.now();
			},
			readdir(e) {
				return [
					".",
					"..",
					...Object.keys(e.contents)
				];
			},
			symlink(e, r, t) {
				var o = y.createNode(e, r, 41471, 0);
				return o.link = t, o;
			},
			readlink(e) {
				if (!n.isLink(e.mode)) throw new n.ErrnoError(28);
				return e.link;
			}
		},
		stream_ops: {
			read(e, r, t, o, a) {
				var i = e.node.contents;
				if (a >= e.node.usedBytes) return 0;
				var s = Math.min(e.node.usedBytes - a, o);
				return r.set(i.subarray(a, a + s), t), s;
			},
			write(e, r, t, o, a, i) {
				if (r.buffer === C.buffer && (i = !1), !o) return 0;
				var s = e.node;
				return s.mtime = s.ctime = Date.now(), i ? (s.contents = r.subarray(t, t + o), s.usedBytes = o) : s.usedBytes === 0 && a === 0 ? (s.contents = r.slice(t, t + o), s.usedBytes = o) : (y.expandFileStorage(s, a + o), s.contents.set(r.subarray(t, t + o), a), s.usedBytes = Math.max(s.usedBytes, a + o)), o;
			},
			llseek(e, r, t) {
				var o = r;
				if (t === 1 ? o += e.position : t === 2 && n.isFile(e.node.mode) && (o += e.node.usedBytes), o < 0) throw new n.ErrnoError(28);
				return o;
			},
			mmap(e, r, t, o, a) {
				if (!n.isFile(e.node.mode)) throw new n.ErrnoError(43);
				var i, s, f = e.node.contents;
				if (!(a & 2) && f.buffer === C.buffer) s = !1, i = f.byteOffset;
				else {
					if (s = !0, i = je(r), !i) throw new n.ErrnoError(48);
					f && ((t > 0 || t + r < f.length) && (f.subarray ? f = f.subarray(t, t + r) : f = Array.prototype.slice.call(f, t, t + r)), C.set(f, i));
				}
				return {
					ptr: i,
					allocated: s
				};
			},
			msync(e, r, t, o, a) {
				return y.stream_ops.write(e, r, 0, o, t, !1), 0;
			}
		}
	}, Nr = (e) => {
		if (typeof e != "string") return e;
		var r = {
			r: 0,
			"r+": 2,
			w: 577,
			"w+": 578,
			a: 1089,
			"a+": 1090
		}[e];
		if (typeof r > "u") throw new Error(`Unknown file open mode: ${e}`);
		return r;
	}, xe = (e) => (typeof e == "string" && (e = ke(e, !0)), e.subarray || (e = new Uint8Array(e)), e), Se = (e, r) => {
		var t = 0;
		return e && (t |= 365), r && (t |= 146), t;
	}, M = {
		DIR_MODE: 16895,
		FILE_MODE: 33279,
		reader: null,
		mount(e) {
			Te(T), M.reader ??= new FileReaderSync();
			var r = M.createNode(null, "/", M.DIR_MODE, 0), t = {};
			function o(u) {
				for (var m = u.split("/"), d = r, h = 0; h < m.length - 1; h++) {
					var p = m.slice(0, h + 1).join("/");
					t[p] ||= M.createNode(d, m[h], M.DIR_MODE, 0), d = t[p];
				}
				return d;
			}
			function a(u) {
				var m = u.split("/");
				return m[m.length - 1];
			}
			for (var i of e.opts.files || []) M.createNode(o(i.name), a(i.name), M.FILE_MODE, 0, i, i.lastModifiedDate);
			for (var s of e.opts.blobs || []) M.createNode(o(s.name), a(s.name), M.FILE_MODE, 0, s.data);
			for (var f of e.opts.packages || []) for (var i of f.metadata.files) {
				var c = i.filename.slice(1);
				M.createNode(o(c), a(c), M.FILE_MODE, 0, f.blob.slice(i.start, i.end));
			}
			return r;
		},
		createNode(e, r, t, o, a, i) {
			var s = n.createNode(e, r, t);
			return s.mode = t, s.node_ops = M.node_ops, s.stream_ops = M.stream_ops, s.atime = s.mtime = s.ctime = (i || /* @__PURE__ */ new Date()).getTime(), Te(M.FILE_MODE !== M.DIR_MODE), t === M.FILE_MODE ? (s.size = a.size, s.contents = a) : (s.size = 4096, s.contents = {}), e && (e.contents[r] = s), s;
		},
		node_ops: {
			getattr(e) {
				return {
					dev: 1,
					ino: e.id,
					mode: e.mode,
					nlink: 1,
					uid: 0,
					gid: 0,
					rdev: 0,
					size: e.size,
					atime: new Date(e.atime),
					mtime: new Date(e.mtime),
					ctime: new Date(e.ctime),
					blksize: 4096,
					blocks: Math.ceil(e.size / 4096)
				};
			},
			setattr(e, r) {
				for (const t of [
					"mode",
					"atime",
					"mtime",
					"ctime"
				]) r[t] != null && (e[t] = r[t]);
			},
			lookup(e, r) {
				throw new n.ErrnoError(44);
			},
			mknod(e, r, t, o) {
				throw new n.ErrnoError(63);
			},
			rename(e, r, t) {
				throw new n.ErrnoError(63);
			},
			unlink(e, r) {
				throw new n.ErrnoError(63);
			},
			rmdir(e, r) {
				throw new n.ErrnoError(63);
			},
			readdir(e) {
				var r = [".", ".."];
				for (var t of Object.keys(e.contents)) r.push(t);
				return r;
			},
			symlink(e, r, t) {
				throw new n.ErrnoError(63);
			}
		},
		stream_ops: {
			read(e, r, t, o, a) {
				if (a >= e.node.size) return 0;
				var i = e.node.contents.slice(a, a + o), s = M.reader.readAsArrayBuffer(i);
				return r.set(new Uint8Array(s), t), i.size;
			},
			write(e, r, t, o, a) {
				throw new n.ErrnoError(29);
			},
			llseek(e, r, t) {
				var o = r;
				if (t === 1 ? o += e.position : t === 2 && n.isFile(e.node.mode) && (o += e.node.size), o < 0) throw new n.ErrnoError(28);
				return o;
			}
		}
	}, Rr = async (e) => {
		var r = await ge(e);
		return new Uint8Array(r);
	}, Cr = (...e) => n.createDataFile(...e), Pr = (e) => e, $e = null, Ir = async () => $e, J = 0, He = null, Lr = (e) => {
		J--, l.monitorRunDependencies?.(J), J || He();
	}, Or = (e) => {
		J || ($e = new Promise((r) => He = r)), J++, l.monitorRunDependencies?.(J);
	}, zr = [], Br = async (e, r) => {
		typeof Browser < "u" && Browser.init();
		for (var t of zr) if (t.canHandle(r)) return t.handle(e, r);
		return e;
	}, We = async (e, r, t, o, a, i, s, f) => {
		var c = r ? ee.resolve(k.join2(e, r)) : e, u = Pr(`cp ${c}`);
		Or(u);
		try {
			var m = t;
			typeof t == "string" && (m = await Rr(t)), m = await Br(m, c), f?.(), i || Cr(e, r, m, o, a, s);
		} finally {
			Lr(u);
		}
	}, Ur = (e, r, t, o, a, i, s, f, c, u) => {
		We(e, r, t, o, a, f, c, u).then(i).catch(s);
	}, n = {
		root: null,
		mounts: [],
		devices: {},
		streams: [],
		nextInode: 1,
		nameTable: null,
		currentPath: "/",
		initialized: !1,
		ignorePermissions: !0,
		filesystems: null,
		syncFSRequests: 0,
		ErrnoError: class {
			name = "ErrnoError";
			constructor(e) {
				this.errno = e;
			}
		},
		FSStream: class {
			shared = {};
			get object() {
				return this.node;
			}
			set object(e) {
				this.node = e;
			}
			get isRead() {
				return (this.flags & 2097155) !== 1;
			}
			get isWrite() {
				return (this.flags & 2097155) !== 0;
			}
			get isAppend() {
				return this.flags & 1024;
			}
			get flags() {
				return this.shared.flags;
			}
			set flags(e) {
				this.shared.flags = e;
			}
			get position() {
				return this.shared.position;
			}
			set position(e) {
				this.shared.position = e;
			}
		},
		FSNode: class {
			node_ops = {};
			stream_ops = {};
			readMode = 365;
			writeMode = 146;
			mounted = null;
			constructor(e, r, t, o) {
				e || (e = this), this.parent = e, this.mount = e.mount, this.id = n.nextInode++, this.name = r, this.mode = t, this.rdev = o, this.atime = this.mtime = this.ctime = Date.now();
			}
			get read() {
				return (this.mode & this.readMode) === this.readMode;
			}
			set read(e) {
				e ? this.mode |= this.readMode : this.mode &= ~this.readMode;
			}
			get write() {
				return (this.mode & this.writeMode) === this.writeMode;
			}
			set write(e) {
				e ? this.mode |= this.writeMode : this.mode &= ~this.writeMode;
			}
			get isFolder() {
				return n.isDir(this.mode);
			}
			get isDevice() {
				return n.isChrdev(this.mode);
			}
			addListener(e, r = !1) {
				var t = {
					cb: e,
					exclusive: r
				}, o = this.listeners ??= /* @__PURE__ */ new Set();
				return o.add(t), {
					listeners: o,
					entry: t
				};
			}
			notifyListeners(e) {
				if (this.listeners) {
					var r;
					for (var t of this.listeners) t.exclusive ? (r ||= []).push(t) : t.cb(e);
					if (r) {
						var o = (this.exclTurn || 0) % r.length;
						this.exclTurn = o + 1, r[o].cb(e);
					}
				}
			}
		},
		lookupPath(e, r = {}) {
			if (!e) throw new n.ErrnoError(44);
			r.follow_mount ??= !0, k.isAbs(e) || (e = n.cwd() + "/" + e);
			e: for (var t = 0; t < 40; t++) {
				for (var o = e.split("/").filter((u) => !!u), a = n.root, i = "/", s = 0; s < o.length; s++) {
					var f = s === o.length - 1;
					if (f && r.parent) break;
					if (o[s] !== ".") {
						if (o[s] === "..") {
							if (i = k.dirname(i), n.isRoot(a)) {
								e = i + "/" + o.slice(s + 1).join("/"), t--;
								continue e;
							} else a = a.parent;
							continue;
						}
						i = k.join2(i, o[s]);
						try {
							a = n.lookupNode(a, o[s]);
						} catch (u) {
							if (u?.errno === 44 && f && r.noent_okay) return { path: i };
							throw u;
						}
						if (n.isMountpoint(a) && (!f || r.follow_mount) && (a = a.mounted.root), n.isLink(a.mode) && (!f || r.follow)) {
							if (!a.node_ops.readlink) throw new n.ErrnoError(52);
							var c = a.node_ops.readlink(a);
							k.isAbs(c) || (c = k.dirname(i) + "/" + c), e = c + "/" + o.slice(s + 1).join("/");
							continue e;
						}
					}
				}
				return {
					path: i,
					node: a
				};
			}
			throw new n.ErrnoError(32);
		},
		getPath(e) {
			for (var r;;) {
				if (n.isRoot(e)) {
					var t = e.mount.mountpoint;
					return r ? t[t.length - 1] !== "/" ? `${t}/${r}` : t + r : t;
				}
				r = r ? `${e.name}/${r}` : e.name, e = e.parent;
			}
		},
		hashName(e, r) {
			for (var t = 0, o = 0; o < r.length; o++) t = (t << 5) - t + r.charCodeAt(o) | 0;
			return (e + t >>> 0) % n.nameTable.length;
		},
		hashAddNode(e) {
			var r = n.hashName(e.parent.id, e.name);
			e.name_next = n.nameTable[r], n.nameTable[r] = e;
		},
		hashRemoveNode(e) {
			var r = n.hashName(e.parent.id, e.name);
			if (n.nameTable[r] === e) n.nameTable[r] = e.name_next;
			else for (var t = n.nameTable[r]; t;) {
				if (t.name_next === e) {
					t.name_next = e.name_next;
					break;
				}
				t = t.name_next;
			}
		},
		lookupNode(e, r) {
			var t = n.mayLookup(e);
			if (t) throw new n.ErrnoError(t);
			for (var o = n.hashName(e.id, r), a = n.nameTable[o]; a; a = a.name_next) {
				var i = a.name;
				if (a.parent.id === e.id && i === r) return a;
			}
			return n.lookup(e, r);
		},
		createNode(e, r, t, o) {
			var a = new n.FSNode(e, r, t, o);
			return n.hashAddNode(a), a;
		},
		destroyNode(e) {
			n.hashRemoveNode(e);
		},
		isRoot(e) {
			return e === e.parent;
		},
		isMountpoint(e) {
			return !!e.mounted;
		},
		isFile(e) {
			return (e & 61440) === 32768;
		},
		isDir(e) {
			return (e & 61440) === 16384;
		},
		isLink(e) {
			return (e & 61440) === 40960;
		},
		isChrdev(e) {
			return (e & 61440) === 8192;
		},
		isBlkdev(e) {
			return (e & 61440) === 24576;
		},
		isFIFO(e) {
			return (e & 61440) === 4096;
		},
		isSocket(e) {
			return (e & 49152) === 49152;
		},
		flagsToPermissionString(e) {
			var r = [
				"r",
				"w",
				"rw"
			][e & 3];
			return e & 512 && (r += "w"), r;
		},
		nodePermissions(e, r) {
			return n.ignorePermissions ? 0 : r.includes("r") && !(e.mode & 292) || r.includes("w") && !(e.mode & 146) || r.includes("x") && !(e.mode & 73) ? 2 : 0;
		},
		mayLookup(e) {
			if (!n.isDir(e.mode)) return 54;
			return n.nodePermissions(e, "x") || (e.node_ops.lookup ? 0 : 2);
		},
		mayCreate(e, r) {
			if (!n.isDir(e.mode)) return 54;
			try {
				return n.lookupNode(e, r), 20;
			} catch {}
			return n.nodePermissions(e, "wx");
		},
		mayDelete(e, r, t) {
			var o;
			try {
				o = n.lookupNode(e, r);
			} catch (i) {
				return i.errno;
			}
			var a = n.nodePermissions(e, "wx");
			if (a) return a;
			if (t) {
				if (!n.isDir(o.mode)) return 54;
				if (n.isRoot(o) || n.getPath(o) === n.cwd()) return 10;
			} else if (n.isDir(o.mode)) return 31;
			return 0;
		},
		mayOpen(e, r) {
			if (!e) return 44;
			if (n.isLink(e.mode)) return 32;
			var t = n.flagsToPermissionString(r);
			return n.isDir(e.mode) && (t !== "r" || r & 576) ? 31 : n.nodePermissions(e, t);
		},
		checkOpExists(e, r) {
			if (!e) throw new n.ErrnoError(r);
			return e;
		},
		MAX_OPEN_FDS: 4096,
		nextfd() {
			for (var e = 0; e <= n.MAX_OPEN_FDS; e++) if (!n.streams[e]) return e;
			throw new n.ErrnoError(33);
		},
		getStreamChecked(e) {
			var r = n.getStream(e);
			if (!r) throw new n.ErrnoError(8);
			return r;
		},
		getStream: (e) => n.streams[e],
		createStream(e, r = -1) {
			return e = Object.assign(new n.FSStream(), e), r == -1 && (r = n.nextfd()), e.fd = r, n.streams[r] = e, e;
		},
		closeStream(e) {
			n.streams[e] = null;
		},
		dupStream(e, r = -1) {
			var t = n.createStream(e, r);
			return t.stream_ops?.dup?.(t), t;
		},
		doSetAttr(e, r, t) {
			var o = e?.stream_ops.setattr, a = o ? e : r;
			o ??= r.node_ops.setattr, n.checkOpExists(o, 63);
			try {
				o(a, t);
			} catch (i) {
				throw i instanceof RangeError ? new n.ErrnoError(22) : i;
			}
		},
		chrdev_stream_ops: {
			open(e) {
				e.stream_ops = n.getDevice(e.node.rdev).stream_ops, e.stream_ops.open?.(e);
			},
			llseek() {
				throw new n.ErrnoError(70);
			}
		},
		major: (e) => e >> 8,
		minor: (e) => e & 255,
		makedev: (e, r) => e << 8 | r,
		registerDevice(e, r) {
			n.devices[e] = { stream_ops: r };
		},
		getDevice: (e) => n.devices[e],
		getMounts(e) {
			for (var r = [], t = [e]; t.length;) {
				var o = t.pop();
				r.push(o), t.push(...o.mounts);
			}
			return r;
		},
		syncfs(e, r) {
			typeof e == "function" && (r = e, e = !1), n.syncFSRequests++, n.syncFSRequests > 1 && Y(`warning: ${n.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`);
			var t = n.getMounts(n.root.mount), o = 0;
			function a(f) {
				return n.syncFSRequests--, r(f);
			}
			function i(f) {
				if (f) return i.errored ? void 0 : (i.errored = !0, a(f));
				++o >= t.length && a(null);
			}
			for (var s of t) s.type.syncfs ? s.type.syncfs(s, e, i) : i(null);
		},
		mount(e, r, t) {
			var o = t === "/", a = !t, i;
			if (o && n.root) throw new n.ErrnoError(10);
			if (!o && !a) {
				var s = n.lookupPath(t, { follow_mount: !1 });
				if (t = s.path, i = s.node, n.isMountpoint(i)) throw new n.ErrnoError(10);
				if (!n.isDir(i.mode)) throw new n.ErrnoError(54);
			}
			var f = {
				type: e,
				opts: r,
				mountpoint: t,
				mounts: []
			}, c = e.mount(f);
			return c.mount = f, f.root = c, o ? n.root = c : i && (i.mounted = f, i.mount && i.mount.mounts.push(f)), c;
		},
		unmount(e) {
			var r = n.lookupPath(e, { follow_mount: !1 });
			if (!n.isMountpoint(r.node)) throw new n.ErrnoError(28);
			var t = r.node, o = t.mounted, a = n.getMounts(o);
			for (var [i, s] of Object.entries(n.nameTable)) for (; s;) {
				var f = s.name_next;
				a.includes(s.mount) && n.destroyNode(s), s = f;
			}
			t.mounted = null;
			var c = t.mount.mounts.indexOf(o);
			t.mount.mounts.splice(c, 1);
		},
		lookup(e, r) {
			return e.node_ops.lookup(e, r);
		},
		mknod(e, r, t) {
			var o = n.lookupPath(e, { parent: !0 }).node, a = k.basename(e);
			if (!a) throw new n.ErrnoError(28);
			if (a === "." || a === "..") throw new n.ErrnoError(20);
			var i = n.mayCreate(o, a);
			if (i) throw new n.ErrnoError(i);
			if (!o.node_ops.mknod) throw new n.ErrnoError(63);
			return o.node_ops.mknod(o, a, r, t);
		},
		statfs(e) {
			return n.statfsNode(n.lookupPath(e, { follow: !0 }).node);
		},
		statfsStream(e) {
			return n.statfsNode(e.node);
		},
		statfsNode(e) {
			var r = {
				bsize: 4096,
				frsize: 4096,
				blocks: 1e6,
				bfree: 5e5,
				bavail: 5e5,
				files: n.nextInode,
				ffree: n.nextInode - 1,
				fsid: 42,
				flags: 2,
				namelen: 255
			};
			return e.node_ops.statfs && Object.assign(r, e.node_ops.statfs(e.mount.opts.root)), r;
		},
		create(e, r = 438) {
			return r &= 4095, r |= 32768, n.mknod(e, r, 0);
		},
		mkdir(e, r = 511) {
			return r &= 1023, r |= 16384, n.mknod(e, r, 0);
		},
		mkdirTree(e, r) {
			var t = e.split("/"), o = "";
			for (var a of t) if (a) {
				(o || k.isAbs(e)) && (o += "/"), o += a;
				try {
					n.mkdir(o, r);
				} catch (i) {
					if (i.errno != 20) throw i;
				}
			}
		},
		mkdev(e, r, t) {
			return typeof t > "u" && (t = r, r = 438), r |= 8192, n.mknod(e, r, t);
		},
		symlink(e, r) {
			if (!ee.resolve(e)) throw new n.ErrnoError(44);
			var t = n.lookupPath(r, { parent: !0 }).node;
			if (!t) throw new n.ErrnoError(44);
			var o = k.basename(r), a = n.mayCreate(t, o);
			if (a) throw new n.ErrnoError(a);
			if (!t.node_ops.symlink) throw new n.ErrnoError(63);
			return t.node_ops.symlink(t, o, e);
		},
		link(e, r, t) {
			var o = n.lookupPath(r, { parent: !0 }).node;
			if (!o) throw new n.ErrnoError(44);
			var a = k.basename(r), i = n.mayCreate(o, a);
			if (i) throw new n.ErrnoError(i);
			if (!o.node_ops.link) throw new n.ErrnoError(34);
			return o.node_ops.link(o, a, e, t);
		},
		rename(e, r) {
			var t = k.dirname(e), o = k.dirname(r), a = k.basename(e), i = k.basename(r), s = n.lookupPath(e, { parent: !0 }), f = s.node, c;
			if (s = n.lookupPath(r, { parent: !0 }), c = s.node, !f || !c) throw new n.ErrnoError(44);
			if (f.mount !== c.mount) throw new n.ErrnoError(75);
			var u = n.lookupNode(f, a), m = ee.relative(e, o);
			if (m.charAt(0) !== ".") throw new n.ErrnoError(28);
			if (m = ee.relative(r, t), m.charAt(0) !== ".") throw new n.ErrnoError(55);
			var d;
			try {
				d = n.lookupNode(c, i);
			} catch {}
			if (u !== d) {
				var h = n.isDir(u.mode), p = n.mayDelete(f, a, h);
				if (p) throw new n.ErrnoError(p);
				if (p = d ? n.mayDelete(c, i, h) : n.mayCreate(c, i), p) throw new n.ErrnoError(p);
				if (!f.node_ops.rename) throw new n.ErrnoError(63);
				if (n.isMountpoint(u) || d && n.isMountpoint(d)) throw new n.ErrnoError(10);
				if (c !== f && (p = n.nodePermissions(f, "w"), p)) throw new n.ErrnoError(p);
				n.hashRemoveNode(u);
				try {
					f.node_ops.rename(u, c, i), u.parent = c;
				} catch (g) {
					throw g;
				} finally {
					n.hashAddNode(u);
				}
			}
		},
		rmdir(e) {
			var r = n.lookupPath(e, { parent: !0 }).node, t = k.basename(e), o = n.lookupNode(r, t), a = n.mayDelete(r, t, !0);
			if (a) throw new n.ErrnoError(a);
			if (!r.node_ops.rmdir) throw new n.ErrnoError(63);
			if (n.isMountpoint(o)) throw new n.ErrnoError(10);
			r.node_ops.rmdir(r, t), n.destroyNode(o);
		},
		readdir(e) {
			var r = n.lookupPath(e, { follow: !0 }).node;
			return n.checkOpExists(r.node_ops.readdir, 54)(r);
		},
		unlink(e) {
			var r = n.lookupPath(e, { parent: !0 }).node;
			if (!r) throw new n.ErrnoError(44);
			var t = k.basename(e), o = n.lookupNode(r, t), a = n.mayDelete(r, t, !1);
			if (a) throw new n.ErrnoError(a);
			if (!r.node_ops.unlink) throw new n.ErrnoError(63);
			if (n.isMountpoint(o)) throw new n.ErrnoError(10);
			r.node_ops.unlink(r, t), n.destroyNode(o);
		},
		readlink(e) {
			var r = n.lookupPath(e).node;
			if (!r) throw new n.ErrnoError(44);
			if (!r.node_ops.readlink) throw new n.ErrnoError(28);
			return r.node_ops.readlink(r);
		},
		stat(e, r) {
			var t = n.lookupPath(e, { follow: !r }).node;
			return n.checkOpExists(t.node_ops.getattr, 63)(t);
		},
		fstat(e) {
			var r = n.getStreamChecked(e), t = r.node, o = r.stream_ops.getattr, a = o ? r : t;
			return o ??= t.node_ops.getattr, n.checkOpExists(o, 63), o(a);
		},
		lstat(e) {
			return n.stat(e, !0);
		},
		doChmod(e, r, t, o) {
			n.doSetAttr(e, r, {
				mode: t & 4095 | r.mode & -4096,
				ctime: Date.now(),
				dontFollow: o
			});
		},
		chmod(e, r, t) {
			var o;
			typeof e == "string" ? o = n.lookupPath(e, { follow: !t }).node : o = e, n.doChmod(null, o, r, t);
		},
		lchmod(e, r) {
			n.chmod(e, r, !0);
		},
		fchmod(e, r) {
			var t = n.getStreamChecked(e);
			n.doChmod(t, t.node, r, !1);
		},
		doChown(e, r, t) {
			n.doSetAttr(e, r, {
				timestamp: Date.now(),
				dontFollow: t
			});
		},
		chown(e, r, t, o) {
			var a;
			typeof e == "string" ? a = n.lookupPath(e, { follow: !o }).node : a = e, n.doChown(null, a, o);
		},
		lchown(e, r, t) {
			n.chown(e, r, t, !0);
		},
		fchown(e, r, t) {
			var o = n.getStreamChecked(e);
			n.doChown(o, o.node, !1);
		},
		doTruncate(e, r, t) {
			if (n.isDir(r.mode)) throw new n.ErrnoError(31);
			if (!n.isFile(r.mode)) throw new n.ErrnoError(28);
			var o = n.nodePermissions(r, "w");
			if (o) throw new n.ErrnoError(o);
			n.doSetAttr(e, r, {
				size: t,
				timestamp: Date.now()
			});
		},
		truncate(e, r) {
			if (r < 0) throw new n.ErrnoError(28);
			var t;
			typeof e == "string" ? t = n.lookupPath(e, { follow: !0 }).node : t = e, n.doTruncate(null, t, r);
		},
		ftruncate(e, r) {
			var t = n.getStreamChecked(e);
			if (r < 0 || (t.flags & 2097155) === 0) throw new n.ErrnoError(28);
			n.doTruncate(t, t.node, r);
		},
		utime(e, r, t, o) {
			var a = n.lookupPath(e, { follow: !o });
			n.doSetAttr(null, a.node, {
				atime: r,
				mtime: t,
				dontFollow: o
			});
		},
		open(e, r, t = 438) {
			if (e === "") throw new n.ErrnoError(44);
			r = Nr(r), r & 64 ? t = t & 4095 | 32768 : t = 0;
			var o, a;
			if (typeof e == "object") o = e;
			else {
				a = e.endsWith("/");
				var i = n.lookupPath(e, {
					follow: !(r & 131072),
					noent_okay: !0
				});
				o = i.node, e = i.path;
			}
			var s = !1;
			if (r & 64) if (o) {
				if (r & 128) throw new n.ErrnoError(20);
			} else {
				if (a) throw new n.ErrnoError(31);
				o = n.mknod(e, t | 511, 0), s = !0;
			}
			if (!o) throw new n.ErrnoError(44);
			if (n.isChrdev(o.mode) && (r &= -513), r & 65536 && !n.isDir(o.mode)) throw new n.ErrnoError(54);
			if (!s) {
				var f = n.mayOpen(o, r);
				if (f) throw new n.ErrnoError(f);
			}
			r & 512 && !s && n.truncate(o, 0), r &= -131713;
			var c = n.createStream({
				node: o,
				path: n.getPath(o),
				flags: r,
				seekable: !0,
				position: 0,
				stream_ops: o.stream_ops,
				ungotten: [],
				error: !1
			});
			return c.stream_ops.open && c.stream_ops.open(c), s && n.chmod(o, t & 511), c;
		},
		close(e) {
			if (n.isClosed(e)) throw new n.ErrnoError(8);
			e.getdents && (e.getdents = null), e.node?.notifyListeners(32);
			try {
				e.stream_ops.close && e.stream_ops.close(e);
			} catch (r) {
				throw r;
			} finally {
				n.closeStream(e.fd);
			}
			e.fd = null;
		},
		isClosed(e) {
			return e.fd === null;
		},
		llseek(e, r, t) {
			if (n.isClosed(e)) throw new n.ErrnoError(8);
			if (!e.seekable || !e.stream_ops.llseek) throw new n.ErrnoError(70);
			if (t != 0 && t != 1 && t != 2) throw new n.ErrnoError(28);
			return e.position = e.stream_ops.llseek(e, r, t), e.ungotten = [], e.position;
		},
		read(e, r, t, o, a) {
			if (o < 0 || a < 0) throw new n.ErrnoError(28);
			if (n.isClosed(e)) throw new n.ErrnoError(8);
			if ((e.flags & 2097155) === 1) throw new n.ErrnoError(8);
			if (n.isDir(e.node.mode)) throw new n.ErrnoError(31);
			if (!e.stream_ops.read) throw new n.ErrnoError(28);
			var i = typeof a < "u";
			if (!i) a = e.position;
			else if (!e.seekable) throw new n.ErrnoError(70);
			var s = e.stream_ops.read(e, r, t, o, a);
			return i || (e.position += s), s;
		},
		write(e, r, t, o, a, i) {
			if (o < 0 || a < 0) throw new n.ErrnoError(28);
			if (n.isClosed(e)) throw new n.ErrnoError(8);
			if ((e.flags & 2097155) === 0) throw new n.ErrnoError(8);
			if (n.isDir(e.node.mode)) throw new n.ErrnoError(31);
			if (!e.stream_ops.write) throw new n.ErrnoError(28);
			e.seekable && e.flags & 1024 && n.llseek(e, 0, 2);
			var s = typeof a < "u";
			if (!s) a = e.position;
			else if (!e.seekable) throw new n.ErrnoError(70);
			var f = e.stream_ops.write(e, r, t, o, a, i);
			return s || (e.position += f), f;
		},
		mmap(e, r, t, o, a) {
			if ((o & 2) !== 0 && (a & 2) === 0 && (e.flags & 2097155) !== 2) throw new n.ErrnoError(2);
			if ((e.flags & 2097155) === 1) throw new n.ErrnoError(2);
			if (!e.stream_ops.mmap) throw new n.ErrnoError(43);
			if (!r) throw new n.ErrnoError(28);
			return e.stream_ops.mmap(e, r, t, o, a);
		},
		msync(e, r, t, o, a) {
			return e.stream_ops.msync ? e.stream_ops.msync(e, r, t, o, a) : 0;
		},
		ioctl(e, r, t) {
			if (!e.stream_ops.ioctl) throw new n.ErrnoError(59);
			return e.stream_ops.ioctl(e, r, t);
		},
		readFile(e, r = {}) {
			r.flags = r.flags ?? 0, r.encoding = r.encoding ?? "binary", r.encoding !== "utf8" && r.encoding !== "binary" && I(`Invalid encoding type "${r.encoding}"`);
			var t = n.open(e, r.flags), o = n.stat(e).size, a = new Uint8Array(o);
			return n.read(t, a, 0, o, 0), r.encoding === "utf8" && (a = re(a)), n.close(t), a;
		},
		writeFile(e, r, t = {}) {
			t.flags = t.flags ?? 577;
			var o = n.open(e, t.flags, t.mode);
			r = xe(r), n.write(o, r, 0, r.byteLength, void 0, t.canOwn), n.close(o);
		},
		cwd: () => n.currentPath,
		chdir(e) {
			var r = n.lookupPath(e, { follow: !0 });
			if (r.node === null) throw new n.ErrnoError(44);
			if (!n.isDir(r.node.mode)) throw new n.ErrnoError(54);
			var t = n.nodePermissions(r.node, "x");
			if (t) throw new n.ErrnoError(t);
			n.currentPath = r.path;
		},
		createDefaultDirectories() {
			n.mkdir("/tmp"), n.mkdir("/home"), n.mkdir("/home/web_user");
		},
		createDefaultDevices() {
			n.mkdir("/dev"), n.registerDevice(n.makedev(1, 3), {
				read: () => 0,
				write: (o, a, i, s, f) => s,
				llseek: () => 0
			}), n.mkdev("/dev/null", n.makedev(1, 3)), X.register(n.makedev(5, 0), X.default_tty_ops), X.register(n.makedev(6, 0), X.default_tty1_ops), n.mkdev("/dev/tty", n.makedev(5, 0)), n.mkdev("/dev/tty1", n.makedev(6, 0));
			var e = /* @__PURE__ */ new Uint8Array(1024), r = 0, t = () => (r === 0 && (ze(e), r = e.byteLength), e[--r]);
			n.createDevice("/dev", "random", t), n.createDevice("/dev", "urandom", t), n.mkdir("/dev/shm"), n.mkdir("/dev/shm/tmp");
		},
		createSpecialDirectories() {
			n.mkdir("/proc");
			var e = n.mkdir("/proc/self");
			n.mkdir("/proc/self/fd"), n.mount({ mount() {
				var r = n.createNode(e, "fd", 16895, 73);
				return r.stream_ops = { llseek: y.stream_ops.llseek }, r.node_ops = {
					lookup(t, o) {
						var a = +o, i = n.getStreamChecked(a), s = {
							parent: null,
							mount: { mountpoint: "fake" },
							node_ops: { readlink: () => i.path },
							id: a + 1
						};
						return s.parent = s, s;
					},
					readdir() {
						return Array.from(n.streams.entries()).filter(([t, o]) => o).map(([t, o]) => t.toString());
					}
				}, r;
			} }, {}, "/proc/self/fd");
		},
		createStandardStreams(e, r, t) {
			e ? n.createDevice("/dev", "stdin", e) : n.symlink("/dev/tty", "/dev/stdin"), r ? n.createDevice("/dev", "stdout", null, r) : n.symlink("/dev/tty", "/dev/stdout"), t ? n.createDevice("/dev", "stderr", null, t) : n.symlink("/dev/tty1", "/dev/stderr"), n.open("/dev/stdin", 0), n.open("/dev/stdout", 1), n.open("/dev/stderr", 1);
		},
		staticInit() {
			n.nameTable = new Array(4096), n.mount(y, {}, "/"), n.createDefaultDirectories(), n.createDefaultDevices(), n.createSpecialDirectories(), n.filesystems = {
				MEMFS: y,
				WORKERFS: M
			};
		},
		init(e, r, t) {
			n.initialized = !0, e ??= l.stdin, r ??= l.stdout, t ??= l.stderr, n.createStandardStreams(e, r, t);
		},
		quit() {
			n.initialized = !1;
			for (var e of n.streams) e && n.close(e);
		},
		findObject(e, r) {
			var t = n.analyzePath(e, r);
			return t.exists ? t.object : null;
		},
		analyzePath(e, r) {
			try {
				var t = n.lookupPath(e, { follow: !r });
				e = t.path;
			} catch {}
			var o = {
				isRoot: !1,
				exists: !1,
				error: 0,
				name: null,
				path: null,
				object: null,
				parentExists: !1,
				parentPath: null,
				parentObject: null
			};
			try {
				var t = n.lookupPath(e, { parent: !0 });
				o.parentExists = !0, o.parentPath = t.path, o.parentObject = t.node, o.name = k.basename(e), t = n.lookupPath(e, { follow: !r }), o.exists = !0, o.path = t.path, o.object = t.node, o.name = t.node.name, o.isRoot = t.path === "/";
			} catch (a) {
				o.error = a.errno;
			}
			return o;
		},
		createPath(e, r, t, o) {
			e = typeof e == "string" ? e : n.getPath(e);
			for (var a = r.split("/").reverse(); a.length;) {
				var i = a.pop();
				if (i) {
					var s = k.join2(e, i);
					try {
						n.mkdir(s);
					} catch (f) {
						if (f.errno != 20) throw f;
					}
					e = s;
				}
			}
			return s;
		},
		createFile(e, r, t, o, a) {
			var i = k.join2(typeof e == "string" ? e : n.getPath(e), r), s = Se(o, a);
			return n.create(i, s);
		},
		createDataFile(e, r, t, o, a, i) {
			var s = r;
			e && (e = typeof e == "string" ? e : n.getPath(e), s = r ? k.join2(e, r) : e);
			var f = Se(o, a), c = n.create(s, f);
			if (t) {
				t = xe(t), n.chmod(c, f | 146);
				var u = n.open(c, 577);
				n.write(u, t, 0, t.length, 0, i), n.close(u), n.chmod(c, f);
			}
		},
		createDevice(e, r, t, o) {
			var a = k.join2(typeof e == "string" ? e : n.getPath(e), r), i = Se(!!t, !!o);
			n.createDevice.major ??= 64;
			var s = n.makedev(n.createDevice.major++, 0);
			return n.registerDevice(s, {
				open(f) {
					f.seekable = !1;
				},
				close(f) {
					o?.buffer?.length && o(10);
				},
				read(f, c, u, m, d) {
					for (var h = 0, p = 0; p < m; p++) {
						var g;
						try {
							g = t();
						} catch {
							throw new n.ErrnoError(29);
						}
						if (g === void 0 && h === 0) throw new n.ErrnoError(6);
						if (g == null) break;
						h++, c[u + p] = g;
					}
					return h && (f.node.atime = Date.now()), h;
				},
				write(f, c, u, m, d) {
					for (var h = 0; h < m; h++) try {
						o(c[u + h]);
					} catch {
						throw new n.ErrnoError(29);
					}
					return m && (f.node.mtime = f.node.ctime = Date.now()), h;
				}
			}), n.mkdev(a, i, s);
		},
		forceLoadFile(e) {
			if (e.isDevice || e.isFolder || e.link || e.contents) return !0;
			if (globalThis.XMLHttpRequest) I("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
			else try {
				e.contents = se(e.url);
			} catch {
				throw new n.ErrnoError(29);
			}
		},
		createLazyFile(e, r, t, o, a) {
			class i {
				lengthKnown = !1;
				chunks = [];
				get(d) {
					if (!(d > this.length - 1 || d < 0)) {
						var h = d % this.chunkSize, p = d / this.chunkSize | 0;
						return this.getter(p)[h];
					}
				}
				setDataGetter(d) {
					this.getter = d;
				}
				cacheLength() {
					var d = new XMLHttpRequest();
					d.open("HEAD", t, !1), d.send(null), d.status >= 200 && d.status < 300 || d.status === 304 || I("Couldn't load " + t + ". Status: " + d.status);
					var h = Number(d.getResponseHeader("Content-length")), p, g = (p = d.getResponseHeader("Accept-Ranges")) && p === "bytes", S = (p = d.getResponseHeader("Content-Encoding")) && p === "gzip", N = 1024 * 1024;
					g || (N = h);
					var A = (L, W) => {
						L > W && I(`invalid range (${L}, ${W}) or no bytes requested!`), W > h - 1 && I(`only ${h} bytes available! programmer error!`);
						var D = new XMLHttpRequest();
						return D.open("GET", t, !1), h !== N && D.setRequestHeader("Range", "bytes=" + L + "-" + W), D.responseType = "arraybuffer", D.overrideMimeType && D.overrideMimeType("text/plain; charset=x-user-defined"), D.send(null), D.status >= 200 && D.status < 300 || D.status === 304 || I("Couldn't load " + t + ". Status: " + D.status), D.response !== void 0 ? new Uint8Array(D.response || []) : ke(D.responseText ?? "", !0);
					}, O = this;
					O.setDataGetter((L) => {
						var W = L * N, D = (L + 1) * N - 1;
						return D = Math.min(D, h - 1), typeof O.chunks[L] > "u" && (O.chunks[L] = A(W, D)), typeof O.chunks[L] > "u" && I("doXHR failed!"), O.chunks[L];
					}), (S || !h) && (N = h = 1, h = this.getter(0).length, N = h, fe("LazyFiles on gzip forces download of the whole file when length is accessed")), this._length = h, this._chunkSize = N, this.lengthKnown = !0;
				}
				get length() {
					return this.lengthKnown || this.cacheLength(), this._length;
				}
				get chunkSize() {
					return this.lengthKnown || this.cacheLength(), this._chunkSize;
				}
			}
			if (globalThis.XMLHttpRequest) {
				T || I("Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc");
				var s = {
					isDevice: !1,
					contents: new i()
				};
			} else var s = {
				isDevice: !1,
				url: t
			};
			var f = n.createFile(e, r, s, o, a);
			s.contents ? f.contents = s.contents : s.url && (f.contents = null, f.url = s.url), Object.defineProperties(f, { usedBytes: { get: function() {
				return this.contents.length;
			} } });
			var c = {};
			for (const [m, d] of Object.entries(f.stream_ops)) c[m] = (...h) => (n.forceLoadFile(f), d(...h));
			function u(m, d, h, p, g) {
				var S = m.node.contents;
				if (g >= S.length) return 0;
				var N = Math.min(S.length - g, p);
				if (S.slice) for (var A = 0; A < N; A++) d[h + A] = S[g + A];
				else for (var A = 0; A < N; A++) d[h + A] = S.get(g + A);
				return N;
			}
			return c.read = (m, d, h, p, g) => (n.forceLoadFile(f), u(m, d, h, p, g)), c.mmap = (m, d, h, p, g) => {
				n.forceLoadFile(f);
				var S = je(d);
				if (!S) throw new n.ErrnoError(48);
				return u(m, C, S, d, h), {
					ptr: S,
					allocated: !0
				};
			}, f.stream_ops = c, f;
		}
	}, jr = (e, r, t) => e ? re(Z, e, r, t) : "", _ = {
		currentUmask: 18,
		calculateAt(e, r, t) {
			if (k.isAbs(r)) return r;
			var o;
			if (e === -100 ? o = n.cwd() : o = _.getStreamFromFD(e).path, r.length == 0) {
				if (!t) throw new n.ErrnoError(44);
				return o;
			}
			return o + "/" + r;
		},
		writeStat(e, r) {
			E[e >> 2] = r.dev, E[e + 4 >> 2] = r.mode, E[e + 8 >> 2] = r.nlink, E[e + 12 >> 2] = r.uid, E[e + 16 >> 2] = r.gid, E[e + 20 >> 2] = r.rdev, F[e + 24 >> 3] = BigInt(r.size), w[e + 32 >> 2] = 4096, w[e + 36 >> 2] = r.blocks;
			var t = r.atime.getTime(), o = r.mtime.getTime(), a = r.ctime.getTime();
			return F[e + 40 >> 3] = BigInt(Math.floor(t / 1e3)), E[e + 48 >> 2] = t % 1e3 * 1e3 * 1e3, F[e + 56 >> 3] = BigInt(Math.floor(o / 1e3)), E[e + 64 >> 2] = o % 1e3 * 1e3 * 1e3, F[e + 72 >> 3] = BigInt(Math.floor(a / 1e3)), E[e + 80 >> 2] = a % 1e3 * 1e3 * 1e3, F[e + 88 >> 3] = BigInt(r.ino), 0;
		},
		writeStatFs(e, r) {
			E[e + 4 >> 2] = r.bsize, E[e + 60 >> 2] = r.bsize, F[e + 8 >> 3] = BigInt(r.blocks), F[e + 16 >> 3] = BigInt(r.bfree), F[e + 24 >> 3] = BigInt(r.bavail), F[e + 32 >> 3] = BigInt(r.files), F[e + 40 >> 3] = BigInt(r.ffree), E[e + 48 >> 2] = r.fsid, E[e + 64 >> 2] = r.flags, E[e + 56 >> 2] = r.namelen;
		},
		doMsync(e, r, t, o, a) {
			if (!n.isFile(r.node.mode)) throw new n.ErrnoError(43);
			if (o & 2) return 0;
			var i = Z.subarray(e, e + t);
			n.msync(r, i, a, t, o);
		},
		getStreamFromFD(e) {
			return n.getStreamChecked(e);
		},
		varargs: void 0,
		getStr(e) {
			return jr(e);
		}
	};
	function xr(e, r, t, o) {
		try {
			if (r = _.getStr(r), r = _.calculateAt(e, r), t & -8) return -28;
			var a = n.lookupPath(r, { follow: !0 }).node;
			if (!a) return -44;
			var i = "";
			return t & 4 && (i += "r"), t & 2 && (i += "w"), t & 1 && (i += "x"), i && n.nodePermissions(a, i) ? -2 : 0;
		} catch (s) {
			if (typeof n > "u" || s.name !== "ErrnoError") throw s;
			return -s.errno;
		}
	}
	var le = () => {
		var e = w[+_.varargs >> 2];
		return _.varargs += 4, e;
	}, te = le;
	function $r(e, r, t) {
		_.varargs = t;
		try {
			var o = _.getStreamFromFD(e);
			switch (r) {
				case 0:
					var i = le();
					if (i < 0) return -28;
					for (; n.streams[i];) i++;
					return n.dupStream(o, i).fd;
				case 1:
				case 2: return 0;
				case 3: return o.flags;
				case 4:
					var i = le(), a = 289792;
					return o.flags = o.flags & ~a | i & a, 0;
				case 12:
					var i = te(), s = 0;
					return j[i + s >> 1] = 2, 0;
				case 13:
				case 14: return 0;
			}
			return -28;
		} catch (f) {
			if (typeof n > "u" || f.name !== "ErrnoError") throw f;
			return -f.errno;
		}
	}
	function Hr(e, r) {
		try {
			return _.writeStat(r, n.fstat(e));
		} catch (t) {
			if (typeof n > "u" || t.name !== "ErrnoError") throw t;
			return -t.errno;
		}
	}
	var Q = (e, r, t) => Ue(e, Z, r, t);
	function Wr(e, r, t) {
		try {
			var o = _.getStreamFromFD(e);
			o.getdents ||= n.readdir(o.path);
			for (var a = 280, i = 0, s = n.llseek(o, 0, 1), f = Math.floor(s / a), c = Math.min(o.getdents.length, f + Math.floor(t / a)), u = f; u < c; u++) {
				var m, d, h = o.getdents[u];
				if (h === ".") m = o.node.id, d = 4;
				else if (h === "..") m = n.lookupPath(o.path, { parent: !0 }).node.id, d = 4;
				else {
					var p;
					try {
						p = n.lookupNode(o.node, h);
					} catch (g) {
						if (g?.errno === 28) continue;
						throw g;
					}
					m = p.id, d = n.isChrdev(p.mode) ? 2 : n.isDir(p.mode) ? 4 : n.isLink(p.mode) ? 10 : 8;
				}
				F[r + i >> 3] = BigInt(m), F[r + i + 8 >> 3] = BigInt((u + 1) * a), j[r + i + 16 >> 1] = 280, C[r + i + 18] = d, Q(h, r + i + 19, 256), i += a;
			}
			return n.llseek(o, u * a, 0), i;
		} catch (g) {
			if (typeof n > "u" || g.name !== "ErrnoError") throw g;
			return -g.errno;
		}
	}
	function Yr(e, r, t) {
		_.varargs = t;
		try {
			var o = _.getStreamFromFD(e);
			switch (r) {
				case 21509: return o.tty ? 0 : -59;
				case 21505:
					if (!o.tty) return -59;
					if (o.tty.ops.ioctl_tcgets) {
						var a = o.tty.ops.ioctl_tcgets(o), d = te();
						w[d >> 2] = a.c_iflag || 0, w[d + 4 >> 2] = a.c_oflag || 0, w[d + 8 >> 2] = a.c_cflag || 0, w[d + 12 >> 2] = a.c_lflag || 0;
						for (var i = 0; i < 32; i++) C[d + i + 17] = a.c_cc[i] || 0;
						return 0;
					}
					return 0;
				case 21510:
				case 21511:
				case 21512: return o.tty ? 0 : -59;
				case 21506:
				case 21507:
				case 21508:
					if (!o.tty) return -59;
					if (o.tty.ops.ioctl_tcsets) {
						for (var d = te(), s = w[d >> 2], f = w[d + 4 >> 2], c = w[d + 8 >> 2], u = w[d + 12 >> 2], m = [], i = 0; i < 32; i++) m.push(C[d + i + 17]);
						return o.tty.ops.ioctl_tcsets(o.tty, r, {
							c_iflag: s,
							c_oflag: f,
							c_cflag: c,
							c_lflag: u,
							c_cc: m
						});
					}
					return 0;
				case 21519:
					if (!o.tty) return -59;
					var d = te();
					return w[d >> 2] = 0, 0;
				case 21520: return o.tty ? -28 : -59;
				case 21537:
				case 21531:
					var d = te();
					return n.ioctl(o, r, d);
				case 21523:
					if (!o.tty) return -59;
					if (o.tty.ops.ioctl_tiocgwinsz) {
						var h = o.tty.ops.ioctl_tiocgwinsz(o.tty), d = te();
						j[d >> 1] = h[0], j[d + 2 >> 1] = h[1];
					}
					return 0;
				case 21524: return o.tty ? 0 : -59;
				case 21515: return o.tty ? 0 : -59;
				default: return -28;
			}
		} catch (p) {
			if (typeof n > "u" || p.name !== "ErrnoError") throw p;
			return -p.errno;
		}
	}
	function Gr(e, r) {
		try {
			return e = _.getStr(e), _.writeStat(r, n.lstat(e));
		} catch (t) {
			if (typeof n > "u" || t.name !== "ErrnoError") throw t;
			return -t.errno;
		}
	}
	function Vr(e, r, t, o) {
		try {
			r = _.getStr(r);
			var a = o & 256, i = o & 4096;
			return o = o & -6401, r = _.calculateAt(e, r, i), _.writeStat(t, a ? n.lstat(r) : n.stat(r));
		} catch (s) {
			if (typeof n > "u" || s.name !== "ErrnoError") throw s;
			return -s.errno;
		}
	}
	function Xr(e, r, t, o) {
		_.varargs = o;
		try {
			r = _.getStr(r), r = _.calculateAt(e, r);
			var a = o ? le() : 0;
			return t & 64 && (a &= ~_.currentUmask), n.open(r, t, a).fd;
		} catch (i) {
			if (typeof n > "u" || i.name !== "ErrnoError") throw i;
			return -i.errno;
		}
	}
	var Kr = (e, r) => {
		var t = n.getStream(e);
		return t ? (t.stream_ops?.poll ? t.stream_ops.poll(t) : 5) & (r | 56) : 32;
	}, qr = (e, r) => {
		for (var t = 0, o = 0, a = e; o < r; o++, a += 8) {
			var i = Kr(w[a >> 2], j[a + 4 >> 1]);
			i && t++, j[a + 6 >> 1] = i;
		}
		return t;
	};
	function Zr(e, r, t) {
		try {
			return qr(e, r);
		} catch (o) {
			if (typeof n > "u" || o.name !== "ErrnoError") throw o;
			return -o.errno;
		}
	}
	function Jr(e, r, t, o) {
		try {
			return r = _.getStr(r), o = _.getStr(o), r = _.calculateAt(e, r), o = _.calculateAt(t, o), n.rename(r, o), 0;
		} catch (a) {
			if (typeof n > "u" || a.name !== "ErrnoError") throw a;
			return -a.errno;
		}
	}
	function Qr(e) {
		try {
			return e = _.getStr(e), n.rmdir(e), 0;
		} catch (r) {
			if (typeof n > "u" || r.name !== "ErrnoError") throw r;
			return -r.errno;
		}
	}
	function et(e, r) {
		try {
			return e = _.getStr(e), _.writeStat(r, n.stat(e));
		} catch (t) {
			if (typeof n > "u" || t.name !== "ErrnoError") throw t;
			return -t.errno;
		}
	}
	function rt(e, r, t) {
		try {
			if (r = _.getStr(r), r = _.calculateAt(e, r), !t) n.unlink(r);
			else if (t === 512) n.rmdir(r);
			else return -28;
			return 0;
		} catch (o) {
			if (typeof n > "u" || o.name !== "ErrnoError") throw o;
			return -o.errno;
		}
	}
	var tt = () => I(""), nt = () => {
		throw new dr();
	}, ot = 9007199254740992, at = -9007199254740992, ce = (e) => e < at || e > ot ? NaN : Number(e);
	function it(e, r) {
		e = ce(e);
		var t = /* @__PURE__ */ new Date(e * 1e3);
		if (isNaN(t.getTime())) return 1;
		w[r >> 2] = t.getUTCSeconds(), w[r + 4 >> 2] = t.getUTCMinutes(), w[r + 8 >> 2] = t.getUTCHours(), w[r + 12 >> 2] = t.getUTCDate(), w[r + 16 >> 2] = t.getUTCMonth(), w[r + 20 >> 2] = t.getUTCFullYear() - 1900, w[r + 24 >> 2] = t.getUTCDay();
		var o = Date.UTC(t.getUTCFullYear(), 0, 1, 0, 0, 0, 0), a = (t.getTime() - o) / (1e3 * 60 * 60 * 24) | 0;
		return w[r + 28 >> 2] = a, 0;
	}
	var st = (e) => e % 4 === 0 && (e % 100 !== 0 || e % 400 === 0), ft = [
		0,
		31,
		60,
		91,
		121,
		152,
		182,
		213,
		244,
		274,
		305,
		335
	], lt = [
		0,
		31,
		59,
		90,
		120,
		151,
		181,
		212,
		243,
		273,
		304,
		334
	], Ye = (e) => (st(e.getFullYear()) ? ft : lt)[e.getMonth()] + e.getDate() - 1;
	function ct(e, r) {
		e = ce(e);
		var t = /* @__PURE__ */ new Date(e * 1e3);
		if (isNaN(t.getTime())) return 1;
		w[r >> 2] = t.getSeconds(), w[r + 4 >> 2] = t.getMinutes(), w[r + 8 >> 2] = t.getHours(), w[r + 12 >> 2] = t.getDate(), w[r + 16 >> 2] = t.getMonth(), w[r + 20 >> 2] = t.getFullYear() - 1900, w[r + 24 >> 2] = t.getDay();
		var o = Ye(t) | 0;
		w[r + 28 >> 2] = o, w[r + 36 >> 2] = -(t.getTimezoneOffset() * 60);
		var a = new Date(t.getFullYear(), 0, 1), i = new Date(t.getFullYear(), 6, 1).getTimezoneOffset(), s = a.getTimezoneOffset(), f = (i != s && t.getTimezoneOffset() == Math.min(s, i)) | 0;
		return w[r + 32 >> 2] = f, 0;
	}
	var dt = function(e) {
		var r = (() => {
			var t = new Date(w[e + 20 >> 2] + 1900, w[e + 16 >> 2], w[e + 12 >> 2], w[e + 8 >> 2], w[e + 4 >> 2], w[e >> 2], 0);
			if (isNaN(t.getTime())) return -1;
			var o = w[e + 32 >> 2], a = t.getTimezoneOffset(), i = new Date(t.getFullYear(), 0, 1), s = new Date(t.getFullYear(), 6, 1).getTimezoneOffset(), f = i.getTimezoneOffset(), c = Math.min(f, s);
			if (o < 0) o = +(s != f && c == a);
			else if (o > 0 != (c == a)) {
				var u = o > 0 ? c : Math.max(f, s);
				if (t.setTime(t.getTime() + (u - a) * 6e4), isNaN(t.getTime())) return -1;
			}
			w[e + 32 >> 2] = o, w[e + 24 >> 2] = t.getDay();
			var m = Ye(t) | 0;
			return w[e + 28 >> 2] = m, w[e >> 2] = t.getSeconds(), w[e + 4 >> 2] = t.getMinutes(), w[e + 8 >> 2] = t.getHours(), w[e + 12 >> 2] = t.getDate(), w[e + 16 >> 2] = t.getMonth(), w[e + 20 >> 2] = t.getYear(), t.getTime() / 1e3;
		})();
		return BigInt(r);
	}, ut = (e, r, t, o) => {
		var a = (/* @__PURE__ */ new Date()).getFullYear(), i = new Date(a, 0, 1), s = new Date(a, 6, 1), f = i.getTimezoneOffset(), c = s.getTimezoneOffset(), u = Math.max(f, c);
		E[e >> 2] = u * 60, w[r >> 2] = +(f != c);
		var m = (p) => {
			var g = p >= 0 ? "-" : "+", S = Math.abs(p);
			return `UTC${g}${String(Math.floor(S / 60)).padStart(2, "0")}${String(S % 60).padStart(2, "0")}`;
		}, d = m(f), h = m(c);
		c < f ? (Q(d, t, 17), Q(h, o, 17)) : (Q(d, o, 17), Q(h, t, 17));
	}, Ge = () => performance.now(), Ve = () => Date.now(), mt = 1, vt = (e) => e >= 0 && e <= 3;
	function ht(e, r, t) {
		if (r = ce(r), !vt(e)) return 28;
		var o;
		if (e === 0) o = Ve();
		else if (mt) o = Ge();
		else return 52;
		var a = Math.round(o * 1e3 * 1e3);
		return F[t >> 3] = BigInt(a), 0;
	}
	var be = [], wt = (e, r) => {
		be.length = 0;
		for (var t; t = Z[e++];) {
			var o = t != 105;
			o &= t != 112, r += o && r % 8 ? 4 : 0, be.push(t == 112 ? E[r >> 2] : t == 106 ? F[r >> 3] : t == 105 ? w[r >> 2] : pe[r >> 3]), r += o ? 8 : 4;
		}
		return be;
	}, gt = (e, r, t) => {
		var o = wt(r, t);
		return Bt[e](...o);
	}, yt = (e, r, t) => gt(e, r, t), pt = () => 268435456, _t = (e, r) => Math.ceil(e / r) * r, Et = (e) => {
		var r = (e - de.buffer.byteLength + 65535) / 65536 | 0;
		try {
			return de.grow(r), Ne(), 1;
		} catch {}
	}, kt = (e) => {
		var r = Z.length;
		e >>>= 0;
		var t = pt();
		if (e > t) return !1;
		for (var o = 1; o <= 4; o *= 2) {
			var a = r * (1 + .2 / o);
			if (a = Math.min(a, e + 100663296), Et(Math.min(t, _t(Math.max(e, a), 65536)))) return !0;
		}
		return !1;
	}, De = {}, St = () => Ae, oe = () => {
		if (!oe.strings) {
			var e = {
				USER: "web_user",
				LOGNAME: "web_user",
				PATH: "/",
				PWD: "/",
				HOME: "/home/web_user",
				LANG: (globalThis.navigator?.language ?? "C").replace("-", "_") + ".UTF-8",
				_: St()
			};
			for (var r in De) De[r] === void 0 ? delete e[r] : e[r] = De[r];
			var t = [];
			for (var r in e) t.push(`${r}=${e[r]}`);
			oe.strings = t;
		}
		return oe.strings;
	}, bt = (e, r) => {
		var t = 0, o = 0;
		for (var a of oe()) {
			var i = r + t;
			E[e + o >> 2] = i, t += Q(a, i, Infinity) + 1, o += 4;
		}
		return 0;
	}, Dt = (e, r) => {
		var t = oe();
		E[e >> 2] = t.length;
		var o = 0;
		for (var a of t) o += Ee(a) + 1;
		return E[r >> 2] = o, 0;
	}, Ft = 0, At = () => Oe || Ft > 0, Mt = (e) => {
		At() || (l.onExit?.(e), ye = !0), fr(e, new Sr(e));
	}, Tt = (e, r) => {
		Mt(e);
	}, Nt = Tt;
	function Rt(e) {
		try {
			var r = _.getStreamFromFD(e);
			return n.close(r), 0;
		} catch (t) {
			if (typeof n > "u" || t.name !== "ErrnoError") throw t;
			return t.errno;
		}
	}
	function Ct(e, r) {
		try {
			var t = 0, o = 0, a = 0, i = _.getStreamFromFD(e), s = i.tty ? 2 : n.isDir(i.mode) ? 3 : n.isLink(i.mode) ? 7 : 4;
			return C[r] = s, j[r + 2 >> 1] = a, F[r + 8 >> 3] = BigInt(t), F[r + 16 >> 3] = BigInt(o), 0;
		} catch (f) {
			if (typeof n > "u" || f.name !== "ErrnoError") throw f;
			return f.errno;
		}
	}
	var Pt = (e, r, t, o) => {
		for (var a = 0, i = 0; i < t; i++) {
			var s = E[r >> 2], f = E[r + 4 >> 2];
			r += 8;
			try {
				var c = n.read(e, C, s, f, o);
			} catch (u) {
				if (a > 0 && u instanceof n.ErrnoError && (u.errno == 6 || u.errno == 6)) break;
				throw u;
			}
			if (c < 0) return -1;
			if (a += c, c < f) break;
			typeof o < "u" && (o += c);
		}
		return a;
	};
	function It(e, r, t, o) {
		try {
			var a = Pt(_.getStreamFromFD(e), r, t);
			return E[o >> 2] = a, 0;
		} catch (i) {
			if (typeof n > "u" || i.name !== "ErrnoError") throw i;
			return i.errno;
		}
	}
	function Lt(e, r, t, o) {
		r = ce(r);
		try {
			if (isNaN(r)) return 22;
			var a = _.getStreamFromFD(e);
			return n.llseek(a, r, t), F[o >> 3] = BigInt(a.position), a.getdents && r === 0 && t === 0 && (a.getdents = null), 0;
		} catch (i) {
			if (typeof n > "u" || i.name !== "ErrnoError") throw i;
			return i.errno;
		}
	}
	var Ot = (e, r, t, o) => {
		if (t == 1) return n.write(e, C, E[r >> 2], E[r + 4 >> 2], o);
		for (var a = 0, i = 0, s = r; i < t; i++, s += 8) a += E[s + 4 >> 2];
		for (var f = new Uint8Array(a), c = 0, i = 0; i < t; i++, r += 8) {
			var u = E[r >> 2], m = E[r + 4 >> 2];
			f.set(Z.subarray(u, u + m), c), c += m;
		}
		return n.write(e, f, 0, a, o);
	};
	function zt(e, r, t, o) {
		try {
			var a = Ot(_.getStreamFromFD(e), r, t);
			return E[o >> 2] = a, 0;
		} catch (i) {
			if (typeof n > "u" || i.name !== "ErrnoError") throw i;
			return i.errno;
		}
	}
	var Xe = [], K = (e) => {
		var r = Xe[e];
		return r || (Xe[e] = r = Ze.get(e)), r;
	};
	n.createPreloadedFile = Ur, n.preloadFile = We, n.staticInit(), l.noExitRuntime && (Oe = l.noExitRuntime), l.print && (fe = l.print), l.printErr && (Y = l.printErr), l.arguments && l.arguments, l.thisProgram && (Ae = l.thisProgram);
	var ne = l.preInit;
	if (ne) for (typeof ne == "function" && (l.preInit = ne = [ne]); ne.length > 0;) ne.shift()();
	l.setValue = Fr, l.stringToUTF8 = Q, l.lengthBytesUTF8 = Ee, l.FS = n;
	var Bt = { 516516: (e) => {
		l.ret = e;
	} };
	function Ut(e, r) {
		l.receiveProgress(e, r);
	}
	function jt(e) {
		return l.timeout === -1 ? 0 : l.timeout <= e;
	}
	var H, Ke, qe, de, Ze;
	function xt(e) {
		l._abort = e.T, l._parakeet_audio_decoder_open = e.U, l._parakeet_audio_decoder_estimated_sample_count = e.V, l._parakeet_audio_decoder_pull = e.W, l._parakeet_audio_decoder_done = e.X, l._parakeet_audio_decoder_close = e.Y, l._parakeet_audio_decoder_cancel = e.Z, l._ffmpeg = e._, l._free = e.$, l._malloc = e.aa, H = e.ba, Ke = e.ca, qe = e.da, de = e.Q, Ze = e.S;
	}
	var $t = {
		L: xr,
		g: $r,
		J: Hr,
		x: Wr,
		f: Yr,
		G: Gr,
		H: Vr,
		n: Xr,
		v: Zr,
		w: Jr,
		k: Qr,
		I: et,
		l: rt,
		M: tt,
		s: nt,
		y: it,
		z: ct,
		A: dt,
		B: ut,
		K: ht,
		P: yt,
		o: Ve,
		m: Ge,
		t: kt,
		E: bt,
		F: Dt,
		O: Nt,
		c: Rt,
		D: Ct,
		p: It,
		C: Lt,
		e: zt,
		a: Vt,
		d: Wt,
		i: Xt,
		r: Kt,
		u: Yt,
		b: Ht,
		j: Gt,
		h: qt,
		N: jt,
		q: Ut
	};
	function Ht(e, r) {
		var t = V();
		try {
			K(e)(r);
		} catch (o) {
			if (G(t), !(o instanceof $)) throw o;
			H(1, 0);
		}
	}
	function Wt(e, r) {
		var t = V();
		try {
			return K(e)(r);
		} catch (o) {
			if (G(t), !(o instanceof $)) throw o;
			H(1, 0);
		}
	}
	function Yt(e) {
		var r = V();
		try {
			K(e)();
		} catch (t) {
			if (G(r), !(t instanceof $)) throw t;
			H(1, 0);
		}
	}
	function Gt(e, r, t, o) {
		var a = V();
		try {
			K(e)(r, t, o);
		} catch (i) {
			if (G(a), !(i instanceof $)) throw i;
			H(1, 0);
		}
	}
	function Vt(e) {
		var r = V();
		try {
			return K(e)();
		} catch (t) {
			if (G(r), !(t instanceof $)) throw t;
			H(1, 0);
		}
	}
	function Xt(e, r, t) {
		var o = V();
		try {
			return K(e)(r, t);
		} catch (a) {
			if (G(o), !(a instanceof $)) throw a;
			H(1, 0);
		}
	}
	function Kt(e) {
		var r = V();
		try {
			return K(e)();
		} catch (t) {
			if (G(r), !(t instanceof $)) throw t;
			return H(1, 0), 0n;
		}
	}
	function qt(e, r, t, o, a) {
		var i = V();
		try {
			K(e)(r, t, o, a);
		} catch (s) {
			if (G(i), !(s instanceof $)) throw s;
			H(1, 0);
		}
	}
	async function Zt() {
		mr(), J && await Ir();
		var e = l.setStatus;
		e && (e("Running..."), await new Promise((r) => he(r, 1)), he(e, 1, "")), !ye && (vr(), l.onRuntimeInitialized?.(), hr());
	}
	var ue = await kr();
	return await Zt(), l;
}
const me = self;
let Qe = !1;
me.addEventListener("message", (v) => {
	v.data.type !== "start-streaming-decode" || Qe || (Qe = !0, tn(v.data));
});
async function tn(v) {
	const l = rr(), R = performance.now();
	let T, z = !1;
	try {
		if (typeof Je != "function") throw new Error("The packaged FFmpeg core has no module factory.");
		const b = await Je({ wasmURL: v.ffmpegCoreWasm });
		b.FS.mkdir("/input");
		const P = sn(v.fileName);
		b.FS.mount(b.FS.filesystems.WORKERFS, { blobs: [{
			name: P,
			data: v.audio
		}] }, "/input"), T = b.createIncrementalAudioDecoder(`/input/${P}`), me.postMessage({
			type: "streaming-decoder-ready",
			requestId: v.requestId,
			estimatedSampleCount: T.estimatedSampleCount
		}), z = !0, await nn(v, T, l, R);
	} catch (b) {
		try {
			T?.cancel();
		} catch {}
		z ? v.port.postMessage({
			type: "pcm-failed",
			message: er(b)
		}) : me.postMessage({
			type: "streaming-decoder-open-failed",
			requestId: v.requestId,
			message: er(b)
		}), await fn(v.scratchDirectory);
	} finally {
		try {
			T?.close();
		} catch {}
		v.port.close(), me.close();
	}
}
async function nn(v, l, R, T) {
	const z = await navigator.storage.getDirectory();
	await Qt();
	const b = await (await z.getDirectoryHandle(Fe, { create: !0 })).getDirectoryHandle(v.scratchDirectory, { create: !0 });
	let P = 0, B = 0, U = 0;
	for (;;) {
		const ae = P === 0 ? 8275201 : 8243200, x = l.decodeNext(ae);
		if (an(x, ae, U), U = x.totalDecodeMs, x.sampleCount > 0) {
			const ve = await on(b, P, x.samples);
			v.port.postMessage({
				type: "pcm-segment",
				segmentIndex: P,
				startSample: B,
				sampleCount: x.sampleCount,
				file: ve
			}), B += x.sampleCount, P += 1;
		}
		if (x.done) break;
	}
	const q = rr();
	v.port.postMessage({
		type: "pcm-end",
		totalSamples: B,
		outputByteLength: B * Int16Array.BYTES_PER_ELEMENT,
		decoderWallMs: Math.max(0, performance.now() - T),
		decoderActiveMs: U,
		decoderStartedAtMs: R,
		decoderEndedAtMs: q
	});
}
async function on(v, l, R) {
	const T = `pcm-${l.toString().padStart(8, "0")}.s16le`, z = await v.getFileHandle(T, { create: !0 }), b = await z.createSyncAccessHandle();
	try {
		b.truncate(0);
		const B = new Uint8Array(R.buffer, R.byteOffset, R.byteLength);
		let U = 0;
		for (; U < B.byteLength;) {
			const q = b.write(B.subarray(U), { at: U });
			if (!Number.isSafeInteger(q) || q <= 0) throw new Error("OPFS produced a short PCM segment write");
			U += q;
		}
		b.flush();
	} finally {
		b.close();
	}
	const P = await z.getFile();
	if (P.size !== R.byteLength) throw new Error("Immutable OPFS PCM segment has the wrong size");
	return P;
}
function an(v, l, R) {
	if (!(v.samples instanceof Int16Array) || v.samples.byteOffset !== 0 || v.samples.byteLength !== v.samples.buffer.byteLength || !Number.isSafeInteger(v.sampleCount) || v.sampleCount < 0 || v.sampleCount > l || v.samples.length !== v.sampleCount || typeof v.done != "boolean" || !Number.isFinite(v.decodeMs) || v.decodeMs < 0 || !Number.isFinite(v.totalDecodeMs) || v.totalDecodeMs < R || v.totalDecodeMs < v.decodeMs || v.sampleCount === 0 && !v.done) throw new Error("Incremental FFmpeg decoder returned an invalid step");
}
function sn(v) {
	return `source${/\.([a-z0-9]{1,10})$/i.exec(v)?.[0]?.toLowerCase() ?? ".audio"}`;
}
function er(v) {
	return v instanceof Error ? v.message : "Audio decoding failed.";
}
function rr() {
	return performance.timeOrigin + performance.now();
}
async function fn(v) {
	try {
		await (await (await navigator.storage.getDirectory()).getDirectoryHandle(Fe)).removeEntry(v, { recursive: !0 });
	} catch {}
}
