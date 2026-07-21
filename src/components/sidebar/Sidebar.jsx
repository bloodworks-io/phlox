/*
 MIGRATION NOTE: The following Chakra UI hooks have been removed.
 Please replace them with the suggested alternatives:

//   - useOutsideClick: Use react-use: useClickAway

 See: https://chakra-ui.com/docs/get-started/migration#hooks
*/
import {
  Box,
  Text,
  IconButton,
  useDisclosure,
  Image,
  Flex,
} from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { useApiToast } from "../../utils/helpers/apiToastContext";
import { useState, useEffect, useRef } from "react";

import VersionInfo from "./VersionInfo";
import SidebarPatientList from "./SidebarPatientList";
import SidebarNavigation from "./SidebarNavigation";
import DeleteConfirmationModal from "./DeleteConfirmationModal";
import { colors } from "../../theme/colors";
import { sidebarWidth } from "../../theme/dimensions";
import { patientApi } from "../../utils/api/patientApi";
import { isTauri } from "../../utils/helpers/apiConfig";

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
  refreshKey,
  handleNavigation,
  isCollapsed,
  toggleSidebar,
  isSmallScreen,
  colorMode,
  toggleColorMode,
}) => {
  // State declarations remain the same
  const [patients, setPatients] = useState([]);
  const { open, onOpen, onClose } = useDisclosure();
  const [patientToDelete, setPatientToDelete] = useState(null);
  const [incompleteJobsCount, setIncompleteJobsCount] = useState(0);
  const toast = useApiToast();

  // Color mode values
  const labelColor = colors.dark.textSecondary;
  const hoverColor = colors.dark.sidebar.hover;

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

  // Function definitions remain the same
  const fetchPatients = async (date) => {
    try {
      const data = await patientApi.fetchNoteList({ date });
      // Sort patients by ID in descending order
      const sortedPatients = data.sort((a, b) => a.id - b.id);
      setPatients(sortedPatients);
    } catch (error) {
      console.error("Error fetching patients:", error);
    }
  };

  const fetchIncompleteJobsCount = async () => {
    try {
      const data = await patientApi.fetchIncompleteJobsCount();
      setIncompleteJobsCount(data.incomplete_jobs_count);
    } catch (error) {
      console.error("Error fetching incomplete jobs count:", error);
    }
  };

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

  useEffect(() => {
    fetchPatients(selectedDate);
    fetchIncompleteJobsCount();
  }, [selectedDate, refreshKey]);

  // Determine if the sidebar should have floating behavior
  const shouldFloat = isSmallScreen && !isCollapsed;

  // glass styling only for desktop; web/docker gets flat full-height
  const navStyle = isTauri()
    ? {
        h: "calc(100dvh - 18px)",
        my: 2,
        mx: 2,
        bg: "linear-gradient(to bottom, rgba(45, 47, 65, 0.95), rgba(30, 32, 48, 0.95))",
        backdropFilter: "blur(20px) saturate(180%)",
        borderRadius: "2xl",
        boxShadow:
          "0 4px 24px rgba(20, 20, 38, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
        border: "1px solid",
        borderColor: "rgba(0, 0, 0, 0.2)",
      }
    : {
        h: "100dvh",
        my: 0,
        mx: 0,
        bg: "sidebar.background",
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
      pt={isCollapsed ? (isTauri() ? "1" : "2") : isTauri() ? "10" : "4"}
      display="flex"
      flexDirection="column"
      w={sidebarWidth(isCollapsed)}
      transition="all 0.3s ease"
      zIndex={shouldFloat ? "1200" : "100"} // Increase z-index when in overlay mode
      transform={
        isSmallScreen && isCollapsed ? "translateX(-100%)" : "translateX(0)"
      }
    >
      {/* Tauri titlebar drag region - full sidebar width */}
      {isTauri() && (
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
          top={isTauri() ? "32px" : "12px"}
          right="15px"
          size="sm"
          borderRadius="full"
          aria-label="Close sidebar"
          zIndex="200"
          variant="ghost"
          color={labelColor}
          _hover={{ bg: hoverColor }}
        >
          <CollapseIcon boxSize="20px" />
        </IconButton>
      )}
      {/* Logo Area + inline collapse toggle */}
      <Flex
        width="100%"
        align="center"
        justify="space-between"
        overflow="hidden"
        transition="margin-top 0.3s ease"
        mt={
          isCollapsed
            ? isTauri()
              ? "50px"
              : "8px"
            : isTauri()
              ? "15px"
              : "0px"
        }
        mb={isCollapsed ? "21px" : "15px"}
      >
        <Box cursor={isCollapsed ? "e-resize" : "pointer"} asChild ml="10px">
          <button
            onClick={() =>
              isCollapsed ? toggleSidebar() : handleNavigation("/")
            }
          >
            {isCollapsed ? (
              <Tooltip
                content="Expand Sidebar"
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
                    alt="Phlox logo"
                    width="100%"
                    height="100%"
                    mt="2px"
                    objectFit="contain"
                    position="absolute"
                    top="0"
                    left="0"
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
                content="Chat dashboard"
                positioning={{ placement: "bottom" }}
                openDelay={700}
              >
              <Flex align="center" gap={3}>
                <Image src="/logo.webp" alt="Phlox logo" width="28px" />
                <Text
                  fontFamily="heading"
                  fontSize="3xl"
                  fontWeight="700"
                  color="sidebar.text"
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
            content="Collapse Sidebar"
            positioning={{ placement: "bottom" }}
          >
            <IconButton
              onClick={toggleSidebar}
              size="sm"
              variant="ghost"
              borderRadius="full"
              aria-label="Collapse sidebar"
              color={labelColor}
              _hover={{ bg: hoverColor }}
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
      <DeleteConfirmationModal
        isOpen={open}
        onClose={onClose}
        onDelete={confirmDelete}
        patientName={patientToDelete?.name}
      />
    </Box>
  );
};

export default Sidebar;
