import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Avatar,
    Box,
    Button,
    Flex,
    Heading,
    HStack,
    Icon,
    Text,
    VStack,
} from "@chakra-ui/react";
import { LuArrowLeft, LuSearch, LuUserPlus } from "react-icons/lu";
import { toaster } from "@/components/ui/toaster";
import { DEFAULT_TOAST_CONFIG } from "../../utils/constants";
import { formatDate } from "../../utils/helpers/formatHelpers";
import UrSearchField from "./UrSearchField";

export const PathHalf = ({ icon, title, subtitle, onClick }) => {
    return (
        <Flex
            className="entry-path"
            flex="1"
            direction="column"
            align="center"
            justify="center"
            textAlign="center"
            py={10}
            px={4}
            cursor="pointer"
            transition="background-color 160ms ease, border-color 160ms ease, color 160ms ease"
            _hover={{
                backgroundColor: "folio.hover",
                borderColor: "folio.accent",
            }}
            _focusVisible={{
                outline: "2px solid",
                outlineColor: "folio.focus",
                outlineOffset: "2px",
            }}
            asChild
        >
            <button onClick={onClick}>
                <Flex
                    className="path-icon-tile"
                    align="center"
                    justify="center"
                    boxSize="56px"
                    borderRadius="folioPanel"
                    bg="folio.accentSoft"
                    border="1px solid"
                    borderColor="folio.line"
                    mb={4}
                    mx="auto"
                >
                    <Icon as={icon} boxSize={6} color="folio.accent" />
                </Flex>
                <Text fontWeight="600" color="folio.ink" fontSize="md">
                    {title}
                </Text>
                <Text fontSize="xs" color="folio.muted" mt={1}>
                    {subtitle}
                </Text>
            </button>
        </Flex>
    );
};

const candidateMeta = (cand, t) =>
    [cand.gender, cand.dob, cand.ur_number && t("patient.urBadge", { ur: cand.ur_number })]
        .filter(Boolean)
        .join("  ·  ");

export const CandidateRow = ({
    candidate,
    onConfirm,
    confirming = false,
    disabled = false,
}) => {
    const { t } = useTranslation();
    const fallbackName =
        candidate.first_name || candidate.last_name
            ? `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim()
            : undefined;

    return (
        <Flex
            className="entry-candidate-row"
            align="center"
            justify="space-between"
            p={3}
        >
            <HStack gap={3} minW="0">
                <Avatar.Root size="sm" bg="folio.paper" color="folio.ink">
                    <Avatar.Fallback name={fallbackName} />
                </Avatar.Root>
                <Box minW="0">
                    <Text
                        fontWeight="600"
                        color="folio.ink"
                        lineClamp={1}
                    >
                        {candidate.name || t("patient.unnamedPatient")}
                    </Text>
                    <Text
                        fontSize="xs"
                        color="folio.muted"
                        lineClamp={1}
                    >
                        {candidateMeta(candidate, t) ||
                            t("patient.noDemographicsOnFile")}
                    </Text>
                    {candidate.encounter_date && (
                        <Text fontSize="xs" color="folio.muted">
                            {t("patient.lastSeen", {
                                date: formatDate(candidate.encounter_date),
                            })}
                        </Text>
                    )}
                </Box>
            </HStack>
            <Button
                size="sm"
                loading={confirming}
                disabled={disabled}
                variant="folioPrimary"
                onClick={() => onConfirm(candidate)}
            >
                {t("patient.startVisit")}
            </Button>
        </Flex>
    );
};

const NewNoteStartCard = ({ onFind, onNewPatient, onConfirmCandidate, isSearchLoading }) => {
    const { t } = useTranslation();
    const [view, setView] = useState("choose"); // "choose" | "search" | "results"
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [confirmingId, setConfirmingId] = useState(null);

    const handleFind = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const q = (query || "").trim();
        if (!q) {
            toaster.create({
                title: t("patient.enterUrOrName"),
                description: t("patient.enterUrOrNameHint"),
                type: "warning",
                ...DEFAULT_TOAST_CONFIG,
            });
            return;
        }
        const list = await onFind(q);
        if (list && list.length > 0) {
            setResults(list);
            setView("results");
        } else {
            toaster.create({
                title: t("patient.noPatientFound"),
                description: t("patient.noPatientMatch", { query: q }),
                type: "info",
                ...DEFAULT_TOAST_CONFIG,
            });
        }
    };

    const handleConfirm = async (candidate) => {
        const id = candidate.ur_number || candidate.id;
        setConfirmingId(id);
        try {
            await onConfirmCandidate(candidate);
        } finally {
            setConfirmingId(null);
        }
    };

    const subtitle =
        view === "search"
            ? t("patient.searchSubtitle")
            : view === "results"
              ? t("patient.resultsSubtitle")
              : t("patient.chooseSubtitle");

    return (
        <Flex align="center" justify="center" minH="80vh" px={4} py={8}>
            <Box
                className="anim-fade-slide-up new-note-card"
                p={{ base: 6, md: 8 }}
                w={{ base: "100%", sm: "90%", md: "520px" }}
                maxW="520px"
            >
                <Flex
                    direction="column"
                    align="center"
                    mb={6}
                    textAlign="center"
                >
                    <Heading
                        as="h1"
                        size="lg"
                        color="folio.ink"
                    >
                        {t("patient.newEncounter")}
                    </Heading>
                    <Text
                        fontSize="sm"
                        color="folio.muted"
                        mt={2}
                        maxW="400px"
                        lineHeight={1.5}
                    >
                        {subtitle}
                    </Text>
                </Flex>

                <Box key={view} className="anim-fade-slide-up">
                    {view === "choose" ? (
                        <Flex gap={3}>
                            <PathHalf
                                icon={LuUserPlus}
                                title={t("patient.newPatient")}
                                subtitle={t("patient.createNewRecord")}
                                onClick={onNewPatient}
                            />
                            <PathHalf
                                icon={LuSearch}
                                title={t("patient.search")}
                                subtitle={t("patient.existingPatient")}
                                onClick={() => setView("search")}
                            />
                        </Flex>
                    ) : view === "results" ? (
                        <Box>
                            <VStack gap={3} align="stretch">
                                {results.map((cand) => (
                                    <CandidateRow
                                        key={cand.ur_number || cand.id}
                                        candidate={cand}
                                        onConfirm={handleConfirm}
                                        confirming={
                                            confirmingId ===
                                            (cand.ur_number || cand.id)
                                        }
                                        disabled={confirmingId !== null}
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
                                {t("patient.back")}
                            </Button>
                        </Box>
                    ) : (
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
                                        placeholder={t("patient.urOrNamePlaceholder")}
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
                                {t("patient.back")}
                            </Button>
                        </Box>
                    )}
                </Box>
            </Box>
        </Flex>
    );
};

export default NewNoteStartCard;
