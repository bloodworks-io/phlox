import { Button, HStack, Heading, Textarea, Box, Text, VStack, Dialog, Portal } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

const NewTemplateFromExampleModal = ({
    isOpen,
    onClose,
    onCreate,
    exampleNote,
    setExampleNote,
    isLoading,
}) => {
    const { t } = useTranslation();

    return (
        <Dialog.Root open={isOpen} size='lg' onOpenChange={e => {
            if (!e.open) {
                onClose();
            }
        }}>
            <Portal>

                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content className="modal-style">
                        <Dialog.Header><Heading as="h2" size="md" fontFamily="heading">{t("modal.newTemplateFromExample.title")}</Heading></Dialog.Header>
                        <Dialog.CloseTrigger />
                        <Dialog.Body
                            maxH="50vh"
                            overflowY="auto"
                            className="custom-scrollbar"
                        >
                            <VStack gap={4} align="stretch">
                                {/* Info box */}
                                <Box
                                    bg="surfaceMuted"
                                    borderLeft="4px solid"
                                    borderColor="accent"
                                    p={4}
                                    borderRadius="md"
                                >
                                    <VStack align="start" gap={2}>
                                        <Text
                                            color="textPrimary"
                                            fontWeight="600"
                                            fontSize="sm"
                                        >
                                            {t("modal.newTemplateFromExample.createTitle")}
                                        </Text>
                                        <Text
                                            color="textSecondary"
                                            fontSize="sm"
                                        >
                                            {t("modal.newTemplateFromExample.createDescription")}
                                        </Text>
                                    </VStack>
                                </Box>

                                {/* Tips */}
                                <Box px={2}>
                                    <Text
                                        color="textPrimary"
                                        fontSize="xs"
                                        fontWeight="600"
                                        mb={2}
                                    >
                                        {t("modal.newTemplateFromExample.tips")}
                                    </Text>
                                    <VStack align="start" gap={1} pl={2}>
                                        <Text
                                            color="textSecondary"
                                            fontSize="sm"
                                        >
                                            {t("modal.newTemplateFromExample.tipComplete")}
                                        </Text>
                                        <Text
                                            color="textSecondary"
                                            fontSize="sm"
                                        >
                                            {t("modal.newTemplateFromExample.tipSections")}
                                        </Text>
                                        <Text
                                            color="textSecondary"
                                            fontSize="sm"
                                        >
                                            {t("modal.newTemplateFromExample.tipFields")}
                                        </Text>
                                    </VStack>
                                </Box>

                                {/* Textarea */}
                                <Textarea
                                    placeholder={t("modal.newTemplateFromExample.placeholder")}
                                    value={exampleNote}
                                    onChange={(e) => setExampleNote(e.target.value)}
                                    className="input-style"
                                    minH="200px"
                                    resize="vertical"
                                />
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
                                        fontFamily: '"Space Grotesk", sans-serif',
                                        fontWeight: "600"
                                    }}
                                    mr={3}
                                >
                                    {t("action.cancel")}
                                </Button>
                                <Button
                                    onClick={onCreate}
                                    loading={isLoading}
                                    loadingText={t("modal.newTemplateFromExample.creating")}
                                    size="md"
                                    borderRadius="2xl"
                                    className="green-button"
                                    css={{
                                        fontFamily: '"Space Grotesk", sans-serif',
                                        fontWeight: "600"
                                    }}
                                >
                                    {t("modal.newTemplateFromExample.create")}
                                </Button>
                            </HStack>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>

            </Portal>
        </Dialog.Root>
    );
};

export default NewTemplateFromExampleModal;
