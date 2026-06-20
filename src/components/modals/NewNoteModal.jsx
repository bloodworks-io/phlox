import { useEffect, useState } from "react";
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalCloseButton,
    Box,
    Flex,
    Heading,
    Text,
    Button,
    useColorMode,
    useToast,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { FaUserPlus, FaSearch, FaArrowLeft } from "react-icons/fa";
import { colors } from "../../theme/colors";
import { DEFAULT_TOAST_CONFIG } from "../../utils/constants";
import { PathHalf } from "../patient/NewNoteStartCard";
import UrSearchField from "../patient/UrSearchField";
import DemographicsForm from "../patient/DemographicsForm";

const MotionBox = motion(Box);

const NewNoteModal = ({
    isOpen,
    onClose,
    patient,
    setPatient,
    createNewPatient,
    searchPatient,
    selectedDate,
    onComplete,
}) => {
    const { colorMode } = useColorMode();
    const c = colors[colorMode];
    const tileBg = colorMode === "light" ? c.base : c.crust;
    const toast = useToast();

    const [view, setView] = useState("choose");
    const [query, setQuery] = useState("");
    const [isSearchLoading, setIsSearchLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Reset to the chooser whenever the modal is reopened.
    useEffect(() => {
        if (isOpen) {
            setView("choose");
            setQuery("");
        }
    }, [isOpen]);

    const handleFind = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const ur = (query || "").trim();
        if (!ur) {
            toast({
                title: "Enter a UR number",
                description:
                    "Type a UR number, then click search to find an existing patient.",
                status: "warning",
                ...DEFAULT_TOAST_CONFIG,
            });
            return;
        }
        setIsSearchLoading(true);
        searchPatient(ur, selectedDate)
            .then((result) => {
                if (result) {
                    // searchPatient already toasts "Patient Found" — don't double-toast.
                    onComplete({ cameFromSearch: true });
                } else {
                    toast({
                        title: "No patient found",
                        description: `No patient matches UR number "${ur}". Fill in their details to create a new record.`,
                        status: "info",
                        ...DEFAULT_TOAST_CONFIG,
                    });
                }
            })
            .catch(() => {
                /* searchPatient surfaces its own error toast */
            })
            .finally(() => setIsSearchLoading(false));
    };

    const handleNewPatient = async () => {
        // Initialise the empty patient + default template, then show the form.
        setIsCreating(true);
        try {
            await createNewPatient();
            setView("new-patient");
        } finally {
            setIsCreating(false);
        }
    };

    const subtitle =
        view === "search"
            ? "Enter a UR number to start a new visit for an existing patient."
            : view === "new-patient"
              ? "Enter the patient's details to create a new record."
              : "Find an existing patient to start a new visit, or create a new patient record.";

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
            <ModalOverlay />
            <ModalContent className="modal-style">
                <ModalHeader>
                    <Heading
                        as="h2"
                        size="md"
                        color={c.textPrimary}
                        sx={{ fontFamily: '"Space Grotesk", sans-serif' }}
                    >
                        New encounter
                    </Heading>
                </ModalHeader>
                <ModalCloseButton />
                <ModalBody
                    maxH="70vh"
                    overflowY="auto"
                    className="custom-scrollbar"
                >
                    <Text
                        fontSize="sm"
                        color={c.textSecondary}
                        mb={4}
                        lineHeight={1.5}
                    >
                        {subtitle}
                    </Text>

                    <MotionBox
                        key={view}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        {view === "choose" ? (
                            <Flex gap={3} mb={2}>
                                <PathHalf
                                    icon={FaUserPlus}
                                    title="New patient"
                                    subtitle="Create a new record"
                                    accent={c.primaryButton}
                                    c={c}
                                    tileBg={tileBg}
                                    onClick={handleNewPatient}
                                />
                                <PathHalf
                                    icon={FaSearch}
                                    title="Search"
                                    subtitle="Existing patient"
                                    accent={c.secondaryButton}
                                    c={c}
                                    tileBg={tileBg}
                                    onClick={() => setView("search")}
                                />
                            </Flex>
                        ) : view === "search" ? (
                            <Box>
                                <Flex
                                    as="form"
                                    onSubmit={handleFind}
                                    alignItems="center"
                                >
                                    <UrSearchField
                                        value={query}
                                        onChange={(e) =>
                                            setQuery(e.target.value)
                                        }
                                        onSearch={handleFind}
                                        isLoading={isSearchLoading}
                                        autoFocus
                                    />
                                </Flex>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="md"
                                    mt={3}
                                    borderRadius="2xl !important"
                                    leftIcon={<FaArrowLeft />}
                                    className="switch-mode"
                                    sx={{
                                        fontFamily:
                                            '"Space Grotesk", sans-serif',
                                        fontWeight: "600",
                                    }}
                                    onClick={() => setView("choose")}
                                >
                                    Back
                                </Button>
                            </Box>
                        ) : (
                            <DemographicsForm
                                patient={patient}
                                setPatient={setPatient}
                                onSaved={() =>
                                    onComplete({ cameFromSearch: false })
                                }
                                onCancel={() => setView("choose")}
                                cancelLabel="Back"
                                cancelIcon={<FaArrowLeft />}
                            />
                        )}
                    </MotionBox>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};

export default NewNoteModal;
