import { invoke } from "@tauri-apps/api/core";

// Detect if we're running in Tauri environment
const isTauri = () => {
  return window.__TAURI_INTERNALS__ !== undefined;
};

// Cache the server port to avoid repeated IPC calls
let cachedServerPort = null;
// Cache the request token for API authentication
let cachedRequestToken = null;

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

// Get the request token for API authentication
export const getRequestToken = async () => {
  if (!isTauri()) {
    // Docker mode - no token needed
    return null;
  }

  // Return cached token if available
  if (cachedRequestToken) {
    return cachedRequestToken;
  }

  try {
    const token = await invoke("get_request_token");
    if (token) {
      cachedRequestToken = token;
    }
    return token || null;
  } catch (error) {
    console.error("Failed to get request token from Tauri:", error);
    return null;
  }
};

// Helper function to construct full API URL
export const buildApiUrl = async (endpoint) => {
  const baseUrl = await getApiBaseUrl();
  return `${baseUrl}${endpoint}`;
};

// Reset the cached config (call this when server restarts)
export const resetApiConfig = () => {
  cachedServerPort = null;
  cachedRequestToken = null;
};

export { isTauri };
