import { buildApiUrl, isTauri } from "./apiConfig";

export const universalFetch = async (url, options = {}) => {
  if (isTauri()) {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    return tauriFetch(url, options);
  } else {
    return fetch(url, options);
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
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Apply transformation if provided
    const transformedData = transformResponse ? transformResponse(data) : data;

    if (onSuccess) {
      onSuccess(transformedData);
    }

    if (successMessage && toast) {
      toast({
        title: "Success",
        description: successMessage,
        status: "success",
        duration: 3000,
        isClosable: true,
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
        toast({
          title: "Request Timeout",
          description: `The request took too long to complete (${timeout / 1000}s timeout)`,
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }

      throw timeoutError;
    }

    console.error("API Error:", error);

    if (onError) {
      onError(error);
    }

    if (toast) {
      toast({
        title: "Error",
        description: errorMessage || error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }

    throw error;
  } finally {
    if (setLoading) setLoading(false);
    if (finallyCallback) finallyCallback();
  }
};

// Enhanced API request helper that handles URL construction
export const handleApiRequestWithUrl = async (options) => {
  const { endpoint, ...otherOptions } = options;

  // Build the full URL
  const fullUrl = await buildApiUrl(endpoint);

  // Create the API call with the full URL
  const apiCall = () => {
    const { method = "GET", body, headers } = options;
    const fetchOptions = {
      method,
      headers: headers || {},
    };

    if (body) {
      fetchOptions.body = body;
    }

    return universalFetch(fullUrl, fetchOptions);
  };

  return handleApiRequest({
    ...otherOptions,
    apiCall,
  });
};

// Utility function for handling form data
export const createFormData = (data) => {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      formData.append(key, value);
    }
  });
  return formData;
};

// Utility function for handling query parameters
export const createQueryString = (params) => {
  return Object.entries(params)
    .filter(([_, value]) => value !== null && value !== undefined)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
};
