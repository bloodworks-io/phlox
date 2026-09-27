import { Button, HStack, Heading, Text, Dialog, Portal } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

const ConfirmDialog = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    body,
    confirmLabel,
    cancelLabel,
}) => {
    const { t } = useTranslation();
    const cancelText = cancelLabel ?? t("action.cancel");

    return (
        <Dialog.Root
            open={isOpen}
            onOpenChange={(e) => {
                if (!e.open) onClose();
            }}
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content className="modal-style">
                        <Dialog.Header>
                            <Heading as="h2" size="md" fontFamily="heading">
                                {title}
                            </Heading>
                        </Dialog.Header>
                        <Dialog.CloseTrigger />
                        <Dialog.Body>
                            <Text>{body}</Text>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <HStack justify="flex-end" width="100%">
                                <Button className="red-button" mr={3} onClick={onConfirm}>
                                    {confirmLabel}
                                </Button>
                                <Button className="green-button" onClick={onClose}>
                                    {cancelText}
                                </Button>
                            </HStack>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
};

export default ConfirmDialog;
