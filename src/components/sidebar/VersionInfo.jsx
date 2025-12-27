import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  Box,
  Text,
  Flex,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Badge,
  Tooltip,
  Link,
  VStack,
  HStack,
  Center,
} from "@chakra-ui/react";
import { FaGithub } from "react-icons/fa";
import { TbVersions } from "react-icons/tb";
import { BsCheck2All, BsExclamationTriangle } from "react-icons/bs";
import { colors } from "../../theme/colors";
import { buildApiUrl } from "../../utils/helpers/apiConfig";
import { universalFetch } from "../../utils/helpers/apiHelpers";

const VersionInfo = ({ isCollapsed }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [version, setVersion] = useState("");
  const [changelog, setChangelog] = useState("");
  const [serverStatus, setServerStatus] = useState({
    whisper: false,
    llm: false, // Updated from 'ollama' to 'llm'
  });

  // Use consistent dark theme text color
  const textColor = colors.dark.textPrimary;
  const iconColor = colors.dark.textSecondary;

  useEffect(() => {
    // Fetch version from backend
    const fetchVersion = async () => {
      try {
        const url = await buildApiUrl("/api/config/version");
        const res = await universalFetch(url);
        const data = await res.json();
        setVersion(data.version);
      } catch (err) {
        console.error("Error fetching version:", err);
      }
    };

    // Fetch changelog
    const fetchChangelog = async () => {
      try {
        const url = await buildApiUrl("/api/config/changelog");
        const res = await universalFetch(url);
        const data = await res.json();
        setChangelog(data.content);
      } catch (err) {
        console.error("Error fetching changelog:", err);
      }
    };
    // Check server status
    const checkStatus = async () => {
      try {
        const url = await buildApiUrl("/api/config/status");
        const response = await universalFetch(url);
        if (response.ok) {
          const data = await response.json();
          setServerStatus(data);
        }
      } catch (error) {
        console.error("Error checking server status:", error);
      }
    };

    fetchVersion();
    fetchChangelog();
    checkStatus();
    // Set up interval to check status periodically
    const intervalId = setInterval(checkStatus, 60000); // Check every minute

    return () => clearInterval(intervalId);
  }, []);

  // Combined status icon
  const StatusIcon = () => {
    const allServicesUp = serverStatus.llm && serverStatus.whisper;

    return (
      <Tooltip
        label={
          allServicesUp
            ? "All services connected"
            : `Services: ${serverStatus.llm ? "✓" : "✗"} LLM, ${serverStatus.whisper ? "✓" : "✗"} Whisper`
        }
        placement={isCollapsed ? "right" : "top"}
      >
        <Badge
          colorScheme={allServicesUp ? "green" : "orange"}
          borderRadius="full"
          variant="subtle"
          p={1}
        >
          {allServicesUp ? <BsCheck2All /> : <BsExclamationTriangle />}
        </Badge>
      </Tooltip>
    );
  };

  // Display for the collapsed sidebar
  if (isCollapsed) {
    return (
      <Box position="relative" width="100%">
        <VStack spacing={2} align="center" width="100%">
          <Tooltip label="View Version Info" placement="right">
            <Box
              onClick={onOpen}
              cursor="pointer"
              fontSize="md"
              color={iconColor} // Apply consistent color
              _hover={{ color: textColor }} // Brighten on hover
            >
              <TbVersions />
            </Box>
          </Tooltip>

          <Tooltip label="GitHub Repository" placement="right">
            <Link
              href="https://github.com/bloodworks-io/phlox"
              target="_blank"
              rel="noopener noreferrer"
              fontSize="md"
              color={iconColor} // Apply consistent color
              _hover={{ color: textColor }} // Brighten on hover
            >
              <FaGithub />
            </Link>
          </Tooltip>

          <StatusIcon />
        </VStack>

        <ChangelogModal
          isOpen={isOpen}
          onClose={onClose}
          version={version}
          changelog={changelog}
        />
      </Box>
    );
  }

  // Display for the expanded sidebar
  return (
    <Box width="100%">
      {/* Center the version, GitHub icon, and status icon */}
      <Center width="100%">
        <HStack spacing={4}>
          <Tooltip label="View Changelog">
            <Text
              fontSize="md"
              onClick={onOpen}
              cursor="pointer"
              color={textColor} // Apply consistent color
              _hover={{
                textDecoration: "underline",
                color: colors.dark.textPrimary,
              }}
            >
              v{version}
            </Text>
          </Tooltip>

          <Tooltip label="GitHub Repository">
            <Link
              href="https://github.com/bloodworks-io/phlox"
              target="_blank"
              rel="noopener noreferrer"
              fontSize="lg"
              color={iconColor} // Apply consistent color
              _hover={{ color: textColor }} // Brighten on hover
            >
              <FaGithub />
            </Link>
          </Tooltip>

          <StatusIcon />
        </HStack>
      </Center>

      <ChangelogModal
        isOpen={isOpen}
        onClose={onClose}
        version={version}
        changelog={changelog}
      />
    </Box>
  );
};

// Separate component for the changelog modal
const ChangelogModal = ({ isOpen, onClose, version, changelog }) => {
  const cleanChangelog = changelog.replace(/^# Changelog\s*\n/, "");
  const releases = cleanChangelog
    .split(/(?=## \[)/)
    .filter((release) => release.trim() !== "");

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent className="modal-style">
        <ModalHeader>Phlox - Changelog</ModalHeader>
        <ModalCloseButton />
        <ModalBody
          maxH="70vh"
          overflowY="auto"
          className="custom-scrollbar"
          px={10}
        >
          {releases.length > 0 ? (
            releases.map((release, index) => (
              <Box key={index} mb={10}>
                <ReactMarkdown>{release}</ReactMarkdown>
              </Box>
            ))
          ) : (
            <Text>Loading changelog...</Text>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default VersionInfo;
