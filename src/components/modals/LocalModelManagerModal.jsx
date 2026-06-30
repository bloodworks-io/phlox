import React from "react";
import { Button, HStack, Heading, Dialog, Portal } from "@chakra-ui/react";
import LocalModelManager from "../settings/LocalModelManager";

const LocalModelManagerModal = ({ isOpen, onClose }) => {
  return (
    <Dialog.Root open={isOpen} size='xl' scrollBehavior="inside" onOpenChange={e => {
      if (!e.open) {
        onClose();
      }
    }}>
      <Portal>

        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content className="modal-style">
            <Dialog.Header><Heading as="h2" size="md" fontFamily="heading">Local Model Manager</Heading></Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body>
              <LocalModelManager className="modal-body-embed" />
            </Dialog.Body>
            <Dialog.Footer>
              <HStack justify="flex-end" width="100%">
                <Button onClick={onClose}>Close</Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>

      </Portal>
    </Dialog.Root>
  );
};

export default LocalModelManagerModal;
