import { Box, Flex, Text } from "@chakra-ui/react";
import { FaClock } from "react-icons/fa";
import FloatingPanel from "../../common/FloatingPanel";

const PreviousVisitPanel = ({ isOpen, onClose, previousVisitSummary }) => {
  return (
    <FloatingPanel
      isOpen={isOpen}
      position="left-of-fab"
      showArrow={true}
      width="90%"
      maxWidth="600px"
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

      {/* Content */}
      <Box p={4} maxH="300px" overflowY="auto">
        {previousVisitSummary ? (
          <Text whiteSpace="pre-wrap" fontSize="sm">
            {previousVisitSummary}
          </Text>
        ) : (
          <Text color="gray.500" textAlign="center" py={4}>
            No previous visit records found.
          </Text>
        )}
      </Box>
    </FloatingPanel>
  );
};

export default PreviousVisitPanel;
