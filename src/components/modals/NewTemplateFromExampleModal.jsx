import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  HStack,
  Textarea,
  Box,
  Text,
  VStack,
  useColorMode,
} from "@chakra-ui/react";
import { colors } from "../../theme/colors";

const NewTemplateFromExampleModal = ({
  isOpen,
  onClose,
  onCreate,
  exampleNote,
  setExampleNote,
  isLoading,
}) => {
  const { colorMode } = useColorMode();
  const currentColors = colors[colorMode];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent className="modal-style">
        <ModalHeader>New Template from Example</ModalHeader>
        <ModalCloseButton />
        <ModalBody maxH="50vh" overflowY="auto" className="custom-scrollbar">
          <VStack spacing={4} align="stretch">
            {/* Info box */}
            <Box
              bg={colorMode === "light" ? "blue.50" : "blue.900"}
              borderLeft="4px solid"
              borderColor="blue.400"
              p={4}
              borderRadius="md"
            >
              <VStack align="start" spacing={2}>
                <Text
                  color={currentColors.textPrimary}
                  fontWeight="600"
                  fontSize="sm"
                >
                  📋 Create a Template from an Existing Note
                </Text>
                <Text color={currentColors.textSecondary} fontSize="sm">
                  Paste an example clinical note below. The AI will analyze its
                  structure and automatically create a template with matching
                  fields.
                </Text>
              </VStack>
            </Box>

            {/* Tips */}
            <Box px={2}>
              <Text
                color={currentColors.textPrimary}
                fontSize="xs"
                fontWeight="600"
                mb={2}
              >
                TIPS FOR BEST RESULTS:
              </Text>
              <VStack align="start" spacing={1} pl={2}>
                <Text color={currentColors.textSecondary} fontSize="sm">
                  • Use a complete, well-formatted note as your example
                </Text>
                <Text color={currentColors.textSecondary} fontSize="sm">
                  • Include typical sections like Subjective, Objective,
                  Assessment, Plan
                </Text>
                <Text color={currentColors.textSecondary} fontSize="sm">
                  • The AI will identify field names and their relationships
                </Text>
              </VStack>
            </Box>

            {/* Textarea */}
            <Textarea
              placeholder={`Paste your example note here...

Example:
Subjective: Patient presents with...
Objective: Vitals normal, physical exam reveals...
Assessment: Likely diagnosis of...
Plan: 1. Prescribe medication 2. Follow up in 2 weeks`}
              value={exampleNote}
              onChange={(e) => setExampleNote(e.target.value)}
              className="input-style"
              minH="200px"
              resize="vertical"
            />
          </VStack>
        </ModalBody>
        <ModalFooter>
          <HStack justify="flex-end" width="100%">
            <Button
              onClick={onClose}
              size="md"
              borderRadius="2xl !important"
              className="switch-mode"
              sx={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: "600",
              }}
              mr={3}
            >
              Cancel
            </Button>
            <Button
              onClick={onCreate}
              isLoading={isLoading}
              loadingText="Creating..."
              size="md"
              borderRadius="2xl !important"
              className="switch-mode"
              sx={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: "600",
              }}
            >
              Create Template
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default NewTemplateFromExampleModal;
