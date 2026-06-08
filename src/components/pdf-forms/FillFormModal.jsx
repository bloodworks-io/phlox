// Modal for filling a PDF form template and downloading the result.
import React, { useState } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  FormControl,
  FormLabel,
  Checkbox,
  VStack,
  Text,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import { pdfFormsApi } from "../../utils/api/pdfFormsApi";
import { fillPdf } from "../../utils/pdf/fillForm";
import { GreenButton, GreyButton } from "../common/Buttons";

const FillFormModal = ({ isOpen, onClose, template }) => {
  const [values, setValues] = useState({});
  const [filling, setFilling] = useState(false);
  const toast = useToast();
  const mutedColor = useColorModeValue("gray.500", "gray.400");

  const fields = template?.fields || [];

  const handleChange = (fieldName, value) => {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleFill = async () => {
    if (!template) return;

    setFilling(true);
    try {
      const pdfData = await pdfFormsApi.fetchTemplatePdf(template.id);
      const filledBytes = await fillPdf(
        new Uint8Array(pdfData),
        template,
        values
      );

      const blob = new Blob([filledBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${template.name || "form"}_filled.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Form filled",
        description: "PDF downloaded successfully",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
      handleClose();
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to fill form: ${error.message}`,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setFilling(false);
    }
  };

  const handleClose = () => {
    setValues({});
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <Text as="h3">Fill: {template?.name}</Text>
        </ModalHeader>
        <ModalBody>
          {fields.length === 0 ? (
            <Text color={mutedColor} fontSize="sm">
              This template has no fields defined yet.
            </Text>
          ) : (
            <VStack spacing="3" align="stretch">
              {fields.map((field) => (
                <FormControl key={field.id}>
                  <FormLabel fontSize="sm" mb="1">
                    {field.name || `Field (${field.field_type})`}
                    {field.required && (
                      <Text as="span" color="red.400" ml="1">
                        *
                      </Text>
                    )}
                  </FormLabel>
                  {field.field_type === "checkbox" ? (
                    <Checkbox
                      isChecked={values[field.name] === "true"}
                      onChange={(e) =>
                        handleChange(field.name, e.target.checked ? "true" : "")
                      }
                    >
                      {field.description || "Check to enable"}
                    </Checkbox>
                  ) : (
                    <Input
                      size="sm"
                      type={
                        field.field_type === "date"
                          ? "date"
                          : field.field_type === "number"
                            ? "number"
                            : "text"
                      }
                      value={values[field.name] || ""}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      placeholder={field.description || field.field_type}
                      className="input-style"
                    />
                  )}
                </FormControl>
              ))}
            </VStack>
          )}
        </ModalBody>
        <ModalFooter>
          <GreyButton mr="3" onClick={handleClose}>
            Cancel
          </GreyButton>
          <GreenButton
            onClick={handleFill}
            isLoading={filling}
            isDisabled={fields.length === 0}
          >
            Fill & Download
          </GreenButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default FillFormModal;
