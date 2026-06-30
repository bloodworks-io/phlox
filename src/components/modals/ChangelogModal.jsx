import React from "react";
import { useColorMode } from "../ui/color-mode";
import ReactMarkdown from "react-markdown";
import ModalTitle from "../common/ModalTitle";

import {
    Box,
    Text,
    Image,
    HStack,
    VStack,
    Button,
    Dialog,
    Portal,
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
        <Dialog.Root
            open={isOpen}
            size="lg"
            onOpenChange={(e) => {
                if (!e.open) {
                    onClose();
                }
            }}
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content className="modal-style">
                        <Dialog.Header>
                            <HStack>
                                <Image
                                    src="/logo.webp"
                                    alt="Phlox Logo"
                                    width="30px"
                                />
                                <ModalTitle>Changelog v{version}</ModalTitle>
                            </HStack>
                        </Dialog.Header>
                        <Dialog.CloseTrigger />
                        <Dialog.Body
                            maxH="40vh"
                            width="95%"
                            overflowY="auto"
                            className="custom-scrollbar"
                            mx="auto"
                        >
                            <VStack align="stretch" gap={4}>
                                {releases.length > 0 ? (
                                    releases.map((release, index) => (
                                        <Box key={index} mb={2}>
                                            <ReactMarkdown>
                                                {release}
                                            </ReactMarkdown>
                                        </Box>
                                    ))
                                ) : (
                                    <Text color={currentColors.textPrimary}>
                                        Loading changelog...
                                    </Text>
                                )}
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <HStack justify="flex-end" width="100%">
                                <Button
                                    onClick={onClose}
                                    size="md"
                                    borderRadius="2xl"
                                    className="switch-mode"
                                    css={{
                                        fontFamily:
                                            '"Space Grotesk", sans-serif',
                                        fontWeight: "600",
                                    }}
                                >
                                    Close
                                </Button>
                            </HStack>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
};

export default ChangelogModal;
