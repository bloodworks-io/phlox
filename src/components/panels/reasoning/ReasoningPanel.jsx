import React, { useState, useRef, useEffect, forwardRef } from "react";
import {
  Box,
  Flex,
  Text,
  Button,
  Spinner,
  VStack,
  HStack,
  useToast,
  useColorMode,
  Badge,
  Tabs,
  TabList,
  TabPanels,
  TabPanel,
  Tab,
  Tooltip,
} from "@chakra-ui/react";
import { FaAtom, FaSync } from "react-icons/fa";

import { colors } from "../../../theme/colors";
import { patientApi } from "../../../utils/api/patientApi";
import FloatingPanel from "../../common/FloatingPanel";

const ReasoningPanel = forwardRef(
  (
    { isOpen, onClose, patientId, initialReasoning, onReasoningGenerated },
    ref,
  ) => {
    const [loading, setLoading] = useState(false);
    const [reasoning, setReasoning] = useState(initialReasoning);
    const [tabIndex, setTabIndex] = useState(0);
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
        if (onReasoningGenerated) {
          onReasoningGenerated(res);
        }
      } catch (error) {
        console.error("Error generating reasoning:", error);
      } finally {
        setLoading(false);
      }
    };

    // Map tab index to the actual key in reasoning object
    const getReasoningKey = (section) => {
      if (section === "considerations") {
        return "clinical_considerations";
      }
      return section;
    };

    // Get border accent color for structured items
    const getAccentColor = (section) => {
      switch (section) {
        case "differentials":
          return colors.light.primaryButton;
        case "investigations":
          return colors.light.successButton;
        case "considerations":
          return colors.light.secondaryButton;
        default:
          return colors.light.neutralButton;
      }
    };

    // Check if item is in legacy format (string) or new format (object)
    const isLegacyFormat = (item) => typeof item === "string";

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

    // Render items for structured sections (differentials, investigations, considerations)
    const renderItems = (section) => {
      const key = getReasoningKey(section);
      const items = reasoning?.[key];

      if (!items || items.length === 0) {
        return (
          <Text fontSize="sm" color="gray.500">
            No items available
          </Text>
        );
      }

      return (
        <VStack align="stretch" spacing={2}>
          {items.map((item, i) => {
            const isCritical = !isLegacyFormat(item) && item.critical === true;
            return (
              <Box
                key={i}
                p={2}
                borderRadius="sm"
                bg={colorMode === "light" ? "white" : colors.dark.surface}
                borderLeft="3px solid"
                borderColor={isCritical ? "red.500" : getAccentColor(section)}
                shadow="sm"
              >
                {isLegacyFormat(item) ? (
                  <Text fontSize="sm">{item}</Text>
                ) : (
                  <>
                    <HStack spacing={2} align="start">
                      <Text fontWeight="medium" fontSize="sm" flex="1">
                        {item.suggestion}
                      </Text>
                      {isCritical && (
                        <Badge
                          colorScheme="red"
                          fontSize="xs"
                          textTransform="uppercase"
                        >
                          Critical
                        </Badge>
                      )}
                    </HStack>
                    {item.rationale && item.rationale.length > 0 && (
                      <VStack align="stretch" spacing={0} mt={1}>
                        {item.rationale.map((point, j) => (
                          <Text
                            key={j}
                            fontSize="xs"
                            color={
                              colorMode === "light" ? "gray.600" : "gray.400"
                            }
                            pl={2}
                          >
                            • {point}
                          </Text>
                        ))}
                      </VStack>
                    )}
                  </>
                )}
              </Box>
            );
          })}
        </VStack>
      );
    };

    return (
      <FloatingPanel
        isOpen={isOpen}
        position="left-of-fab"
        showArrow={true}
        triggerId="fab-reasoning"
        width={`${dimensions.width}px`}
        height={`${dimensions.height}px`}
        zIndex="1060"
      >
        <Box
          borderRadius="lg"
          display="flex"
          flexDirection="column"
          height="100%"
          position="relative"
        >
          {/* Header */}
          <Flex
            align="center"
            justify="space-between"
            p="4"
            className="panel-header"
            flexShrink={0}
          >
            <Flex align="center">
              <FaAtom size="1em" style={{ marginRight: "8px" }} />
              <Text fontWeight="bold">Clinical Reasoning</Text>
            </Flex>
            {reasoning && (
              <Tooltip label="Regenerate reasoning">
                <Button
                  leftIcon={<FaSync size="10px" />}
                  onClick={handleGenerateReasoning}
                  isLoading={loading}
                  size="xs"
                  className="orange-button"
                >
                  Regenerate
                </Button>
              </Tooltip>
            )}
          </Flex>

          {/* Content */}
          <Box flex="1" overflow="hidden" display="flex" flexDirection="column">
            {reasoning ? (
              <Tabs
                variant="enclosed"
                index={tabIndex}
                onChange={(index) => setTabIndex(index)}
                display="flex"
                flexDirection="column"
                height="100%"
              >
                <TabList>
                  <Tab className="tab-style">Summary</Tab>
                  <Tab className="tab-style">Differentials</Tab>
                  <Tab className="tab-style">Investigations</Tab>
                  <Tab className="tab-style">Considerations</Tab>
                  <Tab className="tab-style">Thinking</Tab>
                </TabList>

                <TabPanels flex="1" overflow="hidden">
                  {/* Summary Tab */}
                  <TabPanel
                    className="floating-main"
                    height="100%"
                    overflowY="auto"
                  >
                    <Text fontSize="sm">{reasoning.summary}</Text>
                  </TabPanel>

                  {/* Differentials Tab */}
                  <TabPanel
                    className="floating-main"
                    height="100%"
                    overflowY="auto"
                  >
                    {renderItems("differentials")}
                  </TabPanel>

                  {/* Investigations Tab */}
                  <TabPanel
                    className="floating-main"
                    height="100%"
                    overflowY="auto"
                  >
                    {renderItems("investigations")}
                  </TabPanel>

                  {/* Considerations Tab */}
                  <TabPanel
                    className="floating-main"
                    height="100%"
                    overflowY="auto"
                  >
                    {renderItems("considerations")}
                  </TabPanel>

                  {/* Thinking Tab */}
                  <TabPanel
                    className="floating-main"
                    height="100%"
                    overflowY="auto"
                  >
                    <Text fontSize="sm" whiteSpace="pre-wrap">
                      {reasoning.thinking}
                    </Text>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            ) : (
              <VStack spacing={3} p={4} flex="1" justify="center">
                <Text textAlign="center" fontSize="sm" color="gray.500">
                  Generate an analysis of the case using your model's reasoning
                  capabilities.
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
              top="64px"
              left={0}
              right={0}
              bottom={0}
              justify="center"
              align="center"
              zIndex={2}
              bg={
                colorMode === "light"
                  ? "rgba(255,255,255,0.7)"
                  : "rgba(0,0,0,0.5)"
              }
            >
              <Spinner size="lg" />
            </Flex>
          )}
        </Box>
      </FloatingPanel>
    );
  },
);

export default ReasoningPanel;
