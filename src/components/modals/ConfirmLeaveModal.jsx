// Modal component to confirm navigation away from the current page with unsaved changes.
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalFooter,
    ModalBody,
    Button,
} from "@chakra-ui/react";

const ConfirmLeaveModal = ({ isOpen, onClose, confirmNavigation }) => (
    <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent className="modal-style">
            <ModalHeader>Confirm Navigation</ModalHeader>
            <ModalBody>
                Are you sure you want to leave this page? Unsaved changes will
                be lost.
            </ModalBody>
            <ModalFooter>
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
            </ModalFooter>
        </ModalContent>
    </Modal>
);

export default ConfirmLeaveModal;
