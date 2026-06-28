import { Steps, Button, HStack, Heading, Text, Dialog, Portal } from "@chakra-ui/react";

const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
};

const ScribeConsentModal = ({
    isOpen,
    onClose,
    onConsent,
    onDecline,
    hasDeclined = false,
    declinedDate = null,
    patientName = "",
}) => {
    const name = patientName || "This patient";
    return (
        <Dialog.Root
            open={isOpen}
            size='md'
            closeOnInteractOutside={false}
            onOpenChange={e => {
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
                            <Heading as="h2" size="md" fontFamily="heading">
                                {hasDeclined
                                    ? "Previously declined"
                                    : "Ambient scribe consent"}
                            </Heading>
                        </Dialog.Header>
                        <Dialog.CloseTrigger />
                        <Dialog.Body>
                            {hasDeclined ? (
                                <Text>
                                    {name} previously declined consent for ambient
                                    scribing
                                    {declinedDate
                                        ? ` on ${formatDate(declinedDate)}`
                                        : ""}
                                    . Would you like to re-request consent before
                                    recording?
                                </Text>
                            ) : (
                                <Text>
                                    {name} hasn&apos;t yet consented to ambient
                                    scribing. Ambient mode records the consultation
                                    &mdash; please confirm the patient has consented
                                    before recording.
                                </Text>
                            )}
                        </Dialog.Body>
                        <Dialog.Footer>
                            <HStack justify="flex-end" width="100%">
                                {hasDeclined ? (
                                    <Button
                                        className="red-button"
                                        mr={3}
                                        onClick={onClose}
                                    >
                                        Cancel
                                    </Button>
                                ) : (
                                    <Button
                                        className="red-button"
                                        mr={3}
                                        onClick={onDecline}
                                    >
                                        Decline
                                    </Button>
                                )}
                                <Button className="green-button" onClick={onConsent}>
                                    {hasDeclined ? "Re-request consent" : "Consent"}
                                </Button>
                            </HStack>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>

            </Portal>
        </Dialog.Root>
    );
};

export default ScribeConsentModal;
