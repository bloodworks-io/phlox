import { useEffect, useState } from "react";
import {
    Box,
    Flex,
    HStack,
    VStack,
    Heading,
    Text,
    Button,
    Avatar,
    Dialog,
    Portal,
} from "@chakra-ui/react";
import { useToast } from "@/utils/useToastShim";
import { FaUserPlus, FaSearch, FaArrowLeft } from "react-icons/fa";
import { DEFAULT_TOAST_CONFIG } from "../../utils/constants";
import { formatDate } from "../../utils/helpers/formatHelpers";
import { PathHalf } from "../patient/NewNoteStartCard";
import UrSearchField from "../patient/UrSearchField";
import DemographicsForm from "../patient/DemographicsForm";

const btnSx = {
    fontFamily: '"Space Grotesk", sans-serif',
    fontWeight: "600",
};

const candidateMeta = (cand) =>
    [cand.gender, cand.dob, cand.ur_number && `UR ${cand.ur_number}`]
        .filter(Boolean)
        .join("  ·  ");

const NewNoteModal = ({
    isOpen,
    onClose,
    _patient,
    setPatient,
    createNewPatient,
    findPatients,
    loadSelectedPatient,
    selectedDate,
    onComplete,
}) => {
    const toast = useToast();

    const [view, setView] = useState("choose");
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [isSearchLoading, setIsSearchLoading] = useState(false);
    const [confirmingId, setConfirmingId] = useState(null);
    const [draftPatient, setDraftPatient] = useState({});

    // Reset to the chooser whenever the modal is reopened.
    useEffect(() => {
        if (isOpen) {
            setView("choose");
            setQuery("");
            setResults([]);
        }
    }, [isOpen]);

    const handleFind = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const q = (query || "").trim();
        if (!q) {
            toast({
                title: "Enter a UR number or name",
                description:
                    "Type a UR number or patient name, then click search.",
                status: "warning",
                ...DEFAULT_TOAST_CONFIG,
            });
            return;
        }
        setIsSearchLoading(true);
        findPatients(q)
            .then((list) => {
                if (list && list.length > 0) {
                    setResults(list);
                    setView("results");
                } else {
                    toast({
                        title: "No patient found",
                        description: `No patient matches "${q}". Fill in their details to create a new record.`,
                        status: "info",
                        ...DEFAULT_TOAST_CONFIG,
                    });
                }
            })
            .catch(() => {
                toast({
                    title: "Search failed",
                    description: "Couldn't search patients. Please try again.",
                    status: "error",
                    duration: 3000,
                    isClosable: true,
                });
            })
            .finally(() => setIsSearchLoading(false));
    };

    const handleConfirm = (candidate) => {
        setConfirmingId(candidate.ur_number || candidate.id);
        loadSelectedPatient(candidate, selectedDate)
            .then(() => onComplete({ cameFromSearch: true }))
            .catch(() => {
                toast({
                    title: "Couldn't load patient",
                    description: "Please try again.",
                    status: "error",
                    duration: 3000,
                    isClosable: true,
                });
            })
            .finally(() => setConfirmingId(null));
    };

    const handleNewPatient = () => {
        setDraftPatient({});
        setView("new-patient");
    };

    const commitNewPatient = (updated) => {
        createNewPatient()
            .then((base) => {
                setPatient({ ...base, ...updated, isNewEncounter: true });
                onComplete({ cameFromSearch: false });
            })
            .catch(() => {
                toast({
                    title: "Couldn't start new patient",
                    description: "Please try again.",
                    status: "error",
                    duration: 3000,
                    isClosable: true,
                });
            });
    };

    const subtitle =
        view === "search"
            ? "Enter a UR number or name to find an existing patient."
            : view === "results"
              ? "Confirm the patient to start a new visit."
              : view === "new-patient"
                ? "Enter the patient's details to create a new record."
                : "Find an existing patient to start a new visit, or create a new patient record.";

    return (
        <Dialog.Root
            open={isOpen}
            size="lg"
            onOpenChange={(e) => {
                if (!e.open) {
                    onClose();
                }
            }}
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content className="modal-style">
                        <Dialog.Header>
                            <Heading
                                as="h3"
                                size="xl"
                                color="textPrimary"
                                css={{
                                    fontFamily: '"Space Grotesk", sans-serif',
                                }}
                            >
                                New encounter
                            </Heading>
                        </Dialog.Header>
                        <Dialog.CloseTrigger />
                        <Dialog.Body
                            maxH="70vh"
                            overflowY="auto"
                            className="custom-scrollbar"
                        >
                            <Text
                                fontSize="sm"
                                color="textSecondary"
                                mb={4}
                                lineHeight={1.5}
                            >
                                {subtitle}
                            </Text>

                            <Box key={view}>
                                {view === "choose" ? (
                                    <Flex gap={3} mb={2}>
                                        <PathHalf
                                            icon={FaUserPlus}
                                            title="New patient"
                                            subtitle="Create a new record"
                                            accent="primaryButton"
                                            tileBg="tile"
                                            onClick={handleNewPatient}
                                        />
                                        <PathHalf
                                            icon={FaSearch}
                                            title="Search"
                                            subtitle="Existing patient"
                                            accent="secondaryButton"
                                            tileBg="tile"
                                            onClick={() => setView("search")}
                                        />
                                    </Flex>
                                ) : view === "search" ? (
                                    <Box>
                                        <Flex alignItems="center" asChild>
                                            <form onSubmit={handleFind}>
                                                <UrSearchField
                                                    value={query}
                                                    onChange={(e) =>
                                                        setQuery(e.target.value)
                                                    }
                                                    onSearch={handleFind}
                                                    isLoading={isSearchLoading}
                                                    autoFocus
                                                    placeholder="UR number or name"
                                                />
                                            </form>
                                        </Flex>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="md"
                                            mt={3}
                                            borderRadius="2xl"
                                            className="switch-mode"
                                            css={btnSx}
                                            onClick={() => setView("choose")}
                                        >
                                            <FaArrowLeft />
                                            Back
                                        </Button>
                                    </Box>
                                ) : view === "results" ? (
                                    <Box>
                                        <VStack gap={3} align="stretch">
                                            {results.map((cand) => (
                                                <Flex
                                                    key={
                                                        cand.ur_number ||
                                                        cand.id
                                                    }
                                                    align="center"
                                                    justify="space-between"
                                                    p={3}
                                                    borderRadius="lg"
                                                    bg="tile"
                                                >
                                                    <HStack gap={3} minW="0">
                                                        <Avatar.Root
                                                            size="sm"
                                                            bg="surface"
                                                            color={
                                                                "textPrimary"
                                                            }
                                                        >
                                                            <Avatar.Fallback
                                                                name={
                                                                    cand.first_name ||
                                                                    cand.last_name
                                                                        ? `${cand.first_name || ""} ${
                                                                              cand.last_name ||
                                                                              ""
                                                                          }`.trim()
                                                                        : undefined
                                                                }
                                                            />
                                                        </Avatar.Root>
                                                        <Box minW="0">
                                                            <Text
                                                                fontWeight="600"
                                                                color={
                                                                    "textPrimary"
                                                                }
                                                                lineClamp={1}
                                                            >
                                                                {cand.name ||
                                                                    "Unnamed patient"}
                                                            </Text>
                                                            <Text
                                                                fontSize="xs"
                                                                color={
                                                                    "textSecondary"
                                                                }
                                                                lineClamp={1}
                                                            >
                                                                {candidateMeta(
                                                                    cand,
                                                                ) ||
                                                                    "No demographics on file"}
                                                            </Text>
                                                            {cand.encounter_date && (
                                                                <Text
                                                                    fontSize="xs"
                                                                    color={
                                                                        "textSecondary"
                                                                    }
                                                                >
                                                                    Last seen{" "}
                                                                    {formatDate(
                                                                        cand.encounter_date,
                                                                    )}
                                                                </Text>
                                                            )}
                                                        </Box>
                                                    </HStack>
                                                    <Button
                                                        size="sm"
                                                        loading={
                                                            confirmingId ===
                                                            (cand.ur_number ||
                                                                cand.id)
                                                        }
                                                        disabled={
                                                            confirmingId !==
                                                            null
                                                        }
                                                        className="green-button"
                                                        css={btnSx}
                                                        onClick={() =>
                                                            handleConfirm(cand)
                                                        }
                                                    >
                                                        Start visit
                                                    </Button>
                                                </Flex>
                                            ))}
                                        </VStack>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="md"
                                            mt={3}
                                            borderRadius="2xl"
                                            className="switch-mode"
                                            css={btnSx}
                                            onClick={() => setView("search")}
                                        >
                                            <FaArrowLeft />
                                            Back
                                        </Button>
                                    </Box>
                                ) : (
                                    <DemographicsForm
                                        patient={draftPatient}
                                        setPatient={setDraftPatient}
                                        onSaved={commitNewPatient}
                                        onCancel={() => setView("choose")}
                                        cancelLabel="Back"
                                        cancelIcon={<FaArrowLeft />}
                                    />
                                )}
                            </Box>
                        </Dialog.Body>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
};

export default NewNoteModal;
