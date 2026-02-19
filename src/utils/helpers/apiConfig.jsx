import { invoke } from "@tauri-apps/api/core";

// Detect if we're running in Tauri environment
const isTauri = () => {
  return window.__TAURI_INTERNALS__ !== undefined;
};

// Cache the server port to avoid repeated IPC calls
let cachedServerPort = null;

// Get the base URL for API calls
export const getApiBaseUrl = async () => {
  if (!isTauri()) {
    // In Docker environment, use relative URLs
    return "";
  }

  // In Tauri environment, use cached port if available
  if (cachedServerPort) {
    return `http://localhost:${cachedServerPort}`;
  }

  try {
    const serverPort = await invoke("get_server_port");
    cachedServerPort = serverPort; // Cache the port
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

// Reset the cached port (call this when server restarts)
export const resetApiConfig = () => {
  cachedServerPort = null;
};

export { isTauri };
