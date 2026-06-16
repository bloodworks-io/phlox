import { useEffect, useState } from "react";
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    ModalCloseButton,
    HStack,
    VStack,
    Box,
    Text,
    Input,
    Select,
    Button,
} from "@chakra-ui/react";
import { FaUserEdit } from "react-icons/fa";

const Field = ({ label, required, children }) => (
    <Box flex={1} minW="0">
        <Text fontSize="sm" fontWeight="bold" mb={1}>
            {label}
            {required && (
                <Text as="span" color="red.400" ml={1}>
                    *
                </Text>
            )}
        </Text>
        {children}
    </Box>
);

const DemographicsModal = ({ isOpen, onClose, patient, setPatient }) => {
    const [form, setForm] = useState({});

    useEffect(() => {
        if (!isOpen || !patient) return;
        setForm({
            first_name: patient.first_name || "",
            last_name: patient.last_name || "",
            dob: patient.dob || "",
            gender: patient.gender || "",
            ur_number: patient.ur_number || "",
            address: patient.address || "",
            phone: patient.phone || "",
        });
    }, [isOpen, patient]);

    const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const requiredMet =
        form.first_name?.trim() &&
        form.last_name?.trim() &&
        form.dob?.trim() &&
        form.ur_number?.trim();

    const handleSave = () => {
        const first = (form.first_name || "").trim();
        const last = (form.last_name || "").trim();
        const name = last && first ? `${last}, ${first}` : last || first;
        setPatient((prev) => ({
            ...prev,
            first_name: first,
            last_name: last,
            name,
            dob: form.dob || "",
            gender: form.gender || "",
            ur_number: form.ur_number || "",
            address: form.address || "",
            phone: form.phone || "",
        }));
        onClose();
    };

    const btnSx = {
        fontFamily: '"Space Grotesk", sans-serif',
        fontWeight: "600",
    };

    return (
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
                <ModalBody
                    maxH="50vh"
                    overflowY="auto"
                    className="custom-scrollbar"
                >
                    <VStack spacing={4} align="stretch">
                        <HStack spacing={3} align="flex-start">
                            <Field label="First name" required>
                                <Input
                                    className="input-style"
                                    size="sm"
                                    placeholder="First name"
                                    value={form.first_name || ""}
                                    onChange={(e) =>
                                        set("first_name", e.target.value)
                                    }
                                />
                            </Field>
                            <Field label="Last name" required>
                                <Input
                                    className="input-style"
                                    size="sm"
                                    placeholder="Last name"
                                    value={form.last_name || ""}
                                    onChange={(e) =>
                                        set("last_name", e.target.value)
                                    }
                                />
                            </Field>
                        </HStack>
                        <HStack spacing={3} align="flex-start">
                            <Field label="Date of birth" required>
                                <Input
                                    type="date"
                                    className="input-style"
                                    size="sm"
                                    value={form.dob || ""}
                                    onChange={(e) => set("dob", e.target.value)}
                                />
                            </Field>
                            <Field label="Gender">
                                <Select
                                    className="input-style"
                                    size="sm"
                                    value={form.gender || ""}
                                    onChange={(e) =>
                                        set("gender", e.target.value)
                                    }
                                >
                                    <option value="">M/F</option>
                                    <option value="M">M</option>
                                    <option value="F">F</option>
                                </Select>
                            </Field>
                        </HStack>
                        <Field label="UR number" required>
                            <Input
                                className="input-style"
                                size="sm"
                                placeholder="UR number"
                                value={form.ur_number || ""}
                                onChange={(e) =>
                                    set("ur_number", e.target.value)
                                }
                            />
                        </Field>
                        <Field label="Address">
                            <Input
                                className="input-style"
                                size="sm"
                                placeholder="Address"
                                value={form.address || ""}
                                onChange={(e) => set("address", e.target.value)}
                            />
                        </Field>
                        <Field label="Phone">
                            <Input
                                className="input-style"
                                size="sm"
                                placeholder="Phone"
                                value={form.phone || ""}
                                onChange={(e) => set("phone", e.target.value)}
                            />
                        </Field>
                    </VStack>
                </ModalBody>
                <ModalFooter>
                    <HStack justify="flex-end" width="100%">
                        <Button
                            onClick={onClose}
                            size="md"
                            borderRadius="2xl !important"
                            className="switch-mode"
                            sx={btnSx}
                            mr={3}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            isDisabled={!requiredMet}
                            size="md"
                            borderRadius="2xl !important"
                            className="switch-mode"
                            sx={btnSx}
                        >
                            Save
                        </Button>
                    </HStack>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default DemographicsModal;
