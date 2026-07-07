import {
    Box,
    Flex,
    Avatar,
    Text,
    IconButton,
    Collapsible,
    VStack,
} from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { useState } from "react";
import { DeleteIcon } from "../common/icons";
import { SectionHeader, getInitials, getAvatarColor } from "./SidebarHelpers";
import { colors } from "../../theme/colors";
import { isTauri } from "../../utils/helpers/apiConfig";

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
        <Box w="100%" h="100%" display="flex" flexDirection="column" minH="0">
            {/* Patient List Header */}
            {!isCollapsed && (
                <Box pt={2} pb={1} flexShrink={0}>
                    <SectionHeader
                        title="PATIENTS"
                        count={patients.length}
                        isCollapsed={isPatientsCollapsed}
                        onToggle={() =>
                            setIsPatientsCollapsed(!isPatientsCollapsed)
                        }
                    />
                </Box>
            )}
            {/* Scrollable items */}
            <Box
                flex="1"
                minH="0"
                overflowY="auto"
                overflowX="hidden"
                className={
                    isTauri() ? "custom-scrollbar" : "sidebar-scroll-overlay"
                }
                mt={isCollapsed ? "0" : "1"}
            >
                <Collapsible.Root open={isCollapsed || !isPatientsCollapsed}>
                    <Collapsible.Content>
                        <Box w="100%">
                            {patients.length > 0 ? (
                                <VStack
                                    gap={isCollapsed ? "3" : "2"}
                                    align="stretch"
                                    w="100%"
                                    py={isCollapsed ? "2" : "0"}
                                >
                                    {patients.map((patient) => {
                                        const initials = getInitials(
                                            patient.name,
                                        );
                                        const avatarBg = getAvatarColor(
                                            patient.name,
                                        );
                                        const isHovered =
                                            hoveredPatientId === patient.id;

                                        return (
                                            <Tooltip
                                                key={patient.id}
                                                content={
                                                    isCollapsed
                                                        ? patient.name
                                                        : ""
                                                }
                                                disabled={!isCollapsed}
                                                positioning={{
                                                    placement: "right",
                                                }}
                                            >
                                                <Flex
                                                    w="100%"
                                                    align="center"
                                                    p="2"
                                                    borderRadius="lg"
                                                    role="button"
                                                    tabIndex={0}
                                                    cursor="pointer"
                                                    justifyContent={
                                                        isCollapsed
                                                            ? "center"
                                                            : "space-between"
                                                    }
                                                    onClick={() =>
                                                        onSelectPatient(patient)
                                                    }
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            e.preventDefault();
                                                            onSelectPatient(patient);
                                                        }
                                                    }}
                                                    onMouseEnter={() =>
                                                        setHoveredPatientId(
                                                            patient.id,
                                                        )
                                                    }
                                                    onMouseLeave={() =>
                                                        setHoveredPatientId(
                                                            null,
                                                        )
                                                    }
                                                    bg={
                                                        isHovered
                                                            ? "rgba(184, 192, 224, 0.1)"
                                                            : "transparent"
                                                    }
                                                    transition="transform 0.1s ease, background 0.15s ease"
                                                    _active={{ transform: "scale(0.98)" }}
                                                    _focusVisible={{ outline: "2px solid", outlineColor: "accent", outlineOffset: "2px" }}
                                                    className="patient-list-item"
                                                >
                                                    <Flex align="center" minW="0" flex="1">
                                                        <Avatar.Root
                                                            bg={avatarBg}
                                                            color="white"
                                                            size={
                                                                isCollapsed
                                                                    ? "xs"
                                                                    : "xs"
                                                            }
                                                            mr={
                                                                isCollapsed
                                                                    ? "0"
                                                                    : "3"
                                                            }
                                                        >
                                                            <Avatar.Fallback>
                                                                {initials}
                                                            </Avatar.Fallback>
                                                        </Avatar.Root>

                                                        {!isCollapsed && (
                                                            <Box minW="0" flex="1">
                                                                <Text
                                                                    fontSize="sm"
                                                                    fontWeight="500"
                                                                    lineClamp={
                                                                        1
                                                                    }
                                                                >
                                                                    {
                                                                        patient.name
                                                                    }
                                                                </Text>
                                                                <Text
                                                                    fontSize="xs"
                                                                    color={
                                                                        labelColor
                                                                    }
                                                                    lineClamp={1}
                                                                >
                                                                    UR:{" "}
                                                                    {
                                                                        patient.ur_number
                                                                    }
                                                                </Text>
                                                            </Box>
                                                        )}
                                                    </Flex>

                                                    {!isCollapsed &&
                                                        isHovered && (
                                                            <IconButton
                                                                size="xs"
                                                                aria-label="Delete patient"
                                                                variant="ghost"
                                                                colorPalette="red"
                                                                onClick={(
                                                                    e,
                                                                ) => {
                                                                    e.stopPropagation();
                                                                    onDeletePatient(
                                                                        patient,
                                                                    );
                                                                }}
                                                            >
                                                                <DeleteIcon />
                                                            </IconButton>
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
                                    {isCollapsed
                                        ? "No pts"
                                        : "No patients available"}
                                </Text>
                            )}
                        </Box>
                    </Collapsible.Content>
                </Collapsible.Root>
            </Box>
        </Box>
    );
};

export default SidebarPatientList;
