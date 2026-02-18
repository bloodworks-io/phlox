import { createContext, useContext, useMemo, useRef } from "react";
import { useToast } from "@chakra-ui/react";
import { useAppInit } from "../../App";

// Store the current isInitializing state in a module-level ref
// This allows us to access it outside of React's component tree
const isInitializingRef = { current: false };

const ApiToastContext = createContext(null);

/**
 * Provider for API-aware toast notifications.
 * Suppresses error toasts during app initialization (encryption unlock/setup/server startup).
 * Success, warning, and info toasts are always shown.
 */
export const ApiToastProvider = ({ children }) => {
  const toast = useToast();
  const { isInitializing } = useAppInit();

  // Keep the ref in sync with the current state
  isInitializingRef.current = isInitializing;

  // Create an apiToast function that has the same methods as Chakra's toast
  const apiToast = useMemo(() => {
    const fn = (options) => {
      // Check the ref for current isInitializing value
      if (isInitializingRef.current && options?.status === "error") {
        console.log(
          "[ApiToast] Error toast suppressed - isInitializing:",
          isInitializingRef.current,
          "options:",
          options,
        );
        return;
      }
      console.log(
        "[ApiToast] Toast shown - isInitializing:",
        isInitializingRef.current,
        "options:",
        options,
      );
      return toast(options);
    };

    // Copy all methods from Chakra's toast to our apiToast
    fn.closeAll = toast.closeAll.bind(toast);
    fn.close = toast.close.bind(toast);
    fn.isActive = toast.isActive.bind(toast);

    return fn;
  }, [toast]);

  return (
    <ApiToastContext.Provider value={apiToast}>
      {children}
    </ApiToastContext.Provider>
  );
};

/**
 * Hook to access the API-aware toast function.
 * Use this instead of Chakra's useToast for API-related error notifications.
 * Error toasts will be automatically suppressed during app initialization.
 */
export const useApiToast = () => {
  const context = useContext(ApiToastContext);
  if (!context) {
    throw new Error("useApiToast must be used within ApiToastProvider");
  }
  return context;
};
