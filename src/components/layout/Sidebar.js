import {
    Box,
    VStack,
    Text,
    IconButton,
    useDisclosure,
    HStack,
    Input,
    Image,
    Flex,
    Button,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalFooter,
    ModalBody,
    ModalCloseButton,
    Badge,
    useToast,
    Collapse,
    Tooltip,
} from "@chakra-ui/react";
import { useState, useEffect } from "react";
import {
    DeleteIcon,
    AddIcon,
    SettingsIcon,
    HamburgerIcon,
} from "@chakra-ui/icons";
import { FaClinicMedical, FaTasks } from "react-icons/fa";
import { GiBrain } from "react-icons/gi";
import VersionInfo from "./VersionInfo";

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
    const [patients, setPatients] = useState([]);
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [patientToDelete, setPatientToDelete] = useState(null);
    const [hoveredPatientId, setHoveredPatientId] = useState(null);
    const [hoveredNewPatient, setHoveredNewPatient] = useState(false);
    const [incompleteJobsCount, setIncompleteJobsCount] = useState(0);
    const toast = useToast();

    const fetchPatients = async (date) => {
        try {
            const response = await fetch(`/api/patient/list?date=${date}`);
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
            const response = await fetch(`/api/patient/incomplete-jobs-count`);
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
                const response = await fetch(
                    `/api/patient/id/${patientToDelete.id}`,
                    {
                        method: "DELETE",
                    },
                );
                if (response.ok) {
                    setPatients(
                        patients.filter(
                            (patient) => patient.id !== patientToDelete.id,
                        ),
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

    useEffect(() => {
        console.log("Sidebar refresh triggered, refreshKey:", refreshKey);
        fetchPatients(selectedDate);
        fetchIncompleteJobsCount();
    }, [selectedDate, refreshKey]);

    return (
        <Box
            as="nav"
            pos="fixed"
            top="0"
            left="0"
            h="100vh"
            className="sidebar"
            p={isCollapsed ? "2" : "4"}
            boxShadow="lg"
            display="flex"
            flexDirection="column"
            w={isCollapsed ? "50px" : "200px"}
            transition="all 0.3s ease"
            zIndex="100"
            transform={
                isSmallScreen && isCollapsed
                    ? "translateX(-100%)"
                    : "translateX(0)"
            }
        >
            {/* Only show the internal toggle button on larger screens */}
            {!isSmallScreen && (
                <Tooltip
                    label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                    placement="right"
                >
                    <IconButton
                        icon={<HamburgerIcon />}
                        onClick={toggleSidebar}
                        position="absolute"
                        top="5px"
                        left="8px"
                        size="sm"
                        borderRadius="sm"
                        aria-label="Toggle sidebar"
                        zIndex="200"
                        className="sidebar-toggle"
                    />
                </Tooltip>
            )}

            {/* Normal sidebar when not collapsed */}
            {!isCollapsed && (
                <VStack
                    spacing="5"
                    align="stretch"
                    h="full"
                    overflowY="auto"
                    maxHeight="100vh"
                    display="flex"
                    flexDirection="column"
                    justifyContent="space-between"
                >
                    <VStack
                        spacing="5"
                        align="stretch"
                        h="full"
                        overflowY="auto"
                        maxHeight="100vh"
                    >
                        <Box
                            as="button"
                            onClick={() => handleNavigation("/")}
                            cursor="pointer"
                            _hover={{ opacity: 0.8 }}
                            transition="opacity 0.2s"
                            display="flex"
                            justifyContent="center"
                            width="100%"
                            mt="5px" // Added margin-top to account for the toggle button spacing
                        >
                            <Image
                                src="/logo.webp"
                                alt="Logo"
                                mt="5"
                                width="100px"
                            />
                        </Box>

                        {/* Date selector */}
                        <Box>
                            <Text as="h4">Clinic Date</Text>
                            <Input
                                type="date"
                                value={selectedDate || ""}
                                onChange={(e) =>
                                    setSelectedDate(e.target.value)
                                }
                                size="sm"
                                mt="2"
                                className="input-style"
                            />
                        </Box>

                        {/* New Patient button */}
                        <Box
                            p="2"
                            borderRadius="sm"
                            mt="2"
                            mb="4"
                            className="new-patient"
                            display="flex"
                            alignItems="center"
                            justifyContent="space-between"
                            onClick={() => {
                                toast.closeAll();
                                onNewPatient();
                            }}
                            onMouseEnter={() => setHoveredNewPatient(true)}
                            onMouseLeave={() => setHoveredNewPatient(false)}
                        >
                            <Text>New Patient</Text>
                            {hoveredNewPatient && <AddIcon />}
                        </Box>

                        {/* Patient List */}
                        <Text as="h4">Patient List</Text>
                        <Box
                            flex="1"
                            overflowY="auto"
                            className="custom-scrollbar"
                            mt="0"
                        >
                            {patients.length > 0 ? (
                                patients.map((patient) => {
                                    const nameParts = patient.name.split(" ");
                                    const initials =
                                        nameParts.length > 1
                                            ? `${nameParts[1][0]}${nameParts[0][0]}`
                                            : nameParts[0][0];
                                    return (
                                        <Box
                                            key={patient.id}
                                            p="2"
                                            borderRadius="sm"
                                            className="sidebar-patient-items"
                                            mb="2"
                                            display="flex"
                                            alignItems="center"
                                            justifyContent="space-between"
                                            onClick={() =>
                                                handlePatientClick(patient)
                                            }
                                            onMouseEnter={() =>
                                                setHoveredPatientId(patient.id)
                                            }
                                            onMouseLeave={() =>
                                                setHoveredPatientId(null)
                                            }
                                        >
                                            <HStack>
                                                <Box
                                                    maxW="120px"
                                                    whiteSpace="nowrap"
                                                    overflow="hidden"
                                                    textOverflow="ellipsis"
                                                    style={{
                                                        WebkitMaskImage:
                                                            hoveredPatientId ===
                                                            patient.id
                                                                ? "linear-gradient(to right, black 60%, transparent 100%)"
                                                                : "none",
                                                    }}
                                                >
                                                    <Text>{`${initials} ${patient.ur_number}`}</Text>
                                                </Box>
                                            </HStack>
                                            {hoveredPatientId ===
                                                patient.id && (
                                                <IconButton
                                                    icon={<DeleteIcon />}
                                                    size="sm"
                                                    aria-label="Delete patient"
                                                    className="sidebar-patient-items-delete"
                                                    onClick={(e) => {
                                                        toast.closeAll();
                                                        e.stopPropagation();
                                                        handleDelete(patient);
                                                    }}
                                                    width="24px"
                                                    height="24px"
                                                    minWidth="24px"
                                                    minHeight="24px"
                                                />
                                            )}
                                        </Box>
                                    );
                                })
                            ) : (
                                <Text>No patients available</Text>
                            )}
                        </Box>

                        {/* Day Summary and All Jobs buttons */}
                        <Box
                            display="flex"
                            mt="4"
                            justifyContent="center"
                            alignItems="center"
                            flexDirection="column"
                        >
                            <VStack spacing={2} width="100%" align="stretch">
                                {/* Day Summary button */}
                                <Flex justifyContent="center">
                                    <Button
                                        onClick={() =>
                                            handleNavigation("/clinic-summary")
                                        }
                                        fontSize="sm"
                                        width="150px"
                                        height="30px"
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="center"
                                        className="summary-buttons"
                                    >
                                        <FaClinicMedical
                                            style={{ marginRight: "8px" }}
                                        />
                                        Day Summary
                                    </Button>
                                </Flex>

                                {/* All Jobs button */}
                                <Flex
                                    justifyContent="center"
                                    position="relative"
                                >
                                    <Button
                                        onClick={() =>
                                            handleNavigation(
                                                "/outstanding-jobs",
                                            )
                                        }
                                        fontSize="sm"
                                        width="150px"
                                        height="30px"
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="center"
                                        className="summary-buttons"
                                    >
                                        <FaTasks
                                            style={{ marginRight: "8px" }}
                                        />
                                        All Jobs
                                        {incompleteJobsCount > 0 && (
                                            <Badge
                                                borderRadius="full"
                                                px="2"
                                                colorScheme="red"
                                                backgroundColor="red.500"
                                                color="white"
                                                position="absolute"
                                                top="5px"
                                                right="5px"
                                                fontSize="0.75em"
                                                width="20px"
                                                height="20px"
                                                display="flex"
                                                alignItems="center"
                                                justifyContent="center"
                                            >
                                                {incompleteJobsCount}
                                            </Badge>
                                        )}
                                    </Button>
                                </Flex>
                            </VStack>
                        </Box>

                        {/* Documents and Settings buttons */}
                        <Box mt="auto">
                            <VStack spacing={2} width="100%">
                                {/* Documents button */}
                                <Flex
                                    justifyContent="center"
                                    alignItems="center"
                                    width="100%"
                                >
                                    <Box
                                        p="2"
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="center"
                                        borderRadius="sm"
                                        className="settings-button"
                                        height="40px"
                                        width="150px"
                                        onClick={() => handleNavigation("/rag")}
                                    >
                                        <GiBrain />
                                        <Text ml="2" fontSize="md">
                                            Documents
                                        </Text>
                                    </Box>
                                </Flex>

                                {/* Settings button */}
                                <Flex
                                    justifyContent="center"
                                    alignItems="center"
                                    width="100%"
                                >
                                    <Box
                                        p="2"
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="center"
                                        borderRadius="sm"
                                        className="settings-button"
                                        height="40px"
                                        width="150px"
                                        onClick={() =>
                                            handleNavigation("/settings")
                                        }
                                    >
                                        <SettingsIcon />
                                        <Text ml="2" fontSize="md">
                                            Settings
                                        </Text>
                                    </Box>
                                </Flex>
                            </VStack>
                        </Box>
                    </VStack>

                    {!isCollapsed && <VersionInfo isCollapsed={false} />}
                </VStack>
            )}

            {/* Mini sidebar when collapsed */}
            {isCollapsed && (
                <VStack spacing="4" align="center" mt="50px">
                    <Tooltip label="Dashboard" placement="right">
                        <Box
                            as="button"
                            onClick={() => handleNavigation("/")}
                            p="2"
                        >
                            <Image src="/logo.webp" alt="Logo" width="30px" />
                        </Box>
                    </Tooltip>

                    <Tooltip label="New Patient" placement="right">
                        <Box
                            p="2"
                            onClick={() => {
                                toast.closeAll();
                                onNewPatient();
                            }}
                            cursor="pointer"
                        >
                            <AddIcon />
                        </Box>
                    </Tooltip>

                    <Tooltip label="Day Summary" placement="right">
                        <Box
                            p="2"
                            onClick={() => handleNavigation("/clinic-summary")}
                            cursor="pointer"
                        >
                            <FaClinicMedical />
                        </Box>
                    </Tooltip>

                    <Tooltip label="All Jobs" placement="right">
                        <Box
                            p="2"
                            onClick={() =>
                                handleNavigation("/outstanding-jobs")
                            }
                            cursor="pointer"
                            position="relative"
                        >
                            <FaTasks />
                            {incompleteJobsCount > 0 && (
                                <Badge
                                    borderRadius="full"
                                    backgroundColor="red.500"
                                    position="absolute"
                                    top="0"
                                    right="0"
                                    fontSize="0.6em"
                                >
                                    {incompleteJobsCount}
                                </Badge>
                            )}
                        </Box>
                    </Tooltip>

                    <Tooltip label="Documents" placement="right">
                        <Box
                            p="2"
                            onClick={() => handleNavigation("/rag")}
                            cursor="pointer"
                        >
                            <GiBrain />
                        </Box>
                    </Tooltip>

                    <Tooltip label="Settings" placement="right">
                        <Box
                            p="2"
                            onClick={() => handleNavigation("/settings")}
                            cursor="pointer"
                        >
                            <SettingsIcon />
                        </Box>
                    </Tooltip>
                </VStack>
            )}
            {isCollapsed && <VersionInfo isCollapsed={true} />}

            {/* Delete confirmation modal */}
            <Modal isOpen={isOpen} onClose={onClose}>
                <ModalOverlay />
                <ModalContent className="modal-style">
                    <ModalHeader>Delete Patient</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        Are you sure you want to delete this patient?
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            className="red-button"
                            mr={3}
                            onClick={confirmDelete}
                        >
                            Delete
                        </Button>
                        <Button className="green-button" onClick={onClose}>
                            Cancel
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </Box>
    );
};

export default Sidebar;
