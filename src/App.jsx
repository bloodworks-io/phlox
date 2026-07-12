import { useState, useEffect, useCallback } from "react";
import { Box } from "@chakra-ui/react";
import { useColorMode } from "./components/ui/color-mode";
import { useLocation } from "react-router";
import { toaster } from "@/components/ui/toaster";

const toast = toaster.create;

import { TemplateProvider } from "./utils/templates/templateContext";
import { ApiToastProvider } from "./utils/helpers/apiToastContext";
import { AppInitContext } from "./utils/context/appInit";
import AppLayout from "./components/layout/AppLayout";
import AppRoutes from "./components/layout/AppRoutes";
import ConfirmLeaveModal from "./components/modals/ConfirmLeaveModal";
import NewNoteModal from "./components/modals/NewNoteModal";
import { handleError } from "./utils/helpers/errorHandlers";
import { handleLoadPatientDetails } from "./utils/patient/patientHandlers";
import { usePatientSession } from "./utils/hooks/usePatientSession";
import { useAppBootstrap } from "./utils/hooks/useAppBootstrap";
import { useNavigationGuard } from "./utils/hooks/useNavigationGuard";
import { useSidebarState } from "./utils/hooks/useSidebarState";
import { useNewNoteFlow } from "./utils/hooks/useNewNoteFlow";

function AppContent({ setIsInitializing }) {
    const [isModified, setIsModified] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [isFromOutstandingJobs, setIsFromOutstandingJobs] = useState(false);

    // App-level patient "session": briefcase patient + shared selectedDate +
    // new-note actions. The editor (PatientDetails) owns its own copy.
    const {
        patient,
        setPatient,
        selectedDate,
        setSelectedDate,
        createNewPatient,
        findPatients,
        loadSelectedPatient,
    } = usePatientSession();

    const bootstrap = useAppBootstrap();
    const nav = useNavigationGuard(isModified, setIsModified);
    const newNote = useNewNoteFlow({
        createNewPatient,
        guardedNavigate: nav.guardedNavigate,
    });
    const { isSidebarCollapsed, toggleSidebar, isSmallScreen } =
        useSidebarState();
    const { colorMode, toggleColorMode } = useColorMode();
    const location = useLocation();

    useEffect(() => {
        if (setIsInitializing) {
            setIsInitializing(bootstrap.isInitializing);
        }
    }, [bootstrap.isInitializing, setIsInitializing]);

    const fetchPatientDetailsWrapper = useCallback(
        async (noteId) => {
            try {
                await handleLoadPatientDetails(noteId, {
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
        if (location.pathname.startsWith("/note/")) {
            const noteId = location.pathname.split("/").pop();
            fetchPatientDetailsWrapper(noteId);
        }
    }, [location, fetchPatientDetailsWrapper]);

    const refreshSidebar = useCallback(() => {
        setRefreshKey((prev) => prev + 1);
    }, []);

    const handleSelectPatient = (
        selectedPatient,
        fromOutstandingJobs = false,
    ) => {
        setIsFromOutstandingJobs(fromOutstandingJobs);
        nav.guardedNavigate(`/note/${selectedPatient.id}`);
    };

    if (bootstrap.gate) {
        return bootstrap.gate;
    }

    if (bootstrap.isInitializing) {
        return <Box className="splash-bg" w="100vw" h="100dvh" />;
    }

    return (
        <>
            <AppLayout
                isSmallScreen={isSmallScreen}
                isCollapsed={isSidebarCollapsed}
                colorMode={colorMode}
                toggleSidebar={toggleSidebar}
                sidebarProps={{
                    onNewPatient: newNote.openNewNoteModal,
                    onSelectPatient: handleSelectPatient,
                    selectedPatientId: location.pathname.startsWith("/note/")
                        ? patient?.id
                        : undefined,
                    selectedDate,
                    setSelectedDate,
                    refreshKey,
                    handleNavigation: nav.guardedNavigate,
                    isCollapsed: isSidebarCollapsed,
                    toggleSidebar,
                    isSmallScreen,
                    colorMode,
                    toggleColorMode,
                }}
            >
                <AppRoutes
                    patient={patient}
                    setPatient={setPatient}
                    selectedDate={selectedDate}
                    refreshSidebar={refreshSidebar}
                    setIsModified={setIsModified}
                    onResetLetter={newNote.setResetLetter}
                    onStartNewNote={newNote.startNewNote}
                    newNoteKey={newNote.newNoteKey}
                    handleSelectPatient={handleSelectPatient}
                />
            </AppLayout>
            <NewNoteModal
                isOpen={newNote.isNewNoteOpen}
                onClose={newNote.closeNewNoteModal}
                patient={patient}
                setPatient={setPatient}
                createNewPatient={createNewPatient}
                findPatients={findPatients}
                loadSelectedPatient={loadSelectedPatient}
                selectedDate={selectedDate}
                onComplete={newNote.completeNewNote}
            />
            <ConfirmLeaveModal
                isOpen={nav.isLeaveOpen}
                onClose={nav.cancelNavigation}
                confirmNavigation={nav.confirmNavigation}
            />
        </>
    );
}

function App() {
    const [isInitializing, setIsInitializing] = useState(true);

    return (
        <AppInitContext.Provider value={{ isInitializing }}>
            <ApiToastProvider>
                <TemplateProvider>
                    <AppContent setIsInitializing={setIsInitializing} />
                </TemplateProvider>
            </ApiToastProvider>
        </AppInitContext.Provider>
    );
}

export default App;
