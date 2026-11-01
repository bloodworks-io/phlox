import {
    Box,
    Flex,
    Avatar,
    Text,
    IconButton,
    Input,
    Icon,
    Collapsible,
    Switch,
    VStack,
} from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import useSWR from "swr";
import { LuHospital, LuSmartphone, LuUser, LuUsers } from "react-icons/lu";
import { DeleteIcon, ChevronDownIcon, ChevronUpIcon } from "../common/icons";
import { getInitials, getAvatarColor } from "./SidebarHelpers";
import { isTauri } from "../../utils/helpers/apiConfig";
import { companionApi } from "../../utils/api/companionApi";
import { KEYS } from "../../utils/cache/keys";

const SidebarPatientList = ({
    patients,
    onSelectPatient,
    onDeletePatient,
    isCollapsed,
    selectedPatientId,
    selectedDate,
    setSelectedDate,
    onShowSummary,
    onOpenCompanionImport,
    isAdmin,
    patientScope,
    onTogglePatientScope,
}) => {
    const [isPatientsCollapsed, setIsPatientsCollapsed] = useState(false);
    const [hoveredPatientId, setHoveredPatientId] = useState(null);
    const { t } = useTranslation();
    const labelColor = "folio.sidebarMuted";

    const { data: companionStatus } = useSWR(
        onOpenCompanionImport ? KEYS.COMPANION_STATUS : null,
        companionApi.fetchStatus,
        { revalidateOnFocus: true, refreshInterval: 30000 },
    );

    return (
        <Box w="100%" h="100%" display="flex" flexDirection="column" minH="0">
            {/* Patient List heading — whole row toggles the section */}
            {!isCollapsed && (
                <Flex
                    pt={3}
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
                    _hover={{ color: "folio.sidebarInk" }}
                    _focusVisible={{
                        outline: "2px solid",
                        outlineColor: "folio.brandOnSidebar",
                        outlineOffset: "2px",
                    }}
                    transition="background-color 160ms ease, color 160ms ease"
                >
                    <Flex align="center" gap={1} minW="0">
                        <Text
                            fontSize="10px"
                            fontWeight="700"
                            letterSpacing="0.15em"
                            textTransform="uppercase"
                            color={labelColor}
                            whiteSpace="nowrap"
                        >
                            {t("sidebar.patientList.heading")}
                        </Text>
                    </Flex>
                    <Flex align="center" gap={1}>
                        {isTauri() && companionStatus?.enabled && onOpenCompanionImport && (
                            <Tooltip
                                content={t("sidebar.patientList.companionTooltip")}
                                positioning={{ placement: "top" }}
                                openDelay={700}
                            >
                                <Flex
                                    align="center"
                                    position="relative"
                                    color={labelColor}
                                    _hover={{ color: "folio.accent" }}
                                    cursor="pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenCompanionImport();
                                    }}
                                    onKeyDown={(e) => e.stopPropagation()}
                                >
                                    <Icon aria-label={t("sidebar.patientList.companionTooltip")}>
                                        <LuSmartphone size={11} strokeWidth={1.6} />
                                    </Icon>
                                </Flex>
                            </Tooltip>
                        )}
                        {isAdmin && (
                             <Tooltip
                                 content={t("sidebar.patientList.scopeTooltip")}
                                positioning={{ placement: "top" }}
                                openDelay={700}
                            >
                                <Flex
                                    align="center"
                                    gap={0.5}
                                    color={labelColor}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                >
                                    <LuUser strokeWidth={1.6}
                                        size={8}
                                        color={
                                            patientScope === "mine"
                                                ? "var(--chakra-colors-folio-accent)"
                                                : undefined
                                        }
                                    />
                                    <Switch.Root
                                        size="xs"
                                        checked={patientScope === "all"}
                                        onCheckedChange={() =>
                                            onTogglePatientScope()
                                        }
                                        aria-label={t(
                                            "sidebar.patientList.scopeAriaLabel",
                                        )}
                                    >
                                        <Switch.HiddenInput />
                                        <Switch.Control
                                            bg="folio.sidebarAlt"
                                            _checked={{
                                                bg: "folio.accent",
                                            }}
                                            _focusVisible={{
                                                outline: "2px solid",
                                                outlineColor: "folio.brandOnSidebar",
                                                outlineOffset: "2px",
                                            }}
                                        >
                                            <Switch.Thumb />
                                        </Switch.Control>
                                    </Switch.Root>
                                    <LuUsers strokeWidth={1.6}
                                        size={12}
                                        color={
                                            patientScope === "all"
                                                ? "var(--chakra-colors-folio-accent)"
                                                : undefined
                                        }
                                    />
                                </Flex>
                            </Tooltip>
                        )}
                        <IconButton
                        variant="ghost"
                        size="xs"
                        minW="auto"
                        h="auto"
                        p={0.5}
                         color="folio.sidebarInk"
                         _hover={{ bg: "folio.sidebarAlt" }}
                         aria-label={
                             isPatientsCollapsed
                                 ? t("sidebar.patientList.expandAriaLabel")
                                 : t("sidebar.patientList.collapseAriaLabel")
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
                </Flex>
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
                            content={t("sidebar.patientList.clinicDateTooltip")}
                            positioning={{ placement: "top" }} openDelay={700}
                        >
                            <Input
                                type="date"
                                value={selectedDate || ""}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                size="sm"
                                aria-label={t(
                                    "sidebar.patientList.clinicDateTooltip",
                                )}
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
                                                borderRadius="folioControl"
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
                                                        ? "folio.selection"
                                                        : isHovered
                                                          ? "folio.sidebarAlt"
                                                          : "transparent"
                                                }
                                                boxShadow={
                                                    isSelected
                                                        ? "inset 2px 0 0 var(--chakra-colors-folio-accent)"
                                                        : undefined
                                                }
                                                transition="background-color 160ms ease"
                                                _focusVisible={{
                                                    outline: "2px solid",
                                                    outlineColor: "folio.brandOnSidebar",
                                                    outlineOffset: "2px",
                                                }}
                                                className={`patient-list-item${
                                                    isSelected ? " selected" : ""
                                                }`}
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
                                                                lineClamp={1}
                                                            >
                                                                 {t(
                                                                     "sidebar.patientList.ur",
                                                                     {
                                                                         ur: patient.ur_number,
                                                                     },
                                                                 )}
                                                             </Text>
                                                        </Box>
                                                    )}
                                                </Flex>

                                                {!isCollapsed && isHovered && (
                                                     <Tooltip
                                                         content={t(
                                                            "sidebar.patientList.removeTooltip",
                                                        )}
                                                        positioning={{
                                                            placement: "top",
                                                        }}
                                                        openDelay={700}
                                                    >
                                                        <IconButton
                                                            size="xs"
                                                             aria-label={t(
                                                                 "sidebar.patientList.deleteAriaLabel",
                                                             )}
                                                            variant="ghost"
                                                            color="folio.danger"
                                                            _hover={{
                                                                bg: "folio.dangerSoft",
                                                                color: "folio.danger",
                                                            }}
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
                                     ? t("sidebar.patientList.noPts")
                                     : t("sidebar.patientList.noPatients")}
                            </Text>
                        )}
                    </Box>
                    {/* Day Summary — pinned at the bottom of the section */}
                    {!isCollapsed && patients.length > 0 && (
                         <Tooltip
                             content={t(
                                 "sidebar.patientList.daySummaryTooltip",
                             )}
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
                             borderRadius="folioControl"
                             bg="folio.sidebarAlt"
                             color="folio.sidebarInk"
                             border="1px solid"
                             borderColor="folio.line"
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
                             _hover={{ bg: "folio.sidebar" }}
                             _focusVisible={{
                                 outline: "2px solid",
                                 outlineColor: "folio.brandOnSidebar",
                                 outlineOffset: "2px",
                             }}
                             transition="background-color 160ms ease"
                         >
                            <Icon as={LuHospital} boxSize={3} />
                            <Text
                                fontSize="sm"
                                fontWeight="medium"
                                whiteSpace="nowrap"
                            >
                                {t("sidebar.patientList.daySummary")}
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
