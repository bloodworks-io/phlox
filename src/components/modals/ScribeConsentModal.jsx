import { Button, HStack, Heading, Text, Dialog, Portal } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { getLocale } from "../../utils/helpers/formatHelpers";

const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(getLocale());
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
    const { t } = useTranslation();
    const name = patientName || t("modal.scribeConsent.thisPatient");
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
                                    ? t("modal.scribeConsent.declinedTitle")
                                    : t("modal.scribeConsent.consentTitle")}
                            </Heading>
                        </Dialog.Header>
                        <Dialog.CloseTrigger />
                        <Dialog.Body>
                            {hasDeclined ? (
                                <Text>
                                    {t("modal.scribeConsent.declinedBody", {
                                        name,
                                        date: declinedDate
                                            ? ` on ${formatDate(declinedDate)}`
                                            : "",
                                    })}
                                </Text>
                            ) : (
                                <Text>
                                    {t("modal.scribeConsent.consentBody", { name })}
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
                                        {t("action.cancel")}
                                    </Button>
                                ) : (
                                    <Button
                                        className="red-button"
                                        mr={3}
                                        onClick={onDecline}
                                    >
                                        {t("modal.scribeConsent.decline")}
                                    </Button>
                                )}
                                <Button className="green-button" onClick={onConsent}>
                                    {hasDeclined ? t("modal.scribeConsent.reRequest") : t("modal.scribeConsent.consent")}
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
