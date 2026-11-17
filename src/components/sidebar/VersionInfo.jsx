import React, { useState, useEffect } from "react";
import {
  Box,
  useDisclosure,
  Badge,
  VStack,
  HStack,
  Center,
} from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { useThemePreference } from "@/components/ui/color-mode";
import { useTranslation } from "react-i18next";

import {
    LuCheckCheck,
    LuHistory,
    LuSunMoon,
    LuMoon,
    LuSun,
    LuLogOut,
    LuTriangleAlert,
} from "react-icons/lu";
import { settingsApi } from "../../utils/api/settingsApi";
import { authApi } from "../../utils/api/authApi";
import { isTauri, clearStoredToken } from "../../utils/helpers/apiConfig";
import ChangelogModal from "../modals/ChangelogModal";
import { APP_VERSION } from "../../utils/constants/version";
import changelogContent from "../../../CHANGELOG.md?raw";

const SidebarControlButton = ({
  label,
  onClick,
  fontSize = "md",
  ariaPressed,
  children,
  ...rest
}) => (
  <Box
    as="button"
    type="button"
    {...rest}
    onClick={onClick}
    aria-label={label}
    aria-pressed={ariaPressed}
    cursor="pointer"
    fontSize={fontSize}
    color="folio.sidebarInk"
    background="transparent"
    border="none"
    padding={0}
    _hover={{ color: "folio.brandOnSidebar" }}
    _focusVisible={{
      outline: "2px solid",
      outlineColor: "folio.brandOnSidebar",
      outlineOffset: "2px",
    }}
  >
    {children}
  </Box>
);

// One control, three states: light → dark → system → light. The icon shows
// where the theme is now; the label says where the next click lands.
const THEME_CYCLE = {
  light: "dark",
  dark: "system",
  system: "light",
};

const THEME_ICONS = {
  light: LuSun,
  dark: LuMoon,
  system: LuSunMoon,
};

const THEME_NEXT_LABELS = {
  light: "sidebar.switchToDarkMode",
  dark: "sidebar.switchToSystem",
  system: "sidebar.switchToLightMode",
};

const ThemeCycleButton = ({ isCollapsed, fontSize }) => {
  const { t } = useTranslation();
  const { themePreference, setThemePreference } = useThemePreference();
  const label = t(THEME_NEXT_LABELS[themePreference]);
  const ThemeIcon = THEME_ICONS[themePreference];

  return (
    <Tooltip
      content={label}
      positioning={{
        placement: isCollapsed ? "right" : "top",
      }}
    >
      <SidebarControlButton
        label={label}
        fontSize={fontSize}
        onClick={() => setThemePreference(THEME_CYCLE[themePreference])}
      >
        <ThemeIcon strokeWidth={1.6} />
      </SidebarControlButton>
    </Tooltip>
  );
};

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
  const statusLabel = allServicesUp
    ? t("sidebar.status.allConnected")
    : t("sidebar.status.services", {
        llm: serverStatus.llm ? "✓" : "✗",
        whisper: serverStatus.whisper ? "✓" : "✗",
        embedding: embeddingLine,
      });

  return (
    <Tooltip
      content={statusLabel}
      positioning={{
        placement: isCollapsed ? "right" : "top",
      }}
    >
      <Badge
        role="status"
        aria-label={statusLabel}
        title={statusLabel}
        bg={allServicesUp ? "folio.successSoft" : "folio.warningSoft"}
        color={allServicesUp ? "folio.success" : "folio.warning"}
        borderRadius="full"
        variant="subtle"
        p={1}
      >
        {allServicesUp ? <LuCheckCheck strokeWidth={1.6} /> : <LuTriangleAlert strokeWidth={1.6} />}
      </Badge>
    </Tooltip>
  );
};

const VersionInfo = ({ isCollapsed }) => {
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

  // The Folio sidebar remains dark in both application modes.

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
            <SidebarControlButton
              label={t("sidebar.versionInfoTooltip")}
              onClick={onOpen}
            >
              <LuHistory strokeWidth={1.6} />
            </SidebarControlButton>
          </Tooltip>

          {!isTauri() && (
            <Tooltip content={t("sidebar.signOut")} positioning={{ placement: "right" }}>
              <SidebarControlButton
                label={t("sidebar.signOut")}
                onClick={handleLogout}
              >
                <LuLogOut strokeWidth={1.6} />
              </SidebarControlButton>
            </Tooltip>
          )}

          <ThemeCycleButton isCollapsed />

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
            <SidebarControlButton
              label={`${t("sidebar.changelogTooltip")} — v${version}`}
              onClick={onOpen}
            >
              v{version}
            </SidebarControlButton>
          </Tooltip>

          {!isTauri() && (
            <Tooltip content={t("sidebar.signOut")}>
              <SidebarControlButton
                label={t("sidebar.signOut")}
                fontSize="lg"
                onClick={handleLogout}
              >
                <LuLogOut strokeWidth={1.6} />
              </SidebarControlButton>
            </Tooltip>
          )}

          <ThemeCycleButton fontSize="lg" />

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
