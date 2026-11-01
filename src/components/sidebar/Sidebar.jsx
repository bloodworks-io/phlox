import {
  Box,
  Text,
  IconButton,
  useDisclosure,
  Image,
  Flex,
} from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { useApiToast } from "../../utils/helpers/apiToastContext";
import { useState, useEffect, useRef } from "react";
import useSWR from "swr";

import VersionInfo from "./VersionInfo";
import SidebarPatientList from "./SidebarPatientList";
import SidebarNavigation from "./SidebarNavigation";
import ConfirmDialog from "../common/ConfirmDialog";
import { sidebarWidth } from "../../theme/dimensions";
import { patientApi } from "../../utils/api/patientApi";
import { KEYS } from "../../utils/cache/keys";
import { isTauri } from "../../utils/helpers/apiConfig";
import { isMacOS } from "../../utils/helpers/platform";

const CollapseIcon = ({ boxSize = "20px" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="1.5"
    width={boxSize}
    height={boxSize}
  >
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="5"
      ry="5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M9.5 21V3"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Sidebar = ({
  onNewPatient,
  onSelectPatient,
  selectedPatientId,
  selectedDate,
  setSelectedDate,
  handleNavigation,
  isCollapsed,
  toggleSidebar,
  isSmallScreen,
  colorMode,
  toggleColorMode,
  isAdmin,
  patientScope,
  setPatientScope,
  onOpenCompanionImport,
}) => {
  // State declarations remain the same
  const { t } = useTranslation();
  const { data: patientsData, mutate: mutatePatients } = useSWR(
    KEYS.noteList(selectedDate, false, patientScope),
    async () => {
      const data = await patientApi.fetchNoteList({
        date: selectedDate,
        scope: patientScope,
      });
      return data.sort((a, b) => a.id - b.id);
    },
  );
  const patients = patientsData || [];
  const setPatients = (updater) =>
    mutatePatients(updater, { revalidate: false });
  const { data: jobsCountData } = useSWR(
    KEYS.incompleteJobsCount(patientScope),
    async () => {
      const data = await patientApi.fetchIncompleteJobsCount(patientScope);
      return data.incomplete_jobs_count;
    },
  );
  const incompleteJobsCount = jobsCountData || 0;
  const { open, onOpen, onClose } = useDisclosure();
  const [patientToDelete, setPatientToDelete] = useState(null);
  const toast = useApiToast();

  // Ref for detecting outside clicks on small screens
  const sidebarRef = useRef(null);

  // Close sidebar when clicking outside on small screens
  // Close sidebar when clicking outside on small screens (replaces v2 useOutsideClick)
  useEffect(() => {
    const handler = (event) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target) &&
        isSmallScreen &&
        !isCollapsed
      ) {
        toggleSidebar();
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [isSmallScreen, isCollapsed, toggleSidebar]);

  const handlePatientClick = (patient) => {
    toast.closeAll();
    onSelectPatient(patient);
  };

  const handleDelete = (patient) => {
    setPatientToDelete(patient);
    onOpen();
  };

  const confirmDelete = async () => {
    if (patientToDelete) {
      try {
        await patientApi.deletePatient(patientToDelete.id);
        setPatients(
          patients.filter((patient) => patient.id !== patientToDelete.id),
        );
        onClose();
      } catch (error) {
        console.error("Error deleting patient:", error);
      }
    }
  };

  const handleNewPatient = () => {
    toast.closeAll();
    onNewPatient();
  };

  // Determine if the sidebar should have floating behavior
  const shouldFloat = isSmallScreen && !isCollapsed;

  const isMacTauri = isTauri() && isMacOS();

  // Web, Docker, and every Tauri platform share the same full-height rail.
  // macOS keeps platform-specific clearance below the overlay traffic lights.
  const navStyle = {
    h: "100dvh",
    my: 0,
    mx: 0,
    bg: "folio.sidebar",
    backdropFilter: "none",
    borderRadius: "0",
    boxShadow: "none",
    border: "none",
  };

  return (
    <Box
      ref={sidebarRef}
      as="nav"
      pos={shouldFloat ? "fixed" : "fixed"}
      top="0"
      left="0"
      {...navStyle}
      p="4"
      pt="4"
      display="flex"
      flexDirection="column"
      w={sidebarWidth(isCollapsed)}
      transition="all 0.3s ease"
      zIndex={shouldFloat ? "1200" : "100"} // Increase z-index when in overlay mode
      transform={
        isSmallScreen && isCollapsed ? "translateX(-100%)" : "translateX(0)"
      }
    >
      {/* macOS overlay titlebar drag region; Windows/GNOME keep native
          titlebar dragging. */}
      {isMacTauri && (
        <Box
          data-tauri-drag-region
          position="absolute"
          top="0"
          left="0"
          right="0"
          height="25px"
          zIndex="10"
        />
      )}
      {/* Small screen close button - only show when expanded */}
      {isSmallScreen && !isCollapsed && (
        <IconButton
          onClick={toggleSidebar}
          position="absolute"
          top={isMacTauri ? "44px" : "12px"}
          right="15px"
          size="sm"
          borderRadius="full"
          aria-label={t("sidebar.closeAriaLabel")}
          zIndex="200"
          variant="ghost"
          color="folio.sidebarMuted"
          _hover={{ bg: "folio.sidebarAlt", color: "folio.sidebarInk" }}
          _focusVisible={{
            outline: "2px solid",
            outlineColor: "folio.brandOnSidebar",
            outlineOffset: "2px",
          }}
        >
          <CollapseIcon boxSize="20px" />
        </IconButton>
      )}
      {/* Logo Area + inline collapse toggle */}
      <Flex
        width="100%"
        h="40px"
        align="center"
        justify="space-between"
        overflow="hidden"
        transition="margin-top 0.3s ease"
        mt={isMacTauri ? "30px" : "0px"}
        mb="12px"
      >
        <Box cursor={isCollapsed ? "e-resize" : "pointer"} asChild ml="10px">
          <button
            onClick={() =>
              isCollapsed ? toggleSidebar() : handleNavigation("/")
            }
          >
            {isCollapsed ? (
              <Tooltip
                content={t("sidebar.expandTooltip")}
                positioning={{
                  placement: "right",
                }}
              >
                <Box
                  position="relative"
                  width="28px"
                  height="40px"
                  className="group"
                >
                  <Image
                    src="/logo.webp"
                    alt={t("sidebar.logoAlt")}
                    width="100%"
                    height="100%"
                    objectFit="contain"
                    position="absolute"
                    top="50%"
                    left="0"
                    transform="translateY(-50%)"
                    transition="opacity 0.2s"
                    _groupHover={{ opacity: 0 }}
                  />
                  <Flex
                    position="absolute"
                    top="0"
                    left="0"
                    width="100%"
                    height="100%"
                    align="center"
                    justify="center"
                    opacity="0"
                    transition="opacity 0.2s"
                    _groupHover={{ opacity: 1 }}
                  >
                    <CollapseIcon boxSize="28px" />
                  </Flex>
                </Box>
              </Tooltip>
            ) : (
              <Tooltip
                content={t("sidebar.chatDashboardTooltip")}
                positioning={{ placement: "bottom" }}
                openDelay={700}
              >
              <Flex align="center" gap={3}>
                <Image src="/logo.webp" alt={t("sidebar.logoAlt")} width="28px" />
                <Text
                  fontFamily="display"
                  fontSize="3xl"
                  fontWeight="500"
                  color="folio.sidebarInk"
                  letterSpacing="-0.02em"
                >
                  Phlox
                </Text>
              </Flex>
              </Tooltip>
            )}
          </button>
        </Box>
        {!isSmallScreen && !isCollapsed && (
          <Tooltip
            content={t("sidebar.collapseTooltip")}
            positioning={{ placement: "bottom" }}
          >
            <IconButton
              onClick={toggleSidebar}
              size="sm"
              variant="ghost"
              borderRadius="full"
              aria-label={t("sidebar.collapseAriaLabel")}
              color="folio.sidebarMuted"
              _hover={{ bg: "folio.sidebarAlt", color: "folio.sidebarInk" }}
              _focusVisible={{
                outline: "2px solid",
                outlineColor: "folio.brandOnSidebar",
                outlineOffset: "2px",
              }}
            >
              <CollapseIcon boxSize="18px" />
            </IconButton>
          </Tooltip>
        )}
      </Flex>
      {/* Main Content Area */}
      <Flex direction="column" flex="1" overflow="hidden">
        {/* Navigation (top) — New Note is the primary action, first row */}
        <SidebarNavigation
          isCollapsed={isCollapsed}
          handleNavigation={handleNavigation}
          onNewPatient={handleNewPatient}
          incompleteJobsCount={incompleteJobsCount}
        />

        {/* Patient List — hidden in collapsed mode */}
        {!isCollapsed && (
          <Box flex="1" minH="0" mb={2}>
            <SidebarPatientList
              patients={patients}
              onSelectPatient={handlePatientClick}
              onDeletePatient={handleDelete}
              isCollapsed={isCollapsed}
              selectedPatientId={selectedPatientId}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              onShowSummary={() => handleNavigation("/clinic-summary")}
              isAdmin={isAdmin}
              patientScope={patientScope}
              onTogglePatientScope={() =>
                setPatientScope(patientScope === "mine" ? "all" : "mine")
              }
              onOpenCompanionImport={onOpenCompanionImport}
            />
          </Box>
        )}
      </Flex>
      {/* Version info at bottom - adjusted for collapsed view */}
      <Box mt="2" pt="2" pb={isCollapsed ? "2" : "0"}>
        <VersionInfo
          isCollapsed={isCollapsed}
          colorMode={colorMode}
          toggleColorMode={toggleColorMode}
        />
      </Box>
      {/* Delete confirmation modal */}
      <ConfirmDialog
        intent="destructive"
        isOpen={open}
        onClose={onClose}
        onConfirm={confirmDelete}
        title={t("sidebar.deletePatient.title")}
        body={
          patientToDelete?.name
            ? t("sidebar.deletePatient.bodyWithName", {
                name: patientToDelete?.name,
              })
            : t("sidebar.deletePatient.body")
        }
        confirmLabel={t("action.delete")}
      />
    </Box>
  );
};

export default Sidebar;
