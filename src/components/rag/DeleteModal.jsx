// Modal component to confirm delete operations for collections or files.
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalCloseButton,
    ModalBody,
    ModalFooter,
    Button,
    Spinner,
    Text,
} from "@chakra-ui/react";

const DeleteModal = ({ isOpen, onClose, onDelete, item }) => {
    const isDeleting = isOpen && !item;
    if (!item) return null; // Don't render if no item to delete

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <ModalOverlay />
            <ModalContent className="modal-style">
                <ModalHeader>
                    {item.type === "file" ? "Delete File" : "Delete Collection"}
                </ModalHeader>
                <ModalCloseButton />
                <ModalBody>
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
                </ModalBody>
                <ModalFooter>
                    <Button
                        className="red-button"
                        mr={3}
                        onClick={onDelete}
                        isDisabled={isDeleting}
                    >
                        {isDeleting ? "Deleting..." : "Delete"}
                    </Button>
                    <Button
                        className="green-button"
                        onClick={onClose}
                        isDisabled={isDeleting}
                    >
                        Cancel
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default DeleteModal;
