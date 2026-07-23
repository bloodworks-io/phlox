// Modal component to confirm delete operations for collections or files.
import { Button, Spinner, Text, Dialog, Portal } from "@chakra-ui/react";

const DeleteModal = ({ isOpen, onClose, onDelete, item }) => {
    const isDeleting = isOpen && !item;
    if (!item) return null; // Don't render if no item to delete

    return (
        <Dialog.Root open={isOpen} onOpenChange={e => {
            if (!e.open) {
                onClose();
            }
        }}>
            <Portal>

                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content className="modal-style">
                        <Dialog.Header>
                            {item.type === "file" ? "Delete File" : "Delete Collection"}
                        </Dialog.Header>
                        <Dialog.CloseTrigger />
                        <Dialog.Body>
                            {isDeleting ? (
                                <Spinner size="md" />
                            ) : (
                                <Text>
                                    Are you sure you want to delete the{" "}
                                    {item.type === "file" ? "file" : "collection"} "
                                    {item.name}"
                                    {item.type === "file" &&
                                        ` from the collection "${item.collection}"`}
                                    ?
                                </Text>
                            )}
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button
                                className="red-button"
                                mr={3}
                                onClick={onDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? "Deleting..." : "Delete"}
                            </Button>
                            <Button
                                className="green-button"
                                onClick={onClose}
                                disabled={isDeleting}
                            >
                                Cancel
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>

            </Portal>
        </Dialog.Root>
    );
};

export default DeleteModal;
