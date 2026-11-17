import React from "react";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "react-i18next";
import ModalTitle from "../common/ModalTitle";
import { LuGithub } from "react-icons/lu";

import {
    Box,
    Text,
    Image,
    HStack,
    VStack,
    Button,
    Link,
    Dialog,
    Portal,
} from "@chakra-ui/react";

const ChangelogModal = ({ isOpen, onClose, version, changelog }) => {
    const { t } = useTranslation();

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
                            <HStack justify="space-between" width="100%">
                                <HStack>
                                    <Image
                                        src="/logo.webp"
                                        alt="Phlox Logo"
                                        width="30px"
                                    />
                                    <ModalTitle>{t("modal.changelog.title", { version })}</ModalTitle>
                                </HStack>
                                <Link
                                    href="https://github.com/bloodworks-io/phlox"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    _hover={{ textDecoration: "none" }}
                                >
                                    <Box
                                        bg="folio.paperAlt"
                                        color="folio.muted"
                                        border="1px solid"
                                        borderColor="folio.line"
                                        borderRadius="full"
                                        p={1}
                                        px={2}
                                        fontSize="xs"
                                    >
                                        <HStack gap={1}>
                                            <LuGithub strokeWidth={1.6} />
                                            <Text fontSize="xs">GitHub</Text>
                                        </HStack>
                                    </Box>
                                </Link>
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
                                        <Box
                                            key={index}
                                            mb={2}
                                            className="anim-fade-slide-up"
                                            css={{
                                                animationDuration: "0.2s",
                                            }}
                                        >
                                            <ReactMarkdown>
                                                {release}
                                            </ReactMarkdown>
                                        </Box>
                                    ))
                                ) : (
                                    <Text color={"folio.ink"}>
                                        {t("modal.changelog.loading")}
                                    </Text>
                                )}
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <HStack justify="flex-end" width="100%">
                                <Button
                                    onClick={onClose}
                                    size="md"
                                    variant="folioSecondary"
                                    >
                                    {t("action.close")}
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
