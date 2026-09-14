// Landing page — mirrors the full-fat dashboard chrome (greeting, suggestion
// buttons, input-area panel) with demo actions instead of chat.
import React, { useState, useEffect } from "react";
import { Box, Flex, VStack, Text, Button } from "@chakra-ui/react";
import { useNavigate } from "react-router";
import { InfoIcon, SearchIcon } from "../components/common/icons";
import { FaNotesMedical, FaGithub } from "react-icons/fa";
import DisclaimerModal from "../components/modals/DisclaimerModal";
import OnboardingCard from "../components/common/OnboardingCard";
import { useAppInit } from "../utils/context/appInit";
import { patientApi } from "../utils/api/patientApi";

const GITHUB_URL = "https://github.com/bloodworks-io/phlox";

const LandingPage = () => {
  const { isInitializing } = useAppInit();
  const navigate = useNavigate();
  const [todaysEncounters, setTodaysEncounters] = useState([]);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  useEffect(() => {
    if (isInitializing) return;
    if (sessionStorage.getItem("disclaimerShown")) return;
    setShowDisclaimer(true);
  }, [isInitializing]);

  useEffect(() => {
    if (isInitializing) return;
    const today = new Date().toISOString().split("T")[0];
    patientApi
      .fetchNoteList({ date: today })
      .then((rows) => setTodaysEncounters(Array.isArray(rows) ? rows : []))
      .catch(() => setTodaysEncounters([]));
  }, [isInitializing]);

  const handleDisclaimerClose = () => {
    sessionStorage.setItem("disclaimerShown", "true");
    setShowDisclaimer(false);
  };

  return (
    <Flex
      className="dashboard-chat-container"
      direction="column"
      align="center"
      justify="center"
      px="20px"
    >
      <DisclaimerModal isOpen={showDisclaimer} onClose={handleDisclaimerClose} />
      <VStack gap={8} w="100%" maxW="800px">
        {/* Greeting — same styling as the full-fat dashboard */}
        <VStack gap={2}>
          <Text
            fontSize="2xl"
            fontWeight="bold"
            fontFamily="heading"
            className="dashboard-chat-greeting"
          >
            Welcome to Phlox Web
          </Text>
          <Text fontSize="md" color="overlay0">
            Patients, encounters, letters and transcription — all local, nothing leaves this machine
          </Text>
        </VStack>

        {/* Actions — same suggestion-button treatment as the full-fat dashboard */}
        <Flex wrap="wrap" justify="center" gap={3} className="anim-stagger">
          <Button
            onClick={() => navigate("/new-note")}
            className="dashboard-chat-suggestions"
            size="sm"
          >
            <FaNotesMedical />
            New Patient Note
          </Button>
          <Button
            onClick={() => navigate("/clinic-summary")}
            className="dashboard-chat-suggestions"
            size="sm"
          >
            <InfoIcon />
            Today&rsquo;s Clinic
          </Button>
          <Button
            onClick={() => navigate("/outstanding-jobs")}
            className="dashboard-chat-suggestions"
            size="sm"
          >
            <SearchIcon />
            Outstanding Jobs
          </Button>
          <Button
            as="a"
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="dashboard-chat-suggestions"
            size="sm"
          >
            <FaGithub />
            Documentation
          </Button>
        </Flex>

        {/* Input-area panel: onboarding + model download */}
        <Box w="100%" maxW="800px" position="relative">
          <OnboardingCard />
        </Box>

        {/* Today's encounters */}
        {todaysEncounters.length > 0 && (
          <VStack gap={2} w="100%" maxW="800px" align="stretch">
            <Text fontSize="sm" fontWeight="bold">
              Today&rsquo;s encounters ({todaysEncounters.length})
            </Text>
            {todaysEncounters.map((encounter) => (
              <Button
                key={encounter.id}
                variant="ghost"
                justifyContent="flex-start"
                onClick={() => navigate(`/note/${encounter.id}`)}
                className="dashboard-chat-suggestions"
                size="sm"
              >
                {encounter.name}
                {encounter.ur_number ? ` · UR ${encounter.ur_number}` : ""}
              </Button>
            ))}
          </VStack>
        )}
      </VStack>
    </Flex>
  );
};

export default LandingPage;
