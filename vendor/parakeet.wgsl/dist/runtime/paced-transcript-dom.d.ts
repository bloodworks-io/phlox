import type { PacedTranscriptUpdate, PacedTranscriptWord } from "./paced-transcript.js";
export interface PacedTranscriptDomWordHit {
    readonly word: PacedTranscriptWord;
    readonly clientRects: readonly DOMRect[];
}
export interface PacedTranscriptDomRendererOptions {
    /**
     * Follow the growing transcript until the user scrolls away. Native CSS
     * scroll anchoring handles all updates after one initial activation.
     */
    readonly autoFollow?: boolean;
}
/**
 * Incrementally renders one PacedTranscriptUpdate stream into one stable text
 * node. The supplied container is exclusively owned until dispose().
 */
export declare class PacedTranscriptDomRenderer {
    private readonly container;
    private readonly document;
    private readonly view;
    private readonly contentElement;
    private readonly anchorElement;
    private readonly textNode;
    private readonly words;
    private readonly autoFollow;
    private initialAutoFollowObserver;
    private lastRevision;
    private lastSourceRevision;
    private final;
    private disposed;
    constructor(container: HTMLElement, options?: PacedTranscriptDomRendererOptions);
    get text(): string;
    /**
     * The live range array. Callers must treat it as immutable.
     */
    get wordRanges(): readonly PacedTranscriptWord[];
    get revision(): number;
    get isFinal(): boolean;
    /**
     * Arrow-bound so it can be passed directly as PacedTranscriptDelivery's
     * onUpdate callback.
     */
    readonly applyUpdate: (update: PacedTranscriptUpdate) => void;
    wordAtTextOffset(textOffset: number): PacedTranscriptWord | undefined;
    /**
     * Create a DOM range for one current word entry. Stale or foreign word
     * objects return undefined, even when their values match a current entry.
     */
    domRangeForWord(word: PacedTranscriptWord): Range | undefined;
    /**
     * Resolve a timestamped word at viewport coordinates. Geometry is read only
     * when a presentation layer explicitly asks for a hit test.
     */
    wordHitAtPoint(clientX: number, clientY: number): PacedTranscriptDomWordHit | undefined;
    /**
     * Explicitly resume following after a user has scrolled away.
     */
    jumpToLatest(): void;
    /**
     * Start a new paced revision domain while preserving the owned DOM nodes.
     */
    reset(): void;
    /**
     * Release observation state while leaving the last rendered text visible.
     */
    dispose(): void;
    private validateUpdate;
    private validateWordRanges;
    private caretOffsetAtPoint;
    private clientRectsForWord;
    private armInitialAutoFollow;
    private disconnectInitialAutoFollow;
    private assertUsable;
}
export declare function pacedTranscriptWordAtOffset(words: readonly PacedTranscriptWord[], textOffset: number): PacedTranscriptWord | undefined;
