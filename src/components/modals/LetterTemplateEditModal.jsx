import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  VStack,
  HStack,
  Input,
  Textarea,
} from "@chakra-ui/react";

const LetterTemplateEditModal = ({
  isOpen,
  onClose,
  onSave,
  template,
  setTemplate,
}) => {
  const handleChange = (field, value) => {
    setTemplate((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    onSave(template);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent className="modal-style">
        <ModalHeader>
          {template?.id ? "Edit Template" : "New Template"}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody maxH="40vh" overflowY="auto" className="custom-scrollbar">
          <VStack spacing={4}>
            <Input
              placeholder="Template Name"
              value={template?.name || ""}
              onChange={(e) => handleChange("name", e.target.value)}
              isDisabled={template?.name === "Dictation"}
              className="input-style"
            />
            <Textarea
              placeholder="Instructions for letter generation..."
              value={template?.instructions || ""}
              onChange={(e) => handleChange("instructions", e.target.value)}
              className="input-style"
            />
          </VStack>
        </ModalBody>
        <ModalFooter>
          <HStack justify="flex-end" width="100%">
            <Button
              className="red-button"
              mr={3}
              onClick={() => {
                onClose();
                setTemplate(null);
              }}
            >
              Cancel
            </Button>
            <Button className="green-button" onClick={handleSave}>
              Save
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default LetterTemplateEditModal;
