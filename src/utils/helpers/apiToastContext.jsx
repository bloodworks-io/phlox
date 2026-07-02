import { createContext, useContext, useMemo } from "react";
import { toaster } from "@/components/ui/toaster";
import { useAppInit } from "../context/appInit";

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
  const { isInitializing } = useAppInit();

  // Keep the ref in sync with the current state
  isInitializingRef.current = isInitializing;

  const apiToast = useMemo(() => {
    const fn = (options) => {
      if (isInitializingRef.current && options?.type === "error") {
        console.log(
          "[ApiToast] Error toast suppressed - isInitializing:",
          isInitializingRef.current,
          "options:",
          options,
        );
        return;
      }
      return toaster.create(options);
    };

    fn.closeAll = () => toaster.remove();
    fn.close = (id) => toaster.remove(id);
    fn.isActive = (id) => toaster.isVisible(id);

    return fn;
  }, []);

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
