import { Button, VStack, HStack, Heading, Input, Textarea, Dialog, Portal } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

const LetterTemplateEditModal = ({
  isOpen,
  onClose,
  onSave,
  template,
  setTemplate,
}) => {
  const { t } = useTranslation();

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
    <Dialog.Root open={isOpen} size='lg' onOpenChange={e => {
      if (!e.open) {
        onClose();
      }
    }}>
      <Portal>

        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content className="modal-style">
            <Dialog.Header>
              <Heading as="h2" size="md" fontFamily="heading">
                {template?.id ? t("modal.letterTemplate.editTitle") : t("modal.letterTemplate.newTitle")}
              </Heading>
            </Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body maxH="40vh" overflowY="auto" className="custom-scrollbar">
              <VStack gap={4}>
                <Input
                  placeholder={t("modal.templateNamePlaceholder")}
                  value={template?.name || ""}
                  onChange={(e) => handleChange("name", e.target.value)}
                  disabled={template?.name === "Dictation"}
                  className="input-style"
                />
                <Textarea
                  placeholder={t("modal.letterTemplate.instructionsPlaceholder")}
                  value={template?.instructions || ""}
                  onChange={(e) => handleChange("instructions", e.target.value)}
                  className="input-style"
                />
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <HStack justify="flex-end" width="100%">
                <Button
                  className="red-button"
                  mr={3}
                  onClick={() => {
                    onClose();
                    setTemplate(null);
                  }}
                 >
                  {t("action.cancel")}
                </Button>
                <Button className="green-button" onClick={handleSave}>
                  {t("action.save")}
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>

      </Portal>
    </Dialog.Root>
  );
};

export default LetterTemplateEditModal;
