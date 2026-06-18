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
    Text,
} from "@chakra-ui/react";

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
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="md"
            closeOnOverlayClick={false}
        >
            <ModalOverlay />
            <ModalContent className="modal-style">
                <ModalHeader>
                    {hasDeclined
                        ? "Previously declined"
                        : "Ambient scribe consent"}
                </ModalHeader>
                <ModalCloseButton />
                <ModalBody>
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
                </ModalBody>
                <ModalFooter>
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
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default ScribeConsentModal;
