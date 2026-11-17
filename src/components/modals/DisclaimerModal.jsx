// Modal component to display disclaimer on first visit to landing page per session.
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { LuTriangleAlert } from "react-icons/lu";

const DisclaimerModal = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
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
                                <Heading as="h2" size="md" fontFamily="heading">{t("modal.disclaimer.title")}</Heading>
                            </HStack>
                        </Dialog.Header>
                        {/* Warning alert */}
                        <Box
                            bg="folio.warningSoft"
                            borderLeft="4px solid"
                            borderColor="folio.warning"
                            width="90%"
                            marginLeft="5%"
                            p={3}
                            borderRadius="md"
                            mb={4}
                        >
                            <HStack align="start">
                                <Icon color="folio.warning" mt={0.5} asChild><LuTriangleAlert strokeWidth={1.6} /></Icon>
                                <Text color="folio.ink" fontSize="sm" fontWeight="600">
                                    {t("modal.disclaimer.warning")}
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
                                        color="folio.ink"
                                        fontSize="sm"
                                        fontWeight="600"
                                        mb={2}
                                    >
                                        {t("modal.disclaimer.intro")}
                                    </Text>
                                    <Text
                                        color="folio.ink"
                                        fontSize="sm"
                                        fontWeight="600"
                                    >
                                        {t("modal.disclaimer.notCertified")}
                                    </Text>
                                </Box>

                                <Box>
                                    <Text
                                        color="folio.ink"
                                        fontSize="sm"
                                        fontWeight="600"
                                        mb={2}
                                    >
                                        {t("modal.disclaimer.keyLimitations")}
                                    </Text>
                                    <VStack align="stretch" gap={2}>
                                        <Text
                                            color="folio.ink"
                                            fontSize="sm"
                                        >
                                            <strong>{t("modal.disclaimer.experimentalCodeLabel")}</strong>{" "}
                                            {t("modal.disclaimer.experimentalCodeBody")}
                                        </Text>
                                        <Text
                                            color="folio.ink"
                                            fontSize="sm"
                                        >
                                            <strong>{t("modal.disclaimer.aiHallucinationsLabel")}</strong>{" "}
                                            {t("modal.disclaimer.aiHallucinationsBody")}
                                        </Text>
                                        <Text
                                            color="folio.ink"
                                            fontSize="sm"
                                        >
                                            <strong>{t("modal.disclaimer.noAuthLabel")}</strong>{" "}
                                            {t("modal.disclaimer.noAuthBody")}
                                        </Text>
                                        <Text
                                            color="folio.ink"
                                            fontSize="sm"
                                        >
                                            <strong>{t("modal.disclaimer.noComplianceLabel")}</strong>{" "}
                                            {t("modal.disclaimer.noComplianceBody")}
                                        </Text>
                                    </VStack>
                                </Box>

                                <Text color="folio.ink" fontSize="sm">
                                    {t("modal.disclaimer.useAtOwnRisk")}
                                </Text>

                                <Text color="folio.muted" fontSize="xs">
                                    {t("modal.disclaimer.license")}
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
                                        color="folio.ink"
                                        fontSize="sm"
                                    >
                                        {t("modal.disclaimer.agreement")}
                                    </Text>
                                </Checkbox.Label></Checkbox.Root>
                                <HStack justify="flex-end">
                                    <Button
                                        onClick={handleContinue}
                                        disabled={!agreed}
                                        size="md"
                                        variant="folioPrimary"
                                    >
                                        {t("action.continue")}
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
