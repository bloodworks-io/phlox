import type { AudioDecodingRuntimeAssets } from "./audio/audio-decoding-assets.js";
/**
 * Resolve the package-owned FFmpeg Wasm asset from the public entry graph so
 * consuming bundlers can relocate it with the package build.
 */
export declare function resolveAudioDecodingRuntimeAssets(): AudioDecodingRuntimeAssets;
