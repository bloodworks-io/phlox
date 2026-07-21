import { createContext, useContext, useEffect, useMemo } from "react";
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
  useEffect(() => {
    isInitializingRef.current = isInitializing;
  }, [isInitializing]);

  const apiToast = useMemo(
    () =>
      Object.assign(
        (options) => {
          if (isInitializingRef.current && options?.type === "error") {
            return;
          }
          return toaster.create(options);
        },
        {
          closeAll: () => toaster.remove(),
          close: (id) => toaster.remove(id),
          isActive: (id) => toaster.isVisible(id),
        },
      ),
    [],
  );

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
