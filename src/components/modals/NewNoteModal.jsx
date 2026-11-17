import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Box,
    Flex,
    VStack,
    Heading,
    Text,
    Button,
    Dialog,
    Portal,
} from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { LuArrowLeft, LuSearch, LuUserPlus } from "react-icons/lu";
import { DEFAULT_TOAST_CONFIG } from "../../utils/constants";
import { CandidateRow, PathHalf } from "../patient/NewNoteStartCard";
import UrSearchField from "../patient/UrSearchField";
import DemographicsForm from "../patient/DemographicsForm";

const NewNoteModal = ({
    isOpen,
    onClose,
    setPatient,
    createNewPatient,
    findPatients,
    loadSelectedPatient,
    selectedDate,
    onComplete,
}) => {
    const { t } = useTranslation();

    const [view, setView] = useState("choose");
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [isSearchLoading, setIsSearchLoading] = useState(false);
    const [confirmingId, setConfirmingId] = useState(null);
    const [draftPatient, setDraftPatient] = useState({});

    const handleFind = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const q = (query || "").trim();
        if (!q) {
            toaster.create({
                title: t("modal.newNote.searchPromptTitle"),
                description: t("modal.newNote.searchPromptDescription"),
                type: "warning",
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
                    toaster.create({
                        title: t("modal.newNote.noPatientTitle"),
                        description: t("modal.newNote.noPatientDescription", { query: q }),
                        type: "info",
                        ...DEFAULT_TOAST_CONFIG,
                    });
                }
            })
            .catch(() => {
                toaster.create({
                    title: t("modal.newNote.searchFailedTitle"),
                    description: t("modal.newNote.searchFailedDescription"),
                    type: "error",
                    duration: 3000,
                });
            })
            .finally(() => setIsSearchLoading(false));
    };

    const handleConfirm = (candidate) => {
        setConfirmingId(candidate.ur_number || candidate.id);
        loadSelectedPatient(candidate, selectedDate)
            .then(() => onComplete({ cameFromSearch: true }))
            .catch(() => {
                toaster.create({
                    title: t("modal.newNote.loadFailedTitle"),
                    description: t("modal.newNote.pleaseTryAgain"),
                    type: "error",
                    duration: 3000,
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
                toaster.create({
                    title: t("modal.newNote.newPatientFailedTitle"),
                    description: t("modal.newNote.pleaseTryAgain"),
                    type: "error",
                    duration: 3000,
                });
            });
    };

    const subtitle =
        view === "search"
            ? t("modal.newNote.subtitleSearch")
            : view === "results"
              ? t("modal.newNote.subtitleResults")
              : view === "new-patient"
                ? t("modal.newNote.subtitleNewPatient")
                : t("modal.newNote.subtitleChoose");

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
                                color="folio.ink"
                            >
                                {t("modal.newNote.title")}
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
                                color="folio.muted"
                                mb={4}
                                lineHeight={1.5}
                            >
                                {subtitle}
                            </Text>

                            <Box
                                key={view}
                                className="anim-fade-slide-up"
                                css={{ animationDuration: "0.25s" }}
                            >
                                {view === "choose" ? (
                                    <Flex gap={3} mb={2}>
                                        <PathHalf
                                            icon={LuUserPlus}
                                            title={t("modal.newNote.newPatient")}
                                            subtitle={t("modal.newNote.createRecord")}
                                            onClick={handleNewPatient}
                                        />
                                        <PathHalf
                                            icon={LuSearch}
                                            title={t("modal.newNote.search")}
                                            subtitle={t("modal.newNote.existingPatient")}
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
                                                    placeholder={t("modal.newNote.urPlaceholder")}
                                                />
                                            </form>
                                        </Flex>
                                        <Button
                                            type="button"
                                            variant="folioSecondary"
                                            size="md"
                                            mt={3}
                                            onClick={() => setView("choose")}
                                        >
                                            <LuArrowLeft strokeWidth={1.6} />
                                            {t("action.back")}
                                        </Button>
                                    </Box>
                                ) : view === "results" ? (
                                    <Box>
                                        <VStack gap={3} align="stretch" className="anim-stagger">
                                            {results.map((cand) => (
                                                <CandidateRow
                                                    key={
                                                        cand.ur_number ||
                                                        cand.id
                                                    }
                                                    candidate={cand}
                                                    onConfirm={handleConfirm}
                                                    confirming={
                                                        confirmingId ===
                                                        (cand.ur_number ||
                                                            cand.id)
                                                    }
                                                    disabled={
                                                        confirmingId !== null
                                                    }
                                                />
                                            ))}
                                        </VStack>
                                        <Button
                                            type="button"
                                            variant="folioSecondary"
                                            size="md"
                                            mt={3}
                                            onClick={() => setView("search")}
                                        >
                                            <LuArrowLeft strokeWidth={1.6} />
                                            {t("action.back")}
                                        </Button>
                                    </Box>
                                ) : (
                                    <DemographicsForm
                                        key={draftPatient?.id || "empty"}
                                        patient={draftPatient}
                                        setPatient={setDraftPatient}
                                        onSaved={commitNewPatient}
                                        onCancel={() => setView("choose")}
                                        cancelLabel={t("action.back")}
                                        cancelIcon={<LuArrowLeft strokeWidth={1.6} />}
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
