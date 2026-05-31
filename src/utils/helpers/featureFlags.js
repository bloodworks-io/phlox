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
