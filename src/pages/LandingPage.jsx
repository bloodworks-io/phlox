// Landing page component - ChatGPT-style chat interface
import React, { useState, useEffect } from "react";
import { Box } from "@chakra-ui/react";
import DashboardChat from "../components/dashboard/DashboardChat";
import DisclaimerModal from "../components/modals/DisclaimerModal";
import { useAppInit } from "../App";

const LandingPage = () => {
  const { isInitializing } = useAppInit();

  // Disclaimer modal state - show once per session
  // Only show when app is fully initialized (past encryption/splash screens)
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  useEffect(() => {
    // Don't show disclaimer while app is initializing
    if (isInitializing) return;

    // Check if disclaimer was already shown this session
    if (sessionStorage.getItem("disclaimerShown")) return;

    // Show disclaimer after app is ready
    setShowDisclaimer(true);
  }, [isInitializing]);

  const handleDisclaimerClose = () => {
    sessionStorage.setItem("disclaimerShown", "true");
    setShowDisclaimer(false);
  };

  return (
    <Box h="calc(100vh - 60px)" position="relative" overflow="hidden">
      <DisclaimerModal isOpen={showDisclaimer} onClose={handleDisclaimerClose} />
      <DashboardChat />
    </Box>
  );
};

export default LandingPage;
