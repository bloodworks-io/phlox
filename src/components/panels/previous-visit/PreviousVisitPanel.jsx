import { useState, useRef } from "react";
import {
  Box,
  Flex,
  Text,
  Tabs,
  TabList,
  TabPanels,
  TabPanel,
  Tab,
  HStack,
  VStack,
  Tooltip,
} from "@chakra-ui/react";
import { FaClock, FaFileAlt, FaList } from "react-icons/fa";
import FloatingPanel from "../../common/FloatingPanel";

const PreviousVisitPanel = ({
  isOpen,
  onClose,
  previousVisitSummary,
  previousVisitTemplateData,
  previousVisitTemplateKey,
  previousVisitEncounterDate,
  templates = [],
}) => {
  const [tabIndex, setTabIndex] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 550, height: 450 });
  const resizerRef = useRef(null);

  const handleMouseDown = (e) => {
    e.preventDefault();
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e) => {
    setDimensions((prev) => ({
      width: Math.max(
        400,
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

  // Look up the template for the previous visit
  // First try exact match, then fall back to base template match (e.g., phlox_01 -> phlox_02)
  const previousVisitTemplate = templates?.find(
    (t) => t.template_key === previousVisitTemplateKey
  ) || templates?.find(
    (t) => t.template_key.startsWith(previousVisitTemplateKey?.split('_')[0] + '_')
  );

  // Render a single field from the previous visit note (read-only)
  const renderFieldReadOnly = (field) => {
    const content = previousVisitTemplateData?.[field.field_key];
    if (!content?.trim()) return null; // Skip empty fields

    return (
      <Box key={field.field_key} className="cohesive-field">
        <Text className="cohesive-field-label">
          {field.field_name}:
        </Text>
        <Text fontSize="sm" lineHeight="1.6" whiteSpace="pre-wrap">
          {content}
        </Text>
      </Box>
    );
  };

  return (
    <FloatingPanel
      isOpen={isOpen}
      position="left-of-fab"
      showArrow={true}
      triggerId="fab-previous-visit"
      width={`${dimensions.width}px`}
      height={`${dimensions.height - 24}px`}
    >
      <Box
        width={`${dimensions.width}px`}
        height={`${dimensions.height - 24}px`}
        overflow="hidden"
        display="flex"
        flexDirection="column"
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
            <FaClock size="1em" style={{ marginRight: "8px" }} />
            <Text fontWeight="bold">Previous Visit</Text>
          </Flex>
        </Flex>

        {/* Content with Tabs */}
        <Box flex="1" overflow="hidden" display="flex" flexDirection="column">
          <Tabs
            variant="enclosed"
            index={tabIndex}
            onChange={(index) => setTabIndex(index)}
            display="flex"
            flexDirection="column"
            height="100%"
          >
            <TabList flexShrink={0}>
              <Tooltip label="AI-generated summary of the previous visit">
                <Tab className="tab-style">
                  <HStack>
                    <FaList />
                    <Text>Summary</Text>
                  </HStack>
                </Tab>
              </Tooltip>
              <Tooltip label="Full note content from the previous encounter">
                <Tab className="tab-style">
                  <HStack>
                    <FaFileAlt />
                    <Text>Full Note</Text>
                  </HStack>
                </Tab>
              </Tooltip>
            </TabList>

            <TabPanels flex="1" overflow="hidden" display="flex" width="100%">
              {/* Summary Tab */}
              <TabPanel
                className="floating-main"
                p={0}
                width="100%"
                height="100%"
                display="flex"
                overflow="hidden"
              >
                <Box
                  width="100%"
                  height="100%"
                  overflowY="auto"
                  p={4}
                >
                  {previousVisitSummary ? (
                    <Text whiteSpace="pre-wrap" fontSize="sm">
                      {previousVisitSummary}
                    </Text>
                  ) : (
                    <Text color="gray.500" textAlign="center" py={4}>
                      No previous visit summary available.
                    </Text>
                  )}
                </Box>
              </TabPanel>

              {/* Full Note Tab */}
              <TabPanel
                className="floating-main"
                p={0}
                width="100%"
                height="100%"
                display="flex"
                overflow="hidden"
              >
                <Box
                  width="100%"
                  height="100%"
                  overflowY="auto"
                  p={4}
                >
                  {previousVisitTemplate && previousVisitTemplateData ? (
                    <VStack spacing={4} align="stretch" width="100%">
                      {/* Encounter Date */}
                      {previousVisitEncounterDate && (
                        <Box p="2" width="100%">
                          <Text fontSize="xs" color="gray.500" fontWeight="bold">
                            ENCOUNTER DATE
                          </Text>
                          <Text fontSize="sm">{previousVisitEncounterDate}</Text>
                        </Box>
                      )}

                      {/* Template Fields */}
                      <VStack spacing="0" align="stretch" width="100%">
                        {previousVisitTemplate.fields?.map(renderFieldReadOnly)}
                      </VStack>
                    </VStack>
                  ) : (
                    <Text color="gray.500" textAlign="center" py={4}>
                      No previous visit note content available.
                    </Text>
                  )}
                </Box>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>

        {/* Resize Handle */}
        <Box
          ref={resizerRef}
          position="absolute"
          top="0"
          left="0"
          width="15px"
          height="15px"
          cursor="nwse-resize"
          onMouseDown={handleMouseDown}
          zIndex={1}
        />
      </Box>
    </FloatingPanel>
  );
};

export default PreviousVisitPanel;
