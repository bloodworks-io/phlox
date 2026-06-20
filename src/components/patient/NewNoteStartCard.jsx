import { useState } from "react";
import {
    Box,
    Button,
    Flex,
    Heading,
    Icon,
    Text,
    useColorMode,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { FaUserPlus, FaSearch, FaArrowLeft } from "react-icons/fa";
import { colors } from "../../theme/colors";
import UrSearchField from "./UrSearchField";

const MotionBox = motion(Box);

const PathHalf = ({ icon, title, subtitle, accent, c, tileBg, onClick }) => (
    <Flex
        as="button"
        flex="1"
        direction="column"
        align="center"
        justify="center"
        textAlign="center"
        py={10}
        px={4}
        cursor="pointer"
        role="group"
        transition="all 0.2s"
        bg={tileBg}
        borderRadius="xl"
        _hover={{ bg: "rgba(184, 192, 224, 0.12)" }}
        onClick={onClick}
    >
        <Icon
            as={icon}
            boxSize={12}
            color={accent}
            mb={4}
            transition="transform 0.2s"
            _groupHover={{ transform: "scale(1.12)" }}
        />
        <Text fontWeight="600" color={c.textPrimary} fontSize="md">
            {title}
        </Text>
        <Text fontSize="xs" color={c.textSecondary} mt={1}>
            {subtitle}
        </Text>
    </Flex>
);

const NewNoteStartCard = ({ onFind, onNewPatient, isSearchLoading }) => {
    const { colorMode } = useColorMode();
    const c = colors[colorMode];
    const tileBg = colorMode === "light" ? c.base : c.crust;
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
            <MotionBox
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="panels-bg"
                sx={{ borderRadius: "2xl !important" }}
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
                        color={c.textPrimary}
                        sx={{ fontFamily: '"Space Grotesk", sans-serif' }}
                    >
                        New encounter
                    </Heading>
                    <Text
                        fontSize="sm"
                        color={c.textSecondary}
                        mt={2}
                        maxW="400px"
                        lineHeight={1.5}
                    >
                        {subtitle}
                    </Text>
                </Flex>

                <MotionBox
                    key={view}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {view === "choose" ? (
                        <Flex gap={3}>
                            <PathHalf
                                icon={FaUserPlus}
                                title="New patient"
                                subtitle="Create a new record"
                                accent={c.primaryButton}
                                c={c}
                                tileBg={tileBg}
                                onClick={onNewPatient}
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
                    ) : (
                        <Box>
                            <Flex
                                as="form"
                                onSubmit={handleFind}
                                alignItems="center"
                            >
                                <UrSearchField
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
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
                                    fontFamily: '"Space Grotesk", sans-serif',
                                    fontWeight: "600",
                                }}
                                onClick={() => setView("choose")}
                            >
                                Back
                            </Button>
                        </Box>
                    )}
                </MotionBox>
            </MotionBox>
        </Flex>
    );
};

export default NewNoteStartCard;
