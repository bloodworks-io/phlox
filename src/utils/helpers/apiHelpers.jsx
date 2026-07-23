import { isTauri, getRequestToken } from "./apiConfig";
import { toaster } from "@/components/ui/toaster";

export const universalFetch = async (url, options = {}) => {
  // Get the request token if in Tauri mode
  const token = await getRequestToken();

  // Merge authorization header with existing headers
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const mergedOptions = {
    ...options,
    headers,
  };

  if (isTauri()) {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    return tauriFetch(url, mergedOptions);
  } else {
    return fetch(url, mergedOptions);
  }
};

// Helper functions for common API request handling.
export const handleApiRequest = async ({
  apiCall,
  timeout = 120000,
  setLoading = null,
  onSuccess = null,
  onError = null,
  successMessage = null,
  errorMessage = null,
  toast = null,
  finallyCallback = null,
  transformResponse = null,
}) => {
  if (setLoading) setLoading(true);

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    // Pass the abort signal to the apiCall
    const response = await apiCall(controller.signal);

    // Clear timeout on successful response
    clearTimeout(timeoutId);

    if (!response.ok) {
      let detail;
      try {
        const errorData = await response.json();
        detail = errorData.detail || errorData.message;
      } catch {
        // Response had no JSON body; fall back to status text
      }
      const err = new Error(detail || `HTTP error! status: ${response.status}`);
      err.status = response.status;
      throw err;
    }

    // Tolerate empty/204 responses (some endpoints return no body)
    if (response.status === 204) {
      return null;
    }
    const contentLength = response.headers.get("content-length");
    let data;
    if (contentLength === "0") {
      data = null;
    } else {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    }

    // Apply transformation if provided
    const transformedData = transformResponse ? transformResponse(data) : data;

    if (onSuccess) {
      onSuccess(transformedData);
    }

    if (successMessage && toast) {
      toaster.create({
        title: "Success",
        description: successMessage,
        type: "success",
        duration: 3000,
      });
    }

    return transformedData;
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle timeout-specific errors
    if (error.name === "AbortError") {
      const timeoutError = new Error(
        `Request timed out after ${timeout / 1000} seconds`,
      );
      timeoutError.name = "TimeoutError";

      console.error("API Timeout:", timeoutError);

      if (onError) {
        onError(timeoutError);
      }

      if (toast) {
        toaster.create({
          title: "Request Timeout",
          description: `The request took too long to complete (${timeout / 1000}s timeout)`,
          type: "error",
          duration: 5000,
        });
      }

      throw timeoutError;
    }

    console.error("API Error:", error);

    if (onError) {
      onError(error);
    }

    if (toast) {
      toaster.create({
        title: "Error",
        description: errorMessage || error.message,
        type: "error",
        duration: 5000,
      });
    }

    throw error;
  } finally {
    if (setLoading) setLoading(false);
    if (finallyCallback) finallyCallback();
  }
};
