import { HStack, Dialog, Portal } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import ModalTitle from "../common/ModalTitle";
import { LuUserPen } from "react-icons/lu";
import DemographicsForm from "../patient/DemographicsForm";

const DemographicsModal = ({
    isOpen,
    onClose,
    patient,
    setPatient,
    onSave,
}) => {
    const { t } = useTranslation();

    return (
        <Dialog.Root
            open={isOpen}
            size="lg"
            onOpenChange={(e) => {
                if (!e.open) {
                    onClose();
                }
            }}
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content className="modal-style">
                        <Dialog.Header>
                            <HStack>
                                <LuUserPen strokeWidth={1.6} />
                                <ModalTitle>
                                    {t("modal.demographics.title")}
                                </ModalTitle>
                            </HStack>
                        </Dialog.Header>
                        <Dialog.CloseTrigger />
                        <Dialog.Body
                            maxH="50vh"
                            overflowY="auto"
                            className="custom-scrollbar"
                        >
                            <DemographicsForm
                                key={patient?.id || "empty"}
                                patient={patient}
                                setPatient={setPatient}
                                onSave={onSave}
                                onSaved={onClose}
                                onCancel={onClose}
                            />
                        </Dialog.Body>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
};

export default DemographicsModal;
