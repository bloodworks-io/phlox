import { Flex, Text, IconButton, HStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@/components/ui/tooltip";
import { LuPencil } from "react-icons/lu";
import { getAvatarColor, getInitials } from "../sidebar/SidebarHelpers";

const PatientInfoBar = ({ patient, onEdit }) => {
    const { t } = useTranslation();
    const name = patient.name || t("patient.newPatient");
    const meta = [
        patient.gender,
        patient.dob,
        patient.ur_number && t("patient.urBadge", { ur: patient.ur_number }),
    ].filter(Boolean);

    return (
        <Flex w="100%">
            <Flex
                className="patient-context-bar"
                py={2}
                px={4}
                align="center"
                gap={3}
                w="100%"
            >
                <Flex
                    align="center"
                    justify="center"
                    boxSize="28px"
                    borderRadius="full"
                    bg={getAvatarColor(patient.name)}
                    color="white"
                    fontSize="xs"
                    fontWeight="700"
                    flexShrink={0}
                >
                    {(patient.name && getInitials(patient.name)) || "?"}
                </Flex>

                <HStack gap={2} minW="0">
                    <Text
                        fontFamily="display"
                        fontWeight="500"
                        fontSize="md"
                        color="folio.ink"
                        lineClamp={1}
                    >
                        {name}
                    </Text>
                    <Text
                        fontSize="sm"
                        color="folio.muted"
                        lineClamp={1}
                    >
                        {meta.length
                            ? meta.join("  ·  ")
                            : t("patient.noDemographicsYet")}
                    </Text>
                </HStack>

                <Tooltip content={t("patient.editPatientDetails")}>
                    <IconButton
                        aria-label={t("patient.editPatientDetails")}
                        size="sm"
                        variant="ghost"
                        color="folio.muted"
                        onClick={onEdit}
                        flexShrink={0}
                        _hover={{ bg: "folio.hover", color: "folio.ink" }}
                    >
                        <LuPencil strokeWidth={1.6} />
                    </IconButton>
                </Tooltip>
            </Flex>
        </Flex>
    );
};

export default PatientInfoBar;
