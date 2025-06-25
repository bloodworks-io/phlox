import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import {
    Box,
    Flex,
    useDisclosure,
    useColorMode,
    IconButton,
    useToast,
} from "@chakra-ui/react";
import { SunIcon, MoonIcon, HamburgerIcon } from "@chakra-ui/icons";
import { useState, useEffect, useCallback } from "react";
import { TemplateProvider } from "./utils/templates/templateContext";
import Sidebar from "./components/sidebar/Sidebar";
import LandingPage from "./pages/LandingPage";
import PatientDetails from "./pages/PatientDetails";
import Settings from "./pages/Settings";
import Rag from "./pages/Rag";
import ClinicSummary from "./pages/ClinicSummary";
import OutstandingJobs from "./pages/OutstandingJobs";
import ConfirmLeaveModal from "./components/modals/ConfirmLeaveModal";
import { handleError } from "./utils/helpers/errorHandlers";
import {
    handleLoadPatientDetails,
    handleFetchPatientLetter,
} from "./utils/patient/patientHandlers";
import { usePatient } from "./utils/hooks/usePatient";
import { useBreakpointValue } from "@chakra-ui/react";
import theme from "./theme"; // Assuming theme is exported from here for ChakraProvider
import SplashScreen from "./components/common/SplashScreen"; // Import SplashScreen
import { settingsService } from "./utils/settings/settingsUtils"; // Import settingsService

function AppContent() {
    const [showSplashScreen, setShowSplashScreen] = useState(undefined);
    const [isLoadingSplashCheck, setIsLoadingSplashCheck] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const [isModified, setIsModified] = useState(false);
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [pendingNavigation, setPendingNavigation] = useState(null);
    const navigate = useNavigate();
    const toast = useToast();
    const location = useLocation();
    const { colorMode, toggleColorMode } = useColorMode();
    const [isFromOutstandingJobs, setIsFromOutstandingJobs] = useState(false);
    const [resetLetter, setResetLetter] = useState(null);

    // Use the patient hook for all patient-related state
    const {
        patient,
        setPatient,
        selectedDate,
        setSelectedDate,
        finalCorrespondence,
        setFinalCorrespondence,
        createNewPatient,
        templateKey,
        setTemplateKey,
    } = usePatient();

    const fetchPatientDetailsWrapper = useCallback(
        async (patientId) => {
            try {
                const patientData = await handleLoadPatientDetails(patientId, {
                    setPatient,
                    setSelectedDate,
                    isFromOutstandingJobs,
                    setIsFromOutstandingJobs,
                });
            } catch (error) {
                handleError(error, toast);
            }
        },
        [isFromOutstandingJobs, toast, setPatient, setSelectedDate],
    );

    useEffect(() => {
        if (location.pathname.startsWith("/patient/")) {
            const patientId = location.pathname.split("/").pop();
            fetchPatientDetailsWrapper(patientId);
        }
    }, [location, fetchPatientDetailsWrapper]);

    const handleNewPatient = async () => {
        try {
            await createNewPatient();
            if (resetLetter) {
                resetLetter(); // Clear the letter when creating new patient
            }
            handleNavigation("/new-patient");
        } catch (error) {
            console.error("Error creating new patient:", error);
            toast({
                title: "Error",
                description: "Failed to create new patient",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        }
    };

    const handleSelectPatient = (
        selectedPatient,
        fromOutstandingJobs = false,
    ) => {
        setIsFromOutstandingJobs(fromOutstandingJobs);
        if (isModified) {
            setPendingNavigation(`/patient/${selectedPatient.id}`);
            onOpen();
        } else {
            navigate(`/patient/${selectedPatient.id}`);
        }
    };

    const handleNavigation = (path) => {
        toast.closeAll();
        if (isModified) {
            setPendingNavigation(path);
            onOpen();
        } else {
            setIsModified(false);
            navigate(path);
        }
    };

    const confirmNavigation = () => {
        onClose();
        if (pendingNavigation) {
            setIsModified(false);
            navigate(pendingNavigation);
            setPendingNavigation(null);
        }
    };

    const cancelNavigation = () => {
        onClose();
        setPendingNavigation(null);
    };

    const refreshSidebar = useCallback(() => {
        setRefreshKey((prev) => prev + 1);
    }, []);

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isModified) {
                e.preventDefault();
                e.returnValue =
                    "You have unsaved changes. Are you sure you want to leave?";
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () =>
            window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isModified]);

    // Sidebar Items
    const toggleSidebar = useCallback(() => {
        setIsSidebarCollapsed((prev) => !prev);
    }, []);

    // This will return true for "base" and "sm" breakpoints, false for larger screens
    const defaultCollapsed = useBreakpointValue({
        base: true,
        sm: true,
        md: false,
    });

    // Initialize sidebar state with the breakpoint-dependent value
    const [isSidebarCollapsed, setIsSidebarCollapsed] =
        useState(defaultCollapsed);

    const isSmallScreen = useBreakpointValue({ base: true, md: false });

    const sidebarShouldHover = isSmallScreen && !isSidebarCollapsed;

    // Update sidebar state whenever the breakpoint changes
    useEffect(() => {
        if (defaultCollapsed !== undefined) {
            setIsSidebarCollapsed(defaultCollapsed);
        }
    }, [defaultCollapsed]);

    // Splash screen logic
    useEffect(() => {
        const checkSplashStatus = async () => {
            try {
                await settingsService.fetchUserSettings((userData) => {
                    if (
                        userData &&
                        typeof userData.has_completed_splash_screen ===
                            "boolean"
                    ) {
                        setShowSplashScreen(
                            !userData.has_completed_splash_screen,
                        );
                    } else {
                        setShowSplashScreen(true); // Default to showing splash if flag is missing/invalid
                    }
                });
            } catch (error) {
                console.error("Error checking splash screen status:", error);
                setShowSplashScreen(true); // Default to showing splash on error
            } finally {
                setIsLoadingSplashCheck(false);
            }
        };

        checkSplashStatus();
    }, []);

    const handleSplashComplete = () => {
        setShowSplashScreen(false);
    };

    if (isLoadingSplashCheck) {
        return null; // or a loading spinner
    }

    if (showSplashScreen) {
        return <SplashScreen onComplete={handleSplashComplete} />;
    }
    return (
        <Flex position="relative">
            {/* Floating hamburger button for small screens */}
            {isSmallScreen && isSidebarCollapsed && (
                <IconButton
                    icon={<HamburgerIcon />}
                    onClick={toggleSidebar}
                    position="fixed"
                    top="10px"
                    left="10px"
                    zIndex="101"
                    aria-label="Toggle sidebar"
                    className="dark-toggle"
                />
            )}

            <Sidebar
                onNewPatient={handleNewPatient}
                onSelectPatient={handleSelectPatient}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                refreshKey={refreshKey}
                handleNavigation={handleNavigation}
                isCollapsed={isSidebarCollapsed}
                toggleSidebar={toggleSidebar}
                isSmallScreen={isSmallScreen}
            />

            <Box
                flex="1"
                ml={isSmallScreen ? "0" : isSidebarCollapsed ? "60px" : "220px"}
                p={isSmallScreen ? "6" : "0"}
                pt={isSmallScreen ? "50px" : "0"}
                className="main-bg"
                minH="100vh"
                transition="margin-left 0.3s ease"
            >
                <IconButton
                    position="absolute"
                    top={5}
                    right={5}
                    aria-label="Toggle color mode"
                    icon={colorMode === "light" ? <MoonIcon /> : <SunIcon />}
                    className="dark-toggle"
                    onClick={toggleColorMode}
                />
                <Routes>
                    <Route
                        path="/new-patient"
                        element={
                            <PatientDetails
                                patient={patient}
                                setPatient={setPatient}
                                selectedDate={selectedDate}
                                refreshSidebar={refreshSidebar}
                                setIsModified={setIsModified}
                                finalCorrespondence={finalCorrespondence}
                                setFinalCorrespondence={setFinalCorrespondence}
                                templateKey={templateKey}
                                setTemplateKey={setTemplateKey}
                                onResetLetter={setResetLetter}
                            />
                        }
                    />
                    <Route
                        path="/patient/:id"
                        element={
                            <PatientDetails
                                patient={patient}
                                setPatient={setPatient}
                                selectedDate={selectedDate}
                                refreshSidebar={refreshSidebar}
                                setIsModified={setIsModified}
                                finalCorrespondence={finalCorrespondence}
                                setFinalCorrespondence={setFinalCorrespondence}
                                templateKey={templateKey}
                                setTemplateKey={setTemplateKey}
                            />
                        }
                    />
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/rag" element={<Rag />} />
                    <Route
                        path="/clinic-summary"
                        element={
                            <ClinicSummary
                                selectedDate={selectedDate}
                                handleSelectPatient={handleSelectPatient}
                                refreshSidebar={refreshSidebar}
                            />
                        }
                    />
                    <Route
                        path="/outstanding-jobs"
                        element={
                            <OutstandingJobs
                                handleSelectPatient={(patient) =>
                                    handleSelectPatient(patient, true)
                                }
                                refreshSidebar={refreshSidebar}
                            />
                        }
                    />
                </Routes>
            </Box>
            <ConfirmLeaveModal
                isOpen={isOpen}
                onClose={cancelNavigation}
                confirmNavigation={confirmNavigation}
            />
        </Flex>
    );
}

// Wrap the entire app with TemplateProvider
function App() {
    return (
        <TemplateProvider>
            <AppContent />
        </TemplateProvider>
    );
}

export default App;
