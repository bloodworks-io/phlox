import React, { useEffect, useState } from "react";
import { Box, Spinner, Text, VStack } from "@chakra-ui/react";
import { isTauri } from "../../utils/helpers/apiConfig";

export const ServerConnectionCheck = ({ children }) => {
  const [serverStatus, setServerStatus] = useState("checking");

  useEffect(() => {
    console.log("[ServerConnectionCheck] Component mounted.");
    const checkServer = async () => {
      const inTauriEnv = isTauri();
      console.log("[ServerConnectionCheck] isTauri result:", inTauriEnv);

      if (!inTauriEnv) {
        console.log(
          "[ServerConnectionCheck] Not in Tauri, setting server status to ready.",
        );
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
        height="100vh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        bg="gray.50"
      >
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text fontSize="lg" fontWeight="medium">
            Initializing...
          </Text>
        </VStack>
      </Box>
    );
  }

  return children;
};
