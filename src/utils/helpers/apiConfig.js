import { invoke } from "@tauri-apps/api/core";

// Detect if we're running in Tauri environment
const isTauri = () => {
  return window.__TAURI__ !== undefined;
};

// Get the base URL for API calls
export const getApiBaseUrl = async () => {
  if (!isTauri()) {
    // In Docker environment, use relative URLs
    return "";
  }

  // In Tauri environment, always get the current server port
  try {
    const serverPort = await invoke("get_server_port");
    return `http://localhost:${serverPort}`;
  } catch (error) {
    console.error("Failed to get server port from Tauri:", error);
    // Fallback to default port
    return "http://localhost:5000";
  }
};

// Helper function to construct full API URL
export const buildApiUrl = async (endpoint) => {
  const baseUrl = await getApiBaseUrl();
  return `${baseUrl}${endpoint}`;
};

// Reset function is no longer needed since we don't cache
export const resetApiConfig = () => {
  // No-op for backward compatibility
};

export { isTauri };
