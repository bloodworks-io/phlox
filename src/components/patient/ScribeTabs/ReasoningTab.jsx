import {
    Box,
    VStack,
    IconButton,
    Text,
    Button,
    Spinner,
    Flex,
    Grid,
    Wrap,
    WrapItem,
    useToast,
    useColorMode,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { patientApi } from "../../../utils/api/patientApi";
import { FaAtom, FaSync } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { colors } from "../../../theme/colors";
import { GreyButton } from "../../common/Buttons";

const ReasoningTab = ({ patientId, reasoning: initialReasoning }) => {
    const [loading, setLoading] = useState(false);
    const [reasoning, setReasoning] = useState(initialReasoning);
    const [activeSection, setActiveSection] = useState("summary");
    const toast = useToast();
    const { colorMode } = useColorMode();
    const handleGenerateReasoning = async () => {
        setLoading(true);
        try {
            const res = await patientApi.generateReasoning(patientId, toast);
            setReasoning(res);
        } catch (error) {
            console.error("Error generating reasoning:", error);
        } finally {
            setLoading(false);
        }
    };

    // Map active section key from the navigation pill to the actual key in reasoning object
    const getReasoningKey = (section) => {
        if (section === "considerations") {
            return "clinical_considerations";
        }
        return section;
    };

    useEffect(() => {
        setReasoning(initialReasoning);
    }, [patientId, initialReasoning]);

    const getTagColorScheme = (section) => {
        switch (section) {
            case "differentials":
                return {
                    bg: colors.light.primaryButton,
                    color: colors.light.invertedText,
                };
            case "investigations":
                return {
                    bg: colors.light.successButton,
                    color: colors.light.invertedText,
                };
            case "considerations":
                return {
                    bg: colors.light.secondaryButton,
                    color: colors.light.invertedText,
                };
            case "thinking":
                return {
                    bg: colors.light.neutralButton,
                    color: colors.light.invertedText,
                };
            default:
                return {
                    bg: colors.light.surface,
                    color: colors.light.textPrimary,
                };
        }
    };

    return (
        <Box
            p={2}
            minH="180px"
            overflow="hidden"
            position="relative"
            className="tab-panel-container"
        >
            {" "}
            {/* Add position relative */}
            {reasoning ? (
                <>
                    <Grid templateColumns="150px 1fr" gap={0} h="120px">
                        {/* Left Side - Navigation Pills */}
                        <VStack align="flex-start" spacing={0} w="150px">
                            {[
                                "summary",
                                "differentials",
                                "investigations",
                                "considerations",
                                "thinking",
                            ].map((section) => (
                                <Button
                                    key={section}
                                    className={`reason-button ${
                                        activeSection === section
                                            ? "reason-button-active"
                                            : ""
                                    }`}
                                    onClick={() => setActiveSection(section)}
                                    justifyContent="flex-start" // align text left inside the button
                                    width="100%"
                                    height="35px"
                                >
                                    {section.charAt(0).toUpperCase() +
                                        section.slice(1)}
                                </Button>
                            ))}
                        </VStack>

                        {/* Right Side - Content Area */}
                        <Box
                            overflowY="auto"
                            className="scroll-container"
                            p="4"
                            bg={
                                colorMode === "light"
                                    ? colors.light.crust
                                    : colors.dark.base
                            }
                            borderRadius="lg"
                            h="100%"
                        >
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeSection}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {activeSection === "summary" && (
                                        <Text fontSize="md">
                                            {reasoning.summary}
                                        </Text>
                                    )}
                                    {activeSection === "thinking" && (
                                        <Text
                                            fontSize="md"
                                            whiteSpace="pre-wrap" // This preserves newlines
                                        >
                                            {reasoning.thinking}
                                        </Text>
                                    )}
                                    {(activeSection === "differentials" ||
                                        activeSection === "investigations" ||
                                        activeSection === "considerations") && (
                                        <Wrap spacing={2}>
                                            {reasoning[
                                                getReasoningKey(activeSection)
                                            ] &&
                                                reasoning[
                                                    getReasoningKey(
                                                        activeSection,
                                                    )
                                                ].map((item, i) => (
                                                    <WrapItem key={i}>
                                                        <Box
                                                            px={2}
                                                            py={1}
                                                            borderRadius="sm"
                                                            fontSize="sm"
                                                            {...getTagColorScheme(
                                                                activeSection,
                                                            )}
                                                        >
                                                            {item}
                                                        </Box>
                                                    </WrapItem>
                                                ))}
                                        </Wrap>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </Box>
                    </Grid>
                    <IconButton
                        icon={<FaSync size="12px" />}
                        aria-label="Refresh reasoning"
                        w="20px !important"
                        h="20px !important"
                        minW="20px !important"
                        minH="20px !important"
                        position="absolute"
                        right="5"
                        bottom="8"
                        onClick={handleGenerateReasoning}
                        isLoading={loading}
                        className="orange-button"
                        p="0"
                    />
                </>
            ) : (
                <VStack spacing={4} width="full" align="stretch">
                    <Text textAlign="center">
                        Generate an analysis of the case using your model's
                        reasoning capabilities.
                    </Text>
                    <VStack width="full" align="center">
                        <GreyButton
                            leftIcon={<FaAtom />}
                            onClick={handleGenerateReasoning}
                            isLoading={loading}
                            loadingText="Generating"
                        >
                            Generate Clinical Reasoning
                        </GreyButton>
                    </VStack>
                </VStack>
            )}
            {loading && (
                <Flex
                    position="absolute"
                    top={0}
                    left={0}
                    right={0}
                    bottom={0}
                    bg="rgba(0,0,0,0.1)"
                    justify="center"
                    align="center"
                    backdropFilter="blur(2px)"
                >
                    <Spinner size="lg" />
                </Flex>
            )}
        </Box>
    );
};

export default ReasoningTab;
