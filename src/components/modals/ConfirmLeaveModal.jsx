// Modal component to confirm navigation away from the current page with unsaved changes.
import { Button, Heading, Dialog, Portal } from "@chakra-ui/react";

const ConfirmLeaveModal = ({ isOpen, onClose, confirmNavigation }) => (
    <Dialog.Root open={isOpen} onOpenChange={e => {
        if (!e.open) {
            onClose();
        }
    }}>
        <Portal>

            <Dialog.Backdrop />
            <Dialog.Positioner>
                <Dialog.Content className="modal-style">
                    <Dialog.Header><Heading as="h2" size="md" fontFamily="heading">Confirm Navigation</Heading></Dialog.Header>
                    <Dialog.Body>
                        Are you sure you want to leave this page? Unsaved changes will
                        be lost.
                    </Dialog.Body>
                    <Dialog.Footer>
                        <Button
                            className="red-button"
                            mr={3}
                            onClick={confirmNavigation}
                        >
                            Leave
                        </Button>
                        <Button className="green-button" onClick={onClose}>
                            Cancel
                        </Button>
                    </Dialog.Footer>
                </Dialog.Content>
            </Dialog.Positioner>

        </Portal>
    </Dialog.Root>
);

export default ConfirmLeaveModal;
