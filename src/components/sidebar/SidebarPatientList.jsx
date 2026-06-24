import { Steps, Box, Flex, Avatar, Text, IconButton, Collapsible, VStack } from "@chakra-ui/react";
import { Tooltip } from '@/components/ui/tooltip';
import { useColorModeValue } from "../ui/color-mode";
import { useState } from "react";
import { DeleteIcon } from "../common/icons";
import { SectionHeader, getInitials, getAvatarColor } from "./SidebarHelpers";
import { colors } from "../../theme/colors";

const SidebarPatientList = ({
    patients,
    onSelectPatient,
    onDeletePatient,
    isCollapsed,
}) => {
    const [isPatientsCollapsed, setIsPatientsCollapsed] = useState(false);
    const [hoveredPatientId, setHoveredPatientId] = useState(null);
    const labelColor = colors.dark.textSecondary;

    return (
        <Box w="100%">
            {/* Patient List Header - Collapsible when expanded */}
            {!isCollapsed && (
                <SectionHeader
                    title="PATIENTS"
                    count={patients.length}
                    isCollapsed={isPatientsCollapsed}
                    onToggle={() =>
                        setIsPatientsCollapsed(!isPatientsCollapsed)
                    }
                />
            )}
            {/* Patient List */}
            <Collapsible.Root open={isCollapsed || !isPatientsCollapsed}>
                <Collapsible.Content>
                    <Box w="100%" mt={isCollapsed ? "0" : "1"}>
                        {patients.length > 0 ? (
                            <VStack
                                gap={isCollapsed ? "3" : "2"}
                                align="stretch"
                                w="100%"
                                py={isCollapsed ? "2" : "0"}
                            >
                                {patients.map((patient) => {
                                    const initials = getInitials(patient.name);
                                    const avatarBg = getAvatarColor(patient.name);
                                    const isHovered =
                                        hoveredPatientId === patient.id;

                                    return (
                                        <Tooltip
                                            key={patient.id}
                                            content={isCollapsed ? patient.name : ""}
                                            disabled={!isCollapsed}
                                            positioning={{
                                                placement: "right"
                                            }}
                                        >
                                            <Flex
                                                w="100%"
                                                align="center"
                                                p="2"
                                                borderRadius="lg"
                                                role="group"
                                                cursor="pointer"
                                                justifyContent={
                                                    isCollapsed
                                                        ? "center"
                                                        : "space-between"
                                                }
                                                onClick={() =>
                                                    onSelectPatient(patient)
                                                }
                                                onMouseEnter={() =>
                                                    setHoveredPatientId(patient.id)
                                                }
                                                onMouseLeave={() =>
                                                    setHoveredPatientId(null)
                                                }
                                                bg={
                                                    isHovered
                                                        ? "rgba(184, 192, 224, 0.1)"
                                                        : "transparent !important"
                                                }
                                                transition="all 0.2s"
                                                className="patient-list-item"
                                            >
                                                <Flex align="center">
                                                    <Avatar.Root
                                                        bg={avatarBg}
                                                        color="white"
                                                        size={
                                                            isCollapsed
                                                                ? "sm"
                                                                : "sm"
                                                        }
                                                        mr={isCollapsed ? "0" : "3"}>
                                                        <Avatar.Fallback>{initials}</Avatar.Fallback>
                                                    </Avatar.Root>

                                                    {!isCollapsed && (
                                                        <Box>
                                                            <Text
                                                                fontSize="sm"
                                                                fontWeight="500"
                                                                lineClamp={1}
                                                            >
                                                                {patient.name}
                                                            </Text>
                                                            <Text
                                                                fontSize="xs"
                                                                color={labelColor}
                                                            >
                                                                UR:{" "}
                                                                {patient.ur_number}
                                                            </Text>
                                                        </Box>
                                                    )}
                                                </Flex>

                                                {!isCollapsed && isHovered && (
                                                    <IconButton
                                                        size="xs"
                                                        aria-label="Delete patient"
                                                        variant="ghost"
                                                        colorPalette="red"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDeletePatient(
                                                                patient,
                                                            );
                                                        }}><DeleteIcon /></IconButton>
                                                )}
                                            </Flex>
                                        </Tooltip>
                                    );
                                })}
                            </VStack>
                        ) : (
                            <Text
                                fontSize="sm"
                                color={labelColor}
                                textAlign={isCollapsed ? "center" : "left"}
                                px="2"
                                mt={2}
                            >
                                {isCollapsed ? "No pts" : "No patients available"}
                            </Text>
                        )}
                    </Box>
                </Collapsible.Content>
            </Collapsible.Root>
        </Box>
    );
};

export default SidebarPatientList;
