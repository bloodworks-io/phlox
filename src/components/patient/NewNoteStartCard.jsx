import { useState } from "react";
import {
    Box,
    Button,
    Flex,
    Heading,
    Icon,
    Text,
} from "@chakra-ui/react";
import { FaUserPlus, FaSearch, FaArrowLeft } from "react-icons/fa";
import UrSearchField from "./UrSearchField";

export const PathHalf = ({
    icon,
    title,
    subtitle,
    accent,
    tileBg,
    onClick,
}) => (
    <Flex
        flex="1"
        direction="column"
        align="center"
        justify="center"
        textAlign="center"
        py={10}
        px={4}
        cursor="pointer"
        transition="transform 0.1s ease, background 0.15s ease"
        bg={tileBg}
        borderRadius="xl"
        _hover={{
            bg: "rgba(184, 192, 224, 0.12)",
            "& svg": { transform: "scale(1.12)" },
        }}
        _active={{ transform: "scale(0.98)" }}
        _focusVisible={{ outline: "2px solid", outlineColor: "accent", outlineOffset: "2px" }}
        asChild
    >
        <button onClick={onClick}>
            <Icon
                as={icon}
                boxSize={12}
                color={accent}
                mb={4}
                transition="transform 0.2s"
            />
            <Text fontWeight="600" color="textPrimary" fontSize="md">
                {title}
            </Text>
            <Text fontSize="xs" color="textSecondary" mt={1}>
                {subtitle}
            </Text>
        </button>
    </Flex>
);

const NewNoteStartCard = ({ onFind, onNewPatient, isSearchLoading }) => {
    const [view, setView] = useState("choose"); // "choose" | "search"
    const [query, setQuery] = useState("");

    const handleFind = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        onFind(query);
    };

    const subtitle =
        view === "search"
            ? "Enter a UR number to start a new visit for an existing patient."
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
                                css={{
                                    fontFamily: '"Space Grotesk", sans-serif',
                                    fontWeight: "600",
                                }}
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
