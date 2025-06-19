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
} from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { FaPlus } from "react-icons/fa";
import { HamburgerIcon } from "@chakra-ui/icons";
import VersionInfo from "./VersionInfo";
import SidebarPatientList from "./SidebarPatientList";
import SidebarNavigation from "./SidebarNavigation";
import { AvatarButton } from "./SidebarHelpers";
import DeleteConfirmationModal from "./DeleteConfirmationModal";
import { colors } from "../../theme/colors";
import { buildApiUrl } from "../../utils/helpers/apiConfig";
import { universalFetch } from "../../utils/helpers/apiHelpers";

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
      as="nav"
      pos={shouldFloat ? "fixed" : "fixed"}
      top="0"
      left="0"
      h="100vh"
      p={isCollapsed ? "2" : "4"}
      bg={sidebarBg}
      boxShadow={shouldFloat ? "lg" : "md"}
      display="flex"
      flexDirection="column"
      w={isCollapsed ? "60px" : "220px"}
      transition="all 0.3s ease"
      zIndex={shouldFloat ? "1200" : "100"} // Increase z-index when in overlay mode
      transform={
        isSmallScreen && isCollapsed ? "translateX(-100%)" : "translateX(0)"
      }
    >
      {/* Small screen close button - only show when expanded */}
      {isSmallScreen && !isCollapsed && (
        <IconButton
          icon={<HamburgerIcon />}
          onClick={toggleSidebar}
          position="absolute"
          top="12px"
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

      {/* Regular toggle button - only for larger screens */}
      {!isSmallScreen && (
        <Tooltip
          label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          placement="right"
        >
          <IconButton
            icon={<HamburgerIcon />}
            onClick={toggleSidebar}
            position="absolute"
            top="12px"
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
        onClick={() => handleNavigation("/")}
        cursor="pointer"
        display="flex"
        justifyContent="center"
        width="100%"
        mt={isCollapsed ? "40px" : "5px"}
        mb={isCollapsed ? "10px" : "15px"}
      >
        <Image
          src="/logo.webp"
          alt="Logo"
          width={isCollapsed ? "35px" : "100px"}
        />
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
