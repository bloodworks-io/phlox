import { useEffect, useRef, useState } from "react";
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
    Icon,
    Spinner,
    useColorMode,
    useToast,
} from "@chakra-ui/react";
import { FaUserEdit, FaFileUpload } from "react-icons/fa";
import { colors } from "../../theme/colors";
import { transcriptionApi } from "../../utils/api/transcriptionApi";
import { extractFromFile } from "../../utils/helpers/documentExtraction";
import { areRequiredDemographicsMet } from "../../utils/helpers/validationHelpers";

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

const DemographicsModal = ({
    isOpen,
    onClose,
    patient,
    setPatient,
    onSave,
}) => {
    const { colorMode } = useColorMode();
    const c = colors[colorMode];
    const toast = useToast();
    const [form, setForm] = useState({});
    const [isDragOver, setIsDragOver] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractError, setExtractError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef(null);
    const firstNameRef = useRef(null);

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
        setIsDragOver(false);
        setIsExtracting(false);
        setExtractError(null);
    }, [isOpen, patient]);

    const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const handleFile = async (file) => {
        if (!file) return;
        setIsExtracting(true);
        setExtractError(null);
        try {
            const data = await extractFromFile(
                file,
                {
                    fromText: transcriptionApi.extractDemographicsFromText,
                    visual: transcriptionApi.extractDemographicsVisual,
                    legacyFile: (formData) =>
                        transcriptionApi.extractDemographics(formData),
                },
                {},
            );
            // Merge only the fields the model returned (others left untouched).
            if (data && typeof data === "object") {
                setForm((prev) => ({ ...prev, ...data }));
            }
        } catch (e) {
            setExtractError("Couldn't read demographics from that document.");
        } finally {
            setIsExtracting(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes("Files")) setIsDragOver(true);
    };
    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
    };

    const requiredMet = areRequiredDemographicsMet(form);

    const handleSave = async () => {
        const first = (form.first_name || "").trim();
        const last = (form.last_name || "").trim();
        const name = last && first ? `${last}, ${first}` : last || first;
        const updated = {
            ...patient,
            first_name: first,
            last_name: last,
            name,
            dob: form.dob || "",
            gender: form.gender || "",
            ur_number: form.ur_number || "",
            address: form.address || "",
            phone: form.phone || "",
        };
        setPatient(updated);
        if (onSave) {
            setIsSaving(true);
            try {
                await onSave(updated);
            } catch (e) {
                toast({
                    title: "Couldn't save demographics",
                    description: "Please try again.",
                    status: "error",
                    duration: 3000,
                    isClosable: true,
                });
                setIsSaving(false);
                return;
            }
            setIsSaving(false);
        }
        onClose();
    };

    const btnSx = {
        fontFamily: '"Space Grotesk", sans-serif',
        fontWeight: "600",
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="lg"
            initialFocusRef={firstNameRef}
        >
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
                        {/* Document drop zone — auto-fills fields from a referral/ID/etc. */}
                        <Box
                            position="relative"
                            borderRadius="md"
                            border="2px dashed"
                            borderColor={isDragOver ? "blue.400" : c.surface}
                            bg={
                                isDragOver
                                    ? "rgba(66, 153, 225, 0.15)"
                                    : "transparent"
                            }
                            p={3}
                            textAlign="center"
                            cursor="pointer"
                            transition="all 0.15s"
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <Input
                                type="file"
                                ref={fileInputRef}
                                accept=".pdf,.txt,image/*"
                                onChange={(e) =>
                                    handleFile(e.target.files?.[0])
                                }
                                display="none"
                            />
                            <HStack
                                spacing={2}
                                justify="center"
                                color={c.textSecondary}
                                fontSize="sm"
                            >
                                <Icon as={FaFileUpload} />
                                <Text>
                                    {isExtracting
                                        ? "Reading document…"
                                        : "Drop a document to auto-fill, or click to browse"}
                                </Text>
                                {isExtracting && <Spinner size="xs" />}
                            </HStack>
                            {extractError && (
                                <Text fontSize="xs" color="red.400" mt={1}>
                                    {extractError}
                                </Text>
                            )}
                        </Box>

                        <HStack spacing={3} align="flex-start">
                            <Field label="First name" required>
                                <Input
                                    ref={firstNameRef}
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
                            isLoading={isSaving}
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
