// Modal component to display disclaimer on first visit to landing page per session.
import { useState } from "react";
import {
    Button,
    Box,
    Text,
    VStack,
    HStack,
    Heading,
    Icon,
    Checkbox,
    Image,
    Dialog,
    Portal,
} from "@chakra-ui/react";
import { FaExclamationTriangle } from "react-icons/fa";

const DisclaimerModal = ({ isOpen, onClose }) => {
    const [agreed, setAgreed] = useState(false);

    const handleContinue = () => {
        if (!agreed) return;
        onClose();
    };

    return (
        <Dialog.Root
            open={isOpen}
            size='lg'
            closeOnInteractOutside={false}
            closeOnEscape={false}
            onOpenChange={e => {
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
                                <Image src="/logo.webp" alt="Phlox Logo" width="30px" />
                                <Heading as="h2" size="md" fontFamily="heading">Important Notice</Heading>
                            </HStack>
                        </Dialog.Header>
                        {/* Warning alert */}
                        <Box
                            bg="orange.100"
                            borderLeft="4px solid"
                            borderColor="orange.400"
                            width="90%"
                            marginLeft="5%"
                            p={3}
                            borderRadius="md"
                            mb={4}
                        >
                            <HStack align="start">
                                <Icon color="orange.500" mt={0.5} asChild><FaExclamationTriangle /></Icon>
                                <Text color="gray.700" fontSize="sm" fontWeight="600">
                                    Experimental Software - Use at Your Own Risk
                                </Text>
                            </HStack>
                        </Box>
                        <Dialog.Body
                            maxH="40vh"
                            overflowY="auto"
                            className="custom-scrollbar"
                        >
                            {/* Disclaimer content */}
                            <VStack align="stretch" gap={4}>
                                <Box>
                                    <Text
                                        color={"textPrimary"}
                                        fontSize="sm"
                                        fontWeight="600"
                                        mb={2}
                                    >
                                        Phlox is an experimental project intended for
                                        educational and personal experimentation ONLY.
                                    </Text>
                                    <Text
                                        color={"textPrimary"}
                                        fontSize="sm"
                                        fontWeight="600"
                                    >
                                        AS PROVIDED, IT IS NOT A CERTIFIED MEDICAL
                                        DEVICE AND MUST NOT BE USED IN ACTUAL CLINICAL
                                        SETTINGS OR FOR CLINICAL DECISION-MAKING.
                                    </Text>
                                </Box>

                                <Box>
                                    <Text
                                        color={"textPrimary"}
                                        fontSize="sm"
                                        fontWeight="600"
                                        mb={2}
                                    >
                                        KEY LIMITATIONS:
                                    </Text>
                                    <VStack align="stretch" gap={2}>
                                        <Text
                                            color={"textPrimary"}
                                            fontSize="sm"
                                        >
                                            <strong>Experimental Code:</strong> The
                                            codebase is a work in progress and may
                                            contain bugs and inconsistencies.
                                        </Text>
                                        <Text
                                            color={"textPrimary"}
                                            fontSize="sm"
                                        >
                                            <strong>AI Hallucinations:</strong> LLM
                                            outputs, especially from smaller models, can
                                            be unreliable, inaccurate, and may present
                                            plausible but incorrect information. Always
                                            verify AI-generated content against trusted
                                            sources and use your professional clinical
                                            judgment.
                                        </Text>
                                        <Text
                                            color={"textPrimary"}
                                            fontSize="sm"
                                        >
                                            <strong>No User Authentication:</strong>{" "}
                                            Naively exposing this application to the
                                            open internet is highly discouraged. Phlox
                                            has no user access controls and minimal
                                            input sanitisation.
                                        </Text>
                                        <Text
                                            color={"textPrimary"}
                                            fontSize="sm"
                                        >
                                            <strong>Not HIPAA/GDPR Compliant:</strong>{" "}
                                            Phlox lacks the necessary security and
                                            compliance measures for handling protected
                                            health information in regulated
                                            environments.
                                        </Text>
                                    </VStack>
                                </Box>

                                <Text color={"textPrimary"} fontSize="sm">
                                    USE AT YOUR OWN RISK and only for non-clinical,
                                    educational purposes unless you have implemented
                                    robust security measures and undertaken thorough
                                    validation.
                                </Text>

                                <Text color={"textSecondary"} fontSize="xs">
                                    This software is provided under the MIT License.
                                </Text>
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <VStack w="100%" align="stretch" gap={3}>
                                <Checkbox.Root
                                    className="checkbox task-checkbox"
                                    onCheckedChange={({ checked }) => setAgreed(checked)}
                                    checked={agreed}
                                ><Checkbox.HiddenInput /><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control><Checkbox.Label>
                                    <Text
                                        color={"textPrimary"}
                                        fontSize="sm"
                                        css={{
                                            fontFamily: '"Roboto", sans-serif'
                                        }}
                                    >
                                        I have read and understand the above warnings. I
                                        agree to proceed at my own risk.
                                    </Text>
                                </Checkbox.Label></Checkbox.Root>
                                <HStack justify="flex-end">
                                    <Button
                                        onClick={handleContinue}
                                        disabled={!agreed}
                                        size="md"
                                        borderRadius="2xl"
                                        className="switch-mode"
                                        css={{
                                            fontFamily: '"Space Grotesk", sans-serif',
                                            fontWeight: "600"
                                        }}
                                    >
                                        Continue
                                    </Button>
                                </HStack>
                            </VStack>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>

            </Portal>
        </Dialog.Root>
    );
};

export default DisclaimerModal;
