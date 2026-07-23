import {
    Box,
    Flex,
    Avatar,
    Text,
    IconButton,
    Input,
    Icon,
    Collapsible,
    VStack,
} from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { useState } from "react";
import { FaClinicMedical } from "react-icons/fa";
import { DeleteIcon, ChevronDownIcon, ChevronUpIcon } from "../common/icons";
import { getInitials, getAvatarColor } from "./SidebarHelpers";
import { colors } from "../../theme/colors";
import { isTauri } from "../../utils/helpers/apiConfig";

const SidebarPatientList = ({
    patients,
    onSelectPatient,
    onDeletePatient,
    isCollapsed,
    selectedPatientId,
    selectedDate,
    setSelectedDate,
    onShowSummary,
}) => {
    const [isPatientsCollapsed, setIsPatientsCollapsed] = useState(false);
    const [hoveredPatientId, setHoveredPatientId] = useState(null);
    const labelColor = colors.dark.textSecondary;

    return (
        <Box w="100%" h="100%" display="flex" flexDirection="column" minH="0">
            {/* Patient List heading — whole row toggles the section */}
            {!isCollapsed && (
                <Tooltip
                    content="Toggle patient list"
                    positioning={{ placement: "top" }} openDelay={700}
                >
                <Flex
                    pt={2}
                    pb={1}
                    flexShrink={0}
                    align="center"
                    justify="space-between"
                    cursor="pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => setIsPatientsCollapsed(!isPatientsCollapsed)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setIsPatientsCollapsed(!isPatientsCollapsed);
                        }
                    }}
                    _hover={{ color: "textTertiary" }}
                    _active={{ transform: "scale(0.98)" }}
                    _focusVisible={{
                        outline: "2px solid",
                        outlineColor: "accent",
                        outlineOffset: "2px",
                    }}
                    transition="transform 0.1s ease, background 0.15s ease"
                >
                    <Text
                        fontSize="10px"
                        fontWeight="700"
                        letterSpacing="0.15em"
                        textTransform="uppercase"
                        color={labelColor}
                        whiteSpace="nowrap"
                    >
                        Patient List
                    </Text>
                    <IconButton
                        variant="ghost"
                        size="xs"
                        minW="auto"
                        h="auto"
                        p={0.5}
                        color={colors.dark.textPrimary}
                        _hover={{ bg: "rgba(184, 192, 224, 0.1)" }}
                        aria-label={
                            isPatientsCollapsed
                                ? "Expand patients"
                                : "Collapse patients"
                        }
                        pointerEvents="none"
                    >
                        {isPatientsCollapsed ? (
                            <ChevronDownIcon />
                        ) : (
                            <ChevronUpIcon />
                        )}
                    </IconButton>
                </Flex>
                </Tooltip>
            )}
            <Collapsible.Root
                open={isCollapsed || !isPatientsCollapsed}
                flex="1"
                minH="0"
                display="flex"
                flexDirection="column"
            >
                <Collapsible.Content
                    flex="1"
                    minH="0"
                    display="flex"
                    flexDirection="column"
                >
                    {/* Clinic date — pinned at the top of the section */}
                    {!isCollapsed && (
                        <Tooltip
                            content="Clinic date — filters the patient list"
                            positioning={{ placement: "top" }} openDelay={700}
                        >
                            <Input
                                type="date"
                                value={selectedDate || ""}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                size="sm"
                                borderRadius="md"
                                className="clinic-date-input"
                                w="100%"
                                mb={2}
                                flexShrink={0}
                            />
                        </Tooltip>
                    )}
                    {/* Patient list — the only part that scrolls */}
                    <Box
                        flex="1"
                        minH="0"
                        overflowY="auto"
                        overflowX="hidden"
                        className={
                            isTauri()
                                ? "custom-scrollbar"
                                : "sidebar-scroll-overlay"
                        }
                    >
                        {patients.length > 0 ? (
                            <VStack
                                gap={isCollapsed ? "3" : "2"}
                                align="stretch"
                                w="100%"
                                py={isCollapsed ? "2" : "0"}
                            >
                                {patients.map((patient) => {
                                    const initials = getInitials(patient.name);
                                    const avatarBg = getAvatarColor(
                                        patient.name,
                                    );
                                    const isHovered =
                                        hoveredPatientId === patient.id;
                                    const isSelected =
                                        patient.id === selectedPatientId;

                                    return (
                                        <Tooltip
                                            key={patient.id}
                                            content={
                                                isCollapsed ? patient.name : ""
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
                                                    if (
                                                        e.key === "Enter" ||
                                                        e.key === " "
                                                    ) {
                                                        e.preventDefault();
                                                        onSelectPatient(
                                                            patient,
                                                        );
                                                    }
                                                }}
                                                onMouseEnter={() =>
                                                    setHoveredPatientId(
                                                        patient.id,
                                                    )
                                                }
                                                onMouseLeave={() =>
                                                    setHoveredPatientId(null)
                                                }
                                                bg={
                                                    isSelected
                                                        ? "primaryButtonFaint"
                                                        : isHovered
                                                          ? "rgba(184, 192, 224, 0.1)"
                                                          : "transparent"
                                                }
                                                boxShadow={
                                                    isSelected
                                                        ? "inset 3px 0 0 var(--chakra-colors-primaryButton)"
                                                        : undefined
                                                }
                                                transition="transform 0.1s ease, background 0.15s ease"
                                                _active={{
                                                    transform: "scale(0.98)",
                                                }}
                                                _focusVisible={{
                                                    outline: "2px solid",
                                                    outlineColor: "accent",
                                                    outlineOffset: "2px",
                                                }}
                                                className="patient-list-item"
                                            >
                                                <Flex
                                                    align="center"
                                                    minW="0"
                                                    flex="1"
                                                >
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
                                                                lineClamp={1}
                                                            >
                                                                {patient.name}
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

                                                {!isCollapsed && isHovered && (
                                                    <Tooltip
                                                        content="Remove patient"
                                                        positioning={{
                                                            placement: "top",
                                                        }}
                                                        openDelay={700}
                                                    >
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
                                                            }}
                                                        >
                                                            <DeleteIcon />
                                                        </IconButton>
                                                    </Tooltip>
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
                    {/* Day Summary — pinned at the bottom of the section */}
                    {!isCollapsed && patients.length > 0 && (
                        <Tooltip
                            content="Open the selected day's summary"
                            positioning={{ placement: "top" }} openDelay={700}
                        >
                        <Flex
                            align="center"
                            gap={1.5}
                            w="fit-content"
                            mx="auto"
                            px={3}
                            py={1}
                            mt={2}
                            flexShrink={0}
                            borderRadius="full"
                            bg={colors.dark.surface}
                            color={colors.dark.textPrimary}
                            cursor="pointer"
                            role="button"
                            tabIndex={0}
                            onClick={onShowSummary}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    onShowSummary();
                                }
                            }}
                            _hover={{ bg: colors.dark.surface1 }}
                            _active={{ transform: "scale(0.98)" }}
                            _focusVisible={{
                                outline: "2px solid",
                                outlineColor: "accent",
                                outlineOffset: "2px",
                            }}
                            transition="transform 0.1s ease, background 0.15s ease"
                        >
                            <Icon as={FaClinicMedical} boxSize={3} />
                            <Text
                                fontSize="sm"
                                fontWeight="medium"
                                whiteSpace="nowrap"
                            >
                                Day Summary
                            </Text>
                        </Flex>
                        </Tooltip>
                    )}
                </Collapsible.Content>
            </Collapsible.Root>
        </Box>
    );
};

export default SidebarPatientList;
