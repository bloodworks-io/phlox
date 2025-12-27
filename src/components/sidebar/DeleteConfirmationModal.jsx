import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalFooter,
    ModalBody,
    ModalCloseButton,
    Button,
} from "@chakra-ui/react";

const DeleteConfirmationModal = ({
    isOpen,
    onClose,
    onDelete,
    patientName,
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <ModalOverlay />
            <ModalContent className="modal-style">
                <ModalHeader>Delete Patient</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    {patientName
                        ? `Are you sure you want to delete ${patientName}?`
                        : "Are you sure you want to delete this patient?"}
                </ModalBody>
                <ModalFooter>
                    <Button className="red-button" mr={3} onClick={onDelete}>
                        Delete
                    </Button>
                    <Button className="green-button" onClick={onClose}>
                        Cancel
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default DeleteConfirmationModal;
