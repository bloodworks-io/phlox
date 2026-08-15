import React, { useEffect, useState } from "react";
import { Box, Spinner, Text, VStack } from "@chakra-ui/react";
import { clearStoredToken, isTauri } from "../../utils/helpers/apiConfig";
import { AuthGate } from "./AuthGate";

export const ServerConnectionCheck = ({ children }) => {
  const [serverStatus, setServerStatus] = useState("checking");

  useEffect(() => {
    console.log("[ServerConnectionCheck] Component mounted.");
    const checkServer = async () => {
      const inTauriEnv = isTauri();
      console.log("[ServerConnectionCheck] isTauri result:", inTauriEnv);

      if (!inTauriEnv) {

        try {
          const response = await fetch("/api/config/status");
          if (response.status === 401) {
            clearStoredToken();
            setServerStatus("needs-auth");
            return;
          }
        } catch {
          // Server unreachable etc. - let the app's own error handling surface it
        }
        setServerStatus("ready");
        return;
      }

      // Note: With no keychain caching (PHI requirement), the unlock screen
      // will always be shown on app launch via App.jsx logic.
      // Server will be started after successful unlock.
      // Skip server connection check here - let App.jsx handle the flow.

      console.log(
        "[ServerConnectionCheck] Skipping server check (unlock required first).",
      );
      setServerStatus("ready");
    };

    checkServer();
  }, []);

  // Show a brief loading state while checking
  if (serverStatus === "checking") {
    return (
      <Box
        height="100dvh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        bg="surfaceInset"
      >
        <VStack gap={4}>
          <Spinner size="xl" color="primaryButton" />
          <Text fontSize="lg" fontWeight="medium">
            Initializing...
          </Text>
        </VStack>
      </Box>
    );
  }

  if (serverStatus === "needs-auth") {
    return <AuthGate onSuccess={() => setServerStatus("ready")} />;
  }

  return children;
};
