import React from "react";
import ReactMarkdown from "react-markdown";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Box,
  Text,
  Image,
  HStack,
  VStack,
  Button,
  useColorMode,
} from "@chakra-ui/react";
import { colors } from "../../theme/colors";

const ChangelogModal = ({ isOpen, onClose, version, changelog }) => {
  const { colorMode } = useColorMode();
  const currentColors = colors[colorMode];

  const cleanChangelog = changelog.replace(/^# Changelog\s*\n/, "");
  const releases = cleanChangelog
    .split(/(?=## \[)/)
    .filter((release) => release.trim() !== "");

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent className="modal-style">
        <ModalHeader>
          <HStack>
            <Image src="/logo.webp" alt="Phlox Logo" width="30px" />
            <Text>Changelog v{version}</Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody maxH="40vh" overflowY="auto" className="custom-scrollbar">
          <VStack align="stretch" spacing={4}>
            {releases.length > 0 ? (
              releases.map((release, index) => (
                <Box key={index} mb={2}>
                  <ReactMarkdown>{release}</ReactMarkdown>
                </Box>
              ))
            ) : (
              <Text color={currentColors.textPrimary}>Loading changelog...</Text>
            )}
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
            >
              Close
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ChangelogModal;
