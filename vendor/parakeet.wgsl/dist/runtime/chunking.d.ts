import { PARAKEET_FBANK_HOP_SAMPLES } from "../audio/fbank-wasm";
export { PARAKEET_FBANK_HOP_SAMPLES };
export declare const PARAKEET_WINDOW_SECONDS = 15;
export declare const PARAKEET_OVERLAP_SECONDS = 2;
export declare const PARAKEET_WINDOW_SAMPLES: number;
export declare const PARAKEET_ENCODER_FRAME_SAMPLES: number;
export declare const PARAKEET_PRIMARY_CONTEXT_SAMPLES: number;
export declare const PARAKEET_PRIMARY_VISIBLE_SAMPLES: number;
export declare const PARAKEET_OVERLAP_SAMPLES: number;
export declare const PARAKEET_WINDOW_STRIDE_SAMPLES: number;
export declare const PARAKEET_REPAIR_VISIBLE_SAMPLES: number;
export interface StatelessWindowPlan {
    readonly index: number;
    /** Fixed PCM capacity decoded and passed to the Wasm frontend. */
    readonly windowSampleCount: number;
    /** Start of this window on the regular, stateless chunk grid. */
    readonly logicalStartSample: number;
    /** End of audio covered by this logical window, exclusive. */
    readonly logicalEndSample: number;
    /** Blob-backed PCM range actually read, before right padding. */
    readonly sourceStartSample: number;
    readonly sourceEndSample: number;
    readonly readSampleCount: number;
    /**
     * Global timestamp corresponding to local model sample zero.
     * Encoder-frame timestamps should be offset by this value.
     */
    readonly timestampOffsetSample: number;
    /**
     * Earliest global timestamp whose decoded tokens may be emitted.
     * It differs from `sourceStartSample` for an end-aligned final window.
     */
    readonly emissionStartSample: number;
    readonly emissionEndSample: number;
    /**
     * First local encoder frame consumed by the cold TDT decoder. Ordinary
     * non-first windows skip the one hidden acoustic-context frame; an
     * end-aligned final window skips its larger real-audio backfill.
     */
    readonly decodeStartFrame: number;
    /** Exclusive local encoder-frame boundary for TDT decoding. */
    readonly decodeEndFrame: number;
    /** Run the shared bounded FluidAudio end-of-stream decoder flush. */
    readonly flushFinal: boolean;
    readonly validSampleCount: number;
}
export interface StatelessAudioWindow extends StatelessWindowPlan {
    /**
     * Fixed-size source PCM input. Samples after `validSampleCount` are padding.
     */
    readonly samples: Float32Array;
}
/**
 * Plans primary windows whose geometry can no longer change when more decoded
 * PCM arrives. The strict lookahead sample distinguishes a non-final window
 * from an exact-boundary EOF window, which must use final flush semantics.
 */
export declare class OnlineStatelessWindowPlanner {
    private readonly stablePlans;
    get plannedWindowCount(): number;
    takeStablePrefix(availableSamples: number): readonly StatelessWindowPlan[];
    /**
     * Resolve EOF with the canonical planner and prove every already-executed
     * window is an exact field-for-field prefix of the final plan.
     */
    finish(totalSamples: number, speechEndSample: number): {
        readonly allPlans: readonly StatelessWindowPlan[];
        readonly remainingPlans: readonly StatelessWindowPlan[];
    };
}
export declare function planStatelessWindows(totalSamples: number, speechEndSample?: number): readonly StatelessWindowPlan[];
export declare function sameStatelessWindowPlan(left: StatelessWindowPlan, right: StatelessWindowPlan): boolean;
