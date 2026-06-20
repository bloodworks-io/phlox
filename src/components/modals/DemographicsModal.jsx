import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalCloseButton,
    HStack,
    Text,
} from "@chakra-ui/react";
import { FaUserEdit } from "react-icons/fa";
import DemographicsForm from "../patient/DemographicsForm";

const DemographicsModal = ({ isOpen, onClose, patient, setPatient, onSave }) => (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent className="modal-style">
            <ModalHeader>
                <HStack>
                    <FaUserEdit />
                    <Text>Patient details</Text>
                </HStack>
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody maxH="50vh" overflowY="auto" className="custom-scrollbar">
                <DemographicsForm
                    patient={patient}
                    setPatient={setPatient}
                    onSave={onSave}
                    onSaved={onClose}
                    onCancel={onClose}
                />
            </ModalBody>
        </ModalContent>
    </Modal>
);

export default DemographicsModal;
