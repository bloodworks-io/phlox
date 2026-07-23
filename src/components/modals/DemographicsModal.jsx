import { HStack, Dialog, Portal } from "@chakra-ui/react";
import ModalTitle from "../common/ModalTitle";
import { FaUserEdit } from "react-icons/fa";
import DemographicsForm from "../patient/DemographicsForm";

const DemographicsModal = ({
    isOpen,
    onClose,
    patient,
    setPatient,
    onSave,
}) => (
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
                            <FaUserEdit />
                            <ModalTitle>
                                Patient details
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

export default DemographicsModal;
