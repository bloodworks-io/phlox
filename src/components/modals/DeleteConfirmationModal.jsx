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

const DeleteConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  title = "Delete",
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent className="modal-style">
        <ModalHeader>{title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text>
            Are you sure you want to delete "{itemName}"? This action cannot be
            undone.
          </Text>
        </ModalBody>
        <ModalFooter>
          <HStack justify="flex-end" width="100%">
            <Button className="red-button" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button className="green-button" onClick={onConfirm}>
              Delete
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default DeleteConfirmationModal;
