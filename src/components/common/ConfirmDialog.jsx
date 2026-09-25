import { Button, HStack, Heading, Text, Dialog, Portal } from "@chakra-ui/react";

const ConfirmDialog = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    body,
    confirmLabel,
    cancelLabel = "Cancel",
}) => (
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
                                {cancelLabel}
                            </Button>
                        </HStack>
                    </Dialog.Footer>
                </Dialog.Content>
            </Dialog.Positioner>
        </Portal>
    </Dialog.Root>
);

export default ConfirmDialog;
