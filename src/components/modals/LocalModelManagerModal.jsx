import React from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  HStack,
} from "@chakra-ui/react";
import LocalModelManager from "../settings/LocalModelManager";

const LocalModelManagerModal = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent className="modal-style">
        <ModalHeader>Local Model Manager</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <LocalModelManager className="modal-body-embed" />
        </ModalBody>
        <ModalFooter>
          <HStack justify="flex-end" width="100%">
            <Button onClick={onClose}>Close</Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default LocalModelManagerModal;
