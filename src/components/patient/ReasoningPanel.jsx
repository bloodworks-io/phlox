import React, { useState, useRef, useEffect, forwardRef } from "react";
import {
  Box,
  Flex,
  Text,
  Button,
  Spinner,
  VStack,
  HStack,
  Wrap,
  WrapItem,
  useToast,
  useColorMode,
} from "@chakra-ui/react";
import { FaAtom } from "react-icons/fa";
import { FaSync } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import styled from "@emotion/styled";

import { colors } from "../../theme/colors";
import { patientApi } from "../../utils/api/patientApi";
import { emergeFromButton } from "../../theme/animations";

const AnimatedBox = styled(Box)`
  animation: ${emergeFromButton} 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)
    forwards;
  transform-origin: bottom right;
`;

const ReasoningPanel = forwardRef(
  ({ isOpen, onClose, patientId, initialReasoning }, ref) => {
    const [loading, setLoading] = useState(false);
    const [reasoning, setReasoning] = useState(initialReasoning);
    const [activeSection, setActiveSection] = useState("summary");
    const [dimensions, setDimensions] = useState({
      width: 500,
      height: 420,
    });
    const resizerRef = useRef(null);
    const toast = useToast();
    const { colorMode } = useColorMode();

    // Update reasoning when initialReasoning changes
    useEffect(() => {
      setReasoning(initialReasoning);
    }, [patientId, initialReasoning]);

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

    // Resize functionality
    const handleMouseDown = (e) => {
      e.preventDefault();
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    };

    const handleMouseMove = (e) => {
      setDimensions((prev) => ({
        width: Math.max(
          350,
          prev.width -
            (e.clientX - resizerRef.current.getBoundingClientRect().left),
        ),
        height: Math.max(
          300,
          prev.height -
            (e.clientY - resizerRef.current.getBoundingClientRect().top),
        ),
      }));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    if (!isOpen) {
      return null;
    }

    const sections = [
      "summary",
      "differentials",
      "investigations",
      "considerations",
      "thinking",
    ];

    return (
      <AnimatedBox position="fixed" bottom="20px" right="75px" zIndex="1000">
        <Box
          width={`${dimensions.width}px`}
          height={`${dimensions.height}px`}
          borderRadius="xl"
          boxShadow="md"
          overflow="hidden"
          position="relative"
          className="floating-panel"
          bg={colorMode === "light" ? "white" : colors.dark.surface}
        >
          <Box
            borderRadius="xl"
            display="flex"
            flexDirection="column"
            height="100%"
          >
            {/* Header */}
            <Flex
              align="center"
              justify="space-between"
              p="3"
              className="panel-header"
              flexShrink={0}
            >
              <Flex align="center">
                <FaAtom size="1em" style={{ marginRight: "8px" }} />
                <Text fontWeight="bold">Clinical Reasoning</Text>
              </Flex>
            </Flex>

            {/* Content */}
            <Box
              flex="1"
              overflow="hidden"
              display="flex"
              flexDirection="column"
            >
              {reasoning ? (
                <>
                  {/* Navigation Pills */}
                  <HStack
                    spacing={1}
                    px={3}
                    pb={2}
                    flexWrap="wrap"
                    flexShrink={0}
                  >
                    {sections.map((section) => (
                      <Button
                        key={section}
                        className={`reason-button ${
                          activeSection === section
                            ? "reason-button-active"
                            : ""
                        }`}
                        onClick={() => setActiveSection(section)}
                        height="26px"
                        fontSize="xs"
                        px={2}
                      >
                        {section.charAt(0).toUpperCase() + section.slice(1)}
                      </Button>
                    ))}
                    <Button
                      leftIcon={<FaSync size="10px" />}
                      onClick={handleGenerateReasoning}
                      isLoading={loading}
                      size="xs"
                      className="orange-button"
                      ml={2}
                    >
                      Regenerate
                    </Button>
                  </HStack>

                  {/* Content Area */}
                  <Box
                    overflowY="auto"
                    className="scroll-container"
                    p={3}
                    mx={3}
                    mb={3}
                    bg={
                      colorMode === "light"
                        ? colors.light.crust
                        : colors.dark.base
                    }
                    borderRadius="lg"
                    flex="1"
                  >
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeSection}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                      >
                        {activeSection === "summary" && (
                          <Text fontSize="sm">{reasoning.summary}</Text>
                        )}
                        {activeSection === "thinking" && (
                          <Text fontSize="sm" whiteSpace="pre-wrap">
                            {reasoning.thinking}
                          </Text>
                        )}
                        {(activeSection === "differentials" ||
                          activeSection === "investigations" ||
                          activeSection === "considerations") && (
                          <Wrap spacing={2}>
                            {reasoning[getReasoningKey(activeSection)] &&
                              reasoning[getReasoningKey(activeSection)].map(
                                (item, i) => (
                                  <WrapItem key={i}>
                                    <Box
                                      px={2}
                                      py={1}
                                      borderRadius="sm"
                                      fontSize="xs"
                                      {...getTagColorScheme(activeSection)}
                                    >
                                      {item}
                                    </Box>
                                  </WrapItem>
                                ),
                              )}
                          </Wrap>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </Box>
                </>
              ) : (
                <VStack spacing={3} p={4} flex="1" justify="center">
                  <Text textAlign="center" fontSize="sm" color="gray.500">
                    Generate an analysis of the case using your model's
                    reasoning capabilities.
                  </Text>
                  <Button
                    leftIcon={<FaAtom />}
                    onClick={handleGenerateReasoning}
                    isLoading={loading}
                    loadingText="Generating"
                    size="sm"
                    className="green-button"
                  >
                    Generate Clinical Reasoning
                  </Button>
                </VStack>
              )}
            </Box>
          </Box>

          {/* Resizer */}
          <Box
            ref={resizerRef}
            position="absolute"
            top="0"
            left="0"
            width="20px"
            height="20px"
            bg="transparent"
            cursor="nwse-resize"
            onMouseDown={handleMouseDown}
          />

          {/* Loading overlay */}
          {loading && reasoning && (
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
              borderRadius="xl"
            >
              <Spinner size="lg" />
            </Flex>
          )}
        </Box>
      </AnimatedBox>
    );
  },
);

export default ReasoningPanel;
