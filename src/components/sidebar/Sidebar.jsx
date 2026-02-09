import {
  Box,
  VStack,
  Text,
  IconButton,
  useDisclosure,
  Input,
  Image,
  Flex,
  Divider,
  useColorModeValue,
  Tooltip,
  useToast,
  useOutsideClick,
} from "@chakra-ui/react";
import { useState, useEffect, useRef } from "react";
import { FaPlus } from "react-icons/fa";

import VersionInfo from "./VersionInfo";
import SidebarPatientList from "./SidebarPatientList";
import SidebarNavigation from "./SidebarNavigation";
import { AvatarButton } from "./SidebarHelpers";
import DeleteConfirmationModal from "./DeleteConfirmationModal";
import { colors } from "../../theme/colors";
import { buildApiUrl } from "../../utils/helpers/apiConfig";
import { universalFetch } from "../../utils/helpers/apiHelpers";
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
  selectedDate,
  setSelectedDate,
  refreshKey,
  handleNavigation,
  isCollapsed,
  toggleSidebar,
  isSmallScreen,
}) => {
  // State declarations remain the same
  const [patients, setPatients] = useState([]);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [patientToDelete, setPatientToDelete] = useState(null);
  const [incompleteJobsCount, setIncompleteJobsCount] = useState(0);
  const toast = useToast();

  // Color mode values
  const sidebarBg = colors.dark.sidebar.background;
  const textColor = colors.dark.sidebar.text;
  const labelColor = colors.dark.textSecondary;
  const dividerColor = colors.dark.divider;
  const hoverColor = colors.dark.sidebar.hover;

  // Ref for detecting outside clicks on small screens
  const sidebarRef = useRef(null);

  // Close sidebar when clicking outside on small screens
  useOutsideClick({
    ref: sidebarRef,
    handler: () => {
      if (isSmallScreen && !isCollapsed) {
        toggleSidebar();
      }
    },
  });

  // Function definitions remain the same
  const fetchPatients = async (date) => {
    try {
      const url = await buildApiUrl(`/api/patient/list?date=${date}`);
      const response = await universalFetch(url);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
      // Sort patients by ID in descending order
      const sortedPatients = data.sort((a, b) => a.id - b.id);
      setPatients(sortedPatients);
    } catch (error) {
      console.error("Error fetching patients:", error);
    }
  };

  const fetchIncompleteJobsCount = async () => {
    try {
      const url = await buildApiUrl(`/api/patient/incomplete-jobs-count`);
      const response = await universalFetch(url);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
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
        const url = await buildApiUrl(`/api/patient/id/${patientToDelete.id}`);
        const response = await universalFetch(url, {
          method: "DELETE",
        });
        if (response.ok) {
          setPatients(
            patients.filter((patient) => patient.id !== patientToDelete.id),
          );
          onClose();
        } else {
          console.error("Error deleting patient");
        }
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
    console.log("Sidebar refresh triggered, refreshKey:", refreshKey);
    fetchPatients(selectedDate);
    fetchIncompleteJobsCount();
  }, [selectedDate, refreshKey]);

  // Determine if the sidebar should have floating behavior
  const shouldFloat = isSmallScreen && !isCollapsed;

  return (
    <Box
      ref={sidebarRef}
      as="nav"
      pos={shouldFloat ? "fixed" : "fixed"}
      top="0"
      left="0"
      h="100vh"
      p={isCollapsed ? "2" : "4"}
      pt={isCollapsed ? (isTauri() ? "0" : "2") : isTauri() ? "8" : "4"}
      bg={sidebarBg}
      boxShadow={shouldFloat ? "lg" : "md"}
      display="flex"
      flexDirection="column"
      w={isCollapsed ? "80px" : "220px"}
      transition="all 0.3s ease"
      zIndex={shouldFloat ? "1200" : "100"} // Increase z-index when in overlay mode
      transform={
        isSmallScreen && isCollapsed ? "translateX(-100%)" : "translateX(0)"
      }
    >
      {/* Small screen close button - only show when expanded */}
      {isSmallScreen && !isCollapsed && (
        <IconButton
          icon={<CollapseIcon boxSize="20px" />}
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
        />
      )}

      {/* Regular toggle button - only show when expanded on larger screens */}
      {!isSmallScreen && !isCollapsed && (
        <Tooltip label="Collapse Sidebar" placement="right">
          <IconButton
            icon={<CollapseIcon boxSize="20px" />}
            cursor={isCollapsed ? "pointer" : "w-resize"}
            onClick={toggleSidebar}
            position="absolute"
            top={isTauri() ? "32px" : "12px"}
            right="15px"
            size="sm"
            borderRadius="full"
            aria-label="Toggle sidebar"
            zIndex="200"
            variant="ghost"
            color={labelColor}
            _hover={{ bg: hoverColor }}
          />
        </Tooltip>
      )}

      {/* Logo Area */}
      <Box
        as="button"
        onClick={() => (isCollapsed ? toggleSidebar() : handleNavigation("/"))}
        cursor={isCollapsed ? "e-resize" : "pointer"}
        display="flex"
        justifyContent="center"
        width="100%"
        mt={
          isCollapsed
            ? isTauri()
              ? "50px"
              : "12px"
            : isTauri()
              ? "15px"
              : "5px"
        }
        mb={isCollapsed ? "10px" : "15px"}
      >
        {isCollapsed ? (
          <Tooltip label="Expand Sidebar" placement="right">
            <Box position="relative" width="35px" height="35px" role="group">
              <Image
                src="/logo.webp"
                alt="Logo"
                width="35px"
                position="absolute"
                transition="opacity 0.2s"
                _groupHover={{ opacity: 0 }}
              />
              <Box
                position="absolute"
                top="0"
                left="0"
                opacity="0"
                transition="opacity 0.2s"
                _groupHover={{ opacity: 1 }}
              >
                <CollapseIcon boxSize="35px" />
              </Box>
            </Box>
          </Tooltip>
        ) : (
          <Image src="/logo.webp" alt="Logo" width="100px" />
        )}
      </Box>

      {/* Main Content Area - Restructured for better collapsed view */}
      <Flex
        direction="column"
        flex="1"
        justifyContent="space-between"
        overflow="hidden"
      >
        {/* Top section with date selector and new patient button */}
        <Box>
          {/* Date selector - only visible when expanded */}
          {!isCollapsed && (
            <Box mb="2">
              <Text fontSize="xs" fontWeight="medium" color={labelColor} mb="1">
                CLINIC DATE
              </Text>
              <Input
                type="date"
                value={selectedDate || ""}
                onChange={(e) => setSelectedDate(e.target.value)}
                size="sm"
                borderRadius="md"
                className="clinic-date-input"
              />
            </Box>
          )}

          {/* New Patient button - adjusted size for collapsed view */}
          <Tooltip
            label="New Patient"
            placement={isCollapsed ? "right" : "top"}
          >
            <Box w="100%" mb={isCollapsed ? 4 : 0} mt={isCollapsed ? 4 : 0}>
              <AvatarButton
                icon={<FaPlus fontSize={isCollapsed ? "0.9rem" : "1.2rem"} />}
                backgroundColor={colors.dark.tertiaryButton}
                label="New Patient"
                onClick={onNewPatient}
                isCollapsed={isCollapsed}
              />
            </Box>
          </Tooltip>
        </Box>

        {/* Patient List Section - Make it grow and scroll */}
        <Box
          flex="1"
          overflowY="auto"
          overflowX="hidden"
          className="custom-scrollbar"
          mb={2}
        >
          <SidebarPatientList
            patients={patients}
            onSelectPatient={handlePatientClick}
            onDeletePatient={handleDelete}
            isCollapsed={isCollapsed}
          />
        </Box>

        {/* Navigation Section - Natural flow at bottom */}
        <Box
          width="100%"
          bg={sidebarBg}
          pt="2"
          borderTop={`1px solid ${dividerColor}`}
        >
          <SidebarNavigation
            isCollapsed={isCollapsed}
            handleNavigation={handleNavigation}
            onNewPatient={handleNewPatient}
            incompleteJobsCount={incompleteJobsCount}
          />
        </Box>
      </Flex>

      {/* Version info at bottom - adjusted for collapsed view */}
      <Box mt="2" pt="2" pb={isCollapsed ? "2" : "0"}>
        <VersionInfo isCollapsed={isCollapsed} />
      </Box>

      {/* Delete confirmation modal */}
      <DeleteConfirmationModal
        isOpen={isOpen}
        onClose={onClose}
        onDelete={confirmDelete}
        patientName={patientToDelete?.name}
      />
    </Box>
  );
};

export default Sidebar;
