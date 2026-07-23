import { Routes, Route } from "react-router";
import LandingPage from "../../pages/LandingPage";
import PatientDetails from "../../pages/PatientDetails";
import Settings from "../../pages/Settings";
import Rag from "../../pages/Rag";
import ClinicSummary from "../../pages/ClinicSummary";
import OutstandingJobs from "../../pages/OutstandingJobs";

const AppRoutes = ({
    patient,
    setPatient,
    selectedDate,
    refreshSidebar,
    setIsModified,
    onResetLetter,
    onOpenNewNoteModal,
    newNoteKey,
    handleSelectPatient,
}) => (
    <Routes>
        <Route
            path="/new-note"
            element={
                <PatientDetails
                    key={`new-note-${newNoteKey}`}
                    patient={patient}
                    setPatient={setPatient}
                    selectedDate={selectedDate}
                    refreshSidebar={refreshSidebar}
                    setIsModified={setIsModified}
                    onResetLetter={onResetLetter}
                    onOpenNewNoteModal={onOpenNewNoteModal}
                />
            }
        />
        <Route
            path="/note/:id"
            element={
                <PatientDetails
                    patient={patient}
                    setPatient={setPatient}
                    selectedDate={selectedDate}
                    refreshSidebar={refreshSidebar}
                    setIsModified={setIsModified}
                    onOpenNewNoteModal={onOpenNewNoteModal}
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
);

export default AppRoutes;
