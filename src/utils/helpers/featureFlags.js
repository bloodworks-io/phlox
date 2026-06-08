import { isTauri } from "./apiConfig";

/**
 * Check if chat features are enabled.
 * Chat works without chromadb — always enabled.
 */
export const isChatEnabled = () => {
  return true;
};

/**
 * Check if RAG (document knowledge base) features are enabled.
 * Requires chromadb — currently disabled for Tauri (desktop) builds.
 */
export const isRagEnabled = () => {
  return !isTauri();
};

/**
 * Check if PDF form template features are enabled.
 * No dependency on sqlite-vec or vector embeddings — always available.
 */
export const isPdfFormsEnabled = () => {
  return true;
};
