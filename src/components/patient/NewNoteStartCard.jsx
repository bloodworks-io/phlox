import { useState } from "react";
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
import { FaUserPlus, FaSearch, FaArrowLeft } from "react-icons/fa";
import { toaster } from "@/components/ui/toaster";
import { useColorMode } from "../ui/color-mode";
import { colors } from "../../theme/colors";
import { DEFAULT_TOAST_CONFIG } from "../../utils/constants";
import { formatDate } from "../../utils/helpers/formatHelpers";
import UrSearchField from "./UrSearchField";

export const PathHalf = ({
    icon,
    title,
    subtitle,
    accent,
    tileBg,
    onClick,
}) => {
    const { colorMode } = useColorMode();
    const accentHex = colors[colorMode]?.[accent] ?? colors.dark.primaryButton;

    return (
        <Flex
            flex="1"
            direction="column"
            align="center"
            justify="center"
            textAlign="center"
            py={10}
            px={4}
            cursor="pointer"
            transition="transform 0.15s ease, background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease"
            bg={tileBg}
            borderRadius="xl"
            border="1px solid"
            borderColor="surface"
            _hover={{
                bg: "rgba(184, 192, 224, 0.12)",
                borderColor: `${accentHex}66`,
                transform: "translateY(-2px)",
                boxShadow: "md",
                "& .path-icon-tile": { transform: "scale(1.08)" },
            }}
            _active={{ transform: "scale(0.98)" }}
            _focusVisible={{ outline: "2px solid", outlineColor: "accent", outlineOffset: "2px" }}
            asChild
        >
            <button onClick={onClick}>
                <Flex
                    className="path-icon-tile"
                    align="center"
                    justify="center"
                    boxSize="56px"
                    borderRadius="xl"
                    bg={`${accentHex}1f`}
                    border="1px solid"
                    borderColor={`${accentHex}40`}
                    mb={4}
                    mx="auto"
                    transition="transform 0.2s"
                >
                    <Icon as={icon} boxSize={6} color={accent} />
                </Flex>
                <Text fontWeight="600" color="textPrimary" fontSize="md">
                    {title}
                </Text>
                <Text fontSize="xs" color="textSecondary" mt={1}>
                    {subtitle}
                </Text>
            </button>
        </Flex>
    );
};

const candidateMeta = (cand) =>
    [cand.gender, cand.dob, cand.ur_number && `UR ${cand.ur_number}`]
        .filter(Boolean)
        .join("  ·  ");

const startBtnSx = {
    fontFamily: '"Space Grotesk", sans-serif',
    fontWeight: "600",
};

export const CandidateRow = ({
    candidate,
    onConfirm,
    confirming = false,
    disabled = false,
}) => {
    const fallbackName =
        candidate.first_name || candidate.last_name
            ? `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim()
            : undefined;

    return (
        <Flex
            align="center"
            justify="space-between"
            p={3}
            borderRadius="lg"
            bg="tile"
        >
            <HStack gap={3} minW="0">
                <Avatar.Root size="sm" bg="surface" color="textPrimary">
                    <Avatar.Fallback name={fallbackName} />
                </Avatar.Root>
                <Box minW="0">
                    <Text
                        fontWeight="600"
                        color="textPrimary"
                        lineClamp={1}
                    >
                        {candidate.name || "Unnamed patient"}
                    </Text>
                    <Text
                        fontSize="xs"
                        color="textSecondary"
                        lineClamp={1}
                    >
                        {candidateMeta(candidate) ||
                            "No demographics on file"}
                    </Text>
                    {candidate.encounter_date && (
                        <Text fontSize="xs" color="textSecondary">
                            Last seen {formatDate(candidate.encounter_date)}
                        </Text>
                    )}
                </Box>
            </HStack>
            <Button
                size="sm"
                loading={confirming}
                disabled={disabled}
                className="green-button"
                css={startBtnSx}
                onClick={() => onConfirm(candidate)}
            >
                Start visit
            </Button>
        </Flex>
    );
};

const NewNoteStartCard = ({ onFind, onNewPatient, onConfirmCandidate, isSearchLoading }) => {
    const [view, setView] = useState("choose"); // "choose" | "search" | "results"
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [confirmingId, setConfirmingId] = useState(null);

    const handleFind = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const q = (query || "").trim();
        if (!q) {
            toaster.create({
                title: "Enter a UR number or name",
                description:
                    "Type a UR number or patient name, then click search.",
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
                title: "No patient found",
                description: `No patient matches "${q}". Fill in their details to create a new record.`,
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
            ? "Enter a UR number or name to find an existing patient."
            : view === "results"
              ? "Confirm the patient to start a new visit."
              : "Find an existing patient to start a new visit, or create a new patient record.";

    return (
        <Flex align="center" justify="center" minH="80vh" px={4} py={8}>
            <Box
                className="anim-fade-slide-up panels-bg"
                css={{
                    borderRadius: "2xl !important",
                }}
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
                        color="textPrimary"
                        css={{
                            fontFamily: '"Space Grotesk", sans-serif',
                        }}
                    >
                        New encounter
                    </Heading>
                    <Text
                        fontSize="sm"
                        color="textSecondary"
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
                                icon={FaUserPlus}
                                title="New patient"
                                subtitle="Create a new record"
                                accent="primaryButton"
                                tileBg="tile"
                                onClick={onNewPatient}
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
                                variant="outline"
                                size="md"
                                mt={3}
                                borderRadius="2xl"
                                className="switch-mode"
                                css={startBtnSx}
                                onClick={() => setView("search")}
                            >
                                <FaArrowLeft />
                                Back
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
                                css={startBtnSx}
                                onClick={() => setView("choose")}
                            >
                                <FaArrowLeft />
                                Back
                            </Button>
                        </Box>
                    )}
                </Box>
            </Box>
        </Flex>
    );
};

export default NewNoteStartCard;
