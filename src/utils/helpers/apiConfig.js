import { invoke } from "@tauri-apps/api/core";

// Detect if we're running in Tauri environment
const isTauri = () => {
  return window.__TAURI__ !== undefined;
};

// Cache for the server port to avoid repeated calls
let serverPort = null;
let serverBaseUrl = null;

// Get the base URL for API calls
export const getApiBaseUrl = async () => {
  if (!isTauri()) {
    // In Docker environment, use relative URLs
    return "";
  }

  // In Tauri environment, we need to get the server port
  if (serverBaseUrl) {
    return serverBaseUrl; // Return cached value
  }

  try {
    if (!serverPort) {
      serverPort = await invoke("get_server_port");
    }
    serverBaseUrl = `http://localhost:${serverPort}`;
    return serverBaseUrl;
  } catch (error) {
    console.error("Failed to get server port from Tauri:", error);
    // Fallback to default port
    serverBaseUrl = "http://localhost:5000";
    return serverBaseUrl;
  }
};

// Helper function to construct full API URL
export const buildApiUrl = async (endpoint) => {
  const baseUrl = await getApiBaseUrl();
  return `${baseUrl}${endpoint}`;
};

// Reset cached values (useful for testing or if server restarts)
export const resetApiConfig = () => {
  serverPort = null;
  serverBaseUrl = null;
};

export { isTauri };
