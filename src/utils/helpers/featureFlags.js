import { isTauri } from "./apiConfig";

/**
 * Check if chat/RAG features are enabled.
 * Currently disabled for Tauri (desktop) builds, enabled for web.
 */
export const isChatEnabled = () => {
  return !isTauri();
};
