// Domain types for the RAG knowledge-base components.

/** A file entry inside a collection (object form from the server). */
export interface RagFileObject {
    filename: string;
    title?: string | null;
    source?: string | null;
    focus_area?: string | null;
    has_pdf?: boolean;
}

/** Collections may contain plain filename strings or rich file objects. */
export type CollectionFile = string | RagFileObject;

export interface DocumentCollection {
    name: string;
    files: CollectionFile[];
    loaded: boolean;
}

/** Pending deletion target for the confirm dialog in pages/Rag. */
export interface ItemToDelete {
    type: "file" | "collection";
    name: string;
    collection: string | null;
}

/** Collapsible section state (see useCollapse). */
export interface CollapseState {
    isCollapsed: boolean;
    toggle: () => void;
}

/** Result of extractPdfMetadata. */
export interface PdfMetadataResult {
    disease_name?: string;
    document_source?: string;
    focus_area?: string;
    title?: string | null;
    extractedText?: string;
    pdfBase64?: string | null;
}
