import React, { useEffect, useState } from "react";
import { Box, Spinner, Text, VStack } from "@chakra-ui/react";
import { isTauri } from "../../utils/helpers/apiConfig";
import { universalFetch } from "../../utils/helpers/apiHelpers";
import { invoke } from "@tauri-apps/api/core";

export const ServerConnectionCheck = ({ children }) => {
  const [serverStatus, setServerStatus] = useState("checking");
  const [serverPort, setServerPort] = useState(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    console.log("[ServerConnectionCheck] Component mounted."); // ADD THIS LOG
    const checkServer = async () => {
      const inTauriEnv = isTauri();
      console.log("[ServerConnectionCheck] isTauri result:", inTauriEnv); // ADD THIS LOG

      if (!inTauriEnv) {
        console.log(
          "[ServerConnectionCheck] Not in Tauri, setting server status to ready.",
        ); // ADD THIS LOG
        setServerStatus("ready");
        return;
      }

      console.log(
        "[ServerConnectionCheck] In Tauri, proceeding with server checks.",
      ); // ADD THIS LOG

      const maxAttempts = 60;

      for (let i = 0; i < maxAttempts; i++) {
        try {
          setAttempts(i + 1);
          console.log(
            `[ServerConnectionCheck] Attempt ${i + 1} to connect to server.`,
          ); // ADD THIS LOG

          const port = await invoke("get_server_port");
          console.log(`[ServerConnectionCheck] Port from invoke: ${port}`); // ADD THIS LOG

          if (port !== "5000") {
            // Check if it's not the fallback
            const response = await universalFetch(
              `http://localhost:${port}/api/dashboard/health`,
            );
            console.log(
              `[ServerConnectionCheck] Health check response status: ${response.status}`,
            ); // ADD THIS LOG
            if (response.ok) {
              const data = await response.json();
              console.log(
                `[ServerConnectionCheck] Health check response data:`,
                data,
              ); // ADD THIS LOG
              if (data.status === "ok") {
                setServerPort(port);
                setServerStatus("ready");
                console.log(
                  `[ServerConnectionCheck] Server ready on port ${port}.`,
                ); // ADD THIS LOG
                return;
              }
            }
          } else {
            console.log(
              `[ServerConnectionCheck] Got fallback port 5000, will retry if attempts remain.`,
            ); // ADD THIS LOG
          }
        } catch (error) {
          console.log(
            `[ServerConnectionCheck] Server check attempt ${i + 1} failed:`,
            error,
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log(
        "[ServerConnectionCheck] Max attempts reached, setting server status to failed.",
      ); // ADD THIS LOG
      setServerStatus("failed");
    };

    checkServer();
  }, []);

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
            Starting Phlox Server...
          </Text>
          <Text fontSize="sm" color="gray.600">
            Attempt {attempts} of 60
          </Text>
          {serverPort && (
            <Text fontSize="sm" color="green.600">
              Server detected on port {serverPort}
            </Text>
          )}
        </VStack>
      </Box>
    );
  }

  if (serverStatus === "failed") {
    return (
      <Box
        height="100vh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        bg="red.50"
      >
        <VStack spacing={4}>
          <Text fontSize="xl" fontWeight="bold" color="red.600">
            Server Connection Failed
          </Text>
          <Text fontSize="md" color="red.500" textAlign="center">
            Could not connect to the Phlox server after 60 seconds.
            <br />
            Please restart the application.
          </Text>
        </VStack>
      </Box>
    );
  }

  return children;
};
