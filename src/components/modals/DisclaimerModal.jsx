// Modal component to display disclaimer on first visit to landing page per session.
import { useState } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Box,
  Text,
  VStack,
  HStack,
  Icon,
  Checkbox,
  Image,
  useColorMode,
} from "@chakra-ui/react";
import { FaExclamationTriangle } from "react-icons/fa";
import { colors } from "../../theme/colors";

const DisclaimerModal = ({ isOpen, onClose }) => {
  const { colorMode } = useColorMode();
  const currentColors = colors[colorMode];
  const [agreed, setAgreed] = useState(false);

  const handleContinue = () => {
    if (!agreed) return;
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      closeOnOverlayClick={false}
      closeOnEsc={false}
    >
      <ModalOverlay />
      <ModalContent className="modal-style">
        <ModalHeader>
          <HStack>
            <Image src="/logo.webp" alt="Phlox Logo" width="30px" />
            <Text>Important Notice</Text>
          </HStack>
        </ModalHeader>
        <ModalBody maxH="70vh" overflowY="auto" className="custom-scrollbar">
          {/* Warning alert */}
          <Box
            bg="orange.100"
            borderLeft="4px solid"
            borderColor="orange.400"
            p={3}
            borderRadius="md"
            mb={4}
          >
            <HStack align="start">
              <Icon as={FaExclamationTriangle} color="orange.500" mt={0.5} />
              <Text color="gray.700" fontSize="sm" fontWeight="600">
                Experimental Software - Use at Your Own Risk
              </Text>
            </HStack>
          </Box>

          {/* Disclaimer content */}
          <VStack align="stretch" spacing={4}>
            <Box>
              <Text
                color={currentColors.textPrimary}
                fontSize="sm"
                fontWeight="600"
                mb={2}
              >
                Phlox is an experimental project intended for educational and
                personal experimentation ONLY.
              </Text>
              <Text color={currentColors.textPrimary} fontSize="sm" fontWeight="600">
                AS PROVIDED, IT IS NOT A CERTIFIED MEDICAL DEVICE AND MUST NOT BE
                USED IN ACTUAL CLINICAL SETTINGS OR FOR CLINICAL DECISION-MAKING.
              </Text>
            </Box>

            <Box>
              <Text
                color={currentColors.textPrimary}
                fontSize="sm"
                fontWeight="600"
                mb={2}
              >
                KEY LIMITATIONS:
              </Text>
              <VStack align="stretch" spacing={2}>
                <Text color={currentColors.textPrimary} fontSize="sm">
                  <strong>Experimental Code:</strong> The codebase is a work in
                  progress and may contain bugs and inconsistencies.
                </Text>
                <Text color={currentColors.textPrimary} fontSize="sm">
                  <strong>AI Hallucinations:</strong> LLM outputs, especially from
                  smaller models, can be unreliable, inaccurate, and may present
                  plausible but incorrect information. Always verify AI-generated
                  content against trusted sources and use your professional clinical
                  judgment.
                </Text>
                <Text color={currentColors.textPrimary} fontSize="sm">
                  <strong>No User Authentication:</strong> Naively exposing this
                  application to the open internet is highly discouraged. Phlox has
                  no user access controls and minimal input sanitisation.
                </Text>
                <Text color={currentColors.textPrimary} fontSize="sm">
                  <strong>Not HIPAA/GDPR Compliant:</strong> Phlox lacks the
                  necessary security and compliance measures for handling protected
                  health information in regulated environments.
                </Text>
              </VStack>
            </Box>

            <Text color={currentColors.textPrimary} fontSize="sm">
              USE AT YOUR OWN RISK and only for non-clinical, educational purposes
              unless you have implemented robust security measures and undertaken
              thorough validation.
            </Text>

            <Text color={currentColors.textSecondary} fontSize="xs">
              This software is provided under the MIT License.
            </Text>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <VStack w="100%" align="stretch" spacing={3}>
            <Checkbox
              className="checkbox task-checkbox"
              isChecked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            >
              <Text
                color={currentColors.textPrimary}
                fontSize="sm"
                sx={{ fontFamily: '"Roboto", sans-serif' }}
              >
                I have read and understand the above warnings. I agree to proceed at
                my own risk.
              </Text>
            </Checkbox>
            <HStack justify="flex-end">
              <Button
                onClick={handleContinue}
                isDisabled={!agreed}
                size="md"
                borderRadius="2xl !important"
                className="switch-mode"
                sx={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontWeight: "600",
                }}
              >
                Continue
              </Button>
            </HStack>
          </VStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default DisclaimerModal;
