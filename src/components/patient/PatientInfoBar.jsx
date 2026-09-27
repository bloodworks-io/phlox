import { Flex, Text, IconButton, HStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@/components/ui/tooltip";
import { FaEdit } from "react-icons/fa";
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
                className="panels-bg"
                borderRadius="lg"
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
                    color="#fff"
                    fontSize="xs"
                    fontWeight="700"
                    flexShrink={0}
                    css={{
                        fontFamily: '"Space Grotesk", sans-serif',
                    }}
                >
                    {(patient.name && getInitials(patient.name)) || "?"}
                </Flex>

                <HStack gap={2} minW="0">
                    <Text
                        fontWeight="700"
                        fontSize="md"
                        color={"textPrimary"}
                        lineClamp={1}
                        css={{
                            fontFamily: '"Space Grotesk", sans-serif',
                        }}
                    >
                        {name}
                    </Text>
                    <Text
                        fontSize="sm"
                        color={"textSecondary"}
                        lineClamp={1}
                        css={{
                            fontFamily: '"Roboto", sans-serif',
                        }}
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
                        color={"textSecondary"}
                        onClick={onEdit}
                        flexShrink={0}
                    >
                        <FaEdit />
                    </IconButton>
                </Tooltip>
            </Flex>
        </Flex>
    );
};

export default PatientInfoBar;
