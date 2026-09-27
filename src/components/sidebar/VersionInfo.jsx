import React, { useState, useEffect } from "react";
import {
  Box,
  Text,
  useDisclosure,
  Badge,
  VStack,
  HStack,
  Center,
} from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { FaMoon, FaSun, FaSignOutAlt } from "react-icons/fa";
import { TbVersions } from "react-icons/tb";
import { BsCheck2All, BsExclamationTriangle } from "react-icons/bs";
import { settingsApi } from "../../utils/api/settingsApi";
import { authApi } from "../../utils/api/authApi";
import { isTauri, clearStoredToken } from "../../utils/helpers/apiConfig";
import ChangelogModal from "../modals/ChangelogModal";
import { APP_VERSION } from "../../utils/constants/version";
import changelogContent from "../../../CHANGELOG.md?raw";

const StatusIcon = ({ serverStatus, isCollapsed }) => {
  const { t } = useTranslation();
  // embedding is null in Docker/external mode (no distinct embedding server);
  // only count it when the backend reports it as applicable.
  const embeddingApplicable =
    serverStatus.embedding !== null && serverStatus.embedding !== undefined;
  const allServicesUp =
    serverStatus.llm &&
    serverStatus.whisper &&
    (!embeddingApplicable || serverStatus.embedding);

  const embeddingLine = embeddingApplicable
    ? t("sidebar.status.embeddingSuffix", {
        mark: serverStatus.embedding ? "✓" : "✗",
      })
    : "";

  return (
    <Tooltip
      content={
        allServicesUp
          ? t("sidebar.status.allConnected")
          : t("sidebar.status.services", {
              llm: serverStatus.llm ? "✓" : "✗",
              whisper: serverStatus.whisper ? "✓" : "✗",
              embedding: embeddingLine,
            })
      }
      positioning={{
        placement: isCollapsed ? "right" : "top",
      }}
    >
      <Badge
        colorPalette={allServicesUp ? "green" : "orange"}
        borderRadius="full"
        variant="subtle"
        p={1}
      >
        {allServicesUp ? <BsCheck2All /> : <BsExclamationTriangle />}
      </Badge>
    </Tooltip>
  );
};

const VersionInfo = ({ isCollapsed, colorMode, toggleColorMode }) => {
  const { t } = useTranslation();
  const { open, onOpen, onClose } = useDisclosure();
  const [serverStatus, setServerStatus] = useState({
    whisper: false,
    llm: false,
    embedding: null,
  });

  const version = APP_VERSION;
  const changelog = changelogContent;

  // Browser/Docker only: end the session, drop the token, and let the reload
  // route back through ServerConnectionCheck into the login screen.
  const handleLogout = async () => {
    await authApi.logout();
    clearStoredToken();
    window.location.reload();
  };

  // Sidebar is always-dark by design; sidebar.text token resolves to a light value in both modes

  useEffect(() => {
    // Check server status
    const checkStatus = async () => {
      try {
        const data = await settingsApi.fetchServerStatus();
        setServerStatus(data);
      } catch (error) {
        console.error("Error checking server status:", error);
      }
    };

    checkStatus();
    // Set up interval to check status periodically.
    const intervalId = setInterval(checkStatus, 15000);

    return () => clearInterval(intervalId);
  }, []);

  // Display for the collapsed sidebar
  if (isCollapsed) {
    return (
      <Box position="relative" width="100%">
        <VStack gap={2} align="center" width="100%">
          <Tooltip
            content={t("sidebar.versionInfoTooltip")}
            positioning={{
              placement: "right",
            }}
          >
            <Box
              onClick={onOpen}
              cursor="pointer"
              fontSize="md"
              color="sidebar.text" // Apply consistent color
              _hover={{ color: "sidebar.text" }} // Brighten on hover
            >
              <TbVersions />
            </Box>
          </Tooltip>

          {!isTauri() && (
            <Tooltip content={t("sidebar.signOut")} positioning={{ placement: "right" }}>
              <Box
                onClick={handleLogout}
                cursor="pointer"
                fontSize="md"
                color="sidebar.text"
                _hover={{ color: "sidebar.text" }}
              >
                <FaSignOutAlt />
              </Box>
            </Tooltip>
          )}

          <Tooltip
            content={
              colorMode === "light"
                ? t("sidebar.switchToDarkMode")
                : t("sidebar.switchToLightMode")
            }
            positioning={{
              placement: "right",
            }}
          >
            <Box
              onClick={toggleColorMode}
              cursor="pointer"
              fontSize="md"
              color="sidebar.text"
              _hover={{ color: "sidebar.text" }}
            >
              {colorMode === "light" ? <FaMoon /> : <FaSun />}
            </Box>
          </Tooltip>

          <StatusIcon serverStatus={serverStatus} isCollapsed={isCollapsed} />
        </VStack>
        <ChangelogModal
          isOpen={open}
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
        <HStack gap={4}>
          <Tooltip content={t("sidebar.changelogTooltip")}>
            <Text
              fontSize="md"
              onClick={onOpen}
              cursor="pointer"
              color="sidebar.text" // Apply consistent color
              _hover={{
                textDecoration: "underline",
                color: "var(--chakra-colors-sidebar-text)",
              }}
            >
              v{version}
            </Text>
          </Tooltip>

          {!isTauri() && (
            <Tooltip content={t("sidebar.signOut")}>
              <Box
                onClick={handleLogout}
                cursor="pointer"
                fontSize="lg"
                color="sidebar.text"
                _hover={{ color: "sidebar.text" }}
              >
                <FaSignOutAlt />
              </Box>
            </Tooltip>
          )}

          <Tooltip
            content={
              colorMode === "light"
                ? t("sidebar.switchToDarkMode")
                : t("sidebar.switchToLightMode")
            }
          >
            <Box
              onClick={toggleColorMode}
              cursor="pointer"
              fontSize="lg"
              color="sidebar.text"
              _hover={{ color: "sidebar.text" }}
            >
              {colorMode === "light" ? <FaMoon /> : <FaSun />}
            </Box>
          </Tooltip>

          <StatusIcon serverStatus={serverStatus} isCollapsed={isCollapsed} />
        </HStack>
      </Center>
      <ChangelogModal
        isOpen={open}
        onClose={onClose}
        version={version}
        changelog={changelog}
      />
    </Box>
  );
};

export default VersionInfo;
