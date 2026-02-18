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
} from "@chakra-ui/react";
import LocalModelManager from "./LocalModelManager";

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
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default LocalModelManagerModal;
