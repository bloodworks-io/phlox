import { Box, VStack, Flex, Icon, Text, Badge, Switch } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import {
    FaTasks,
    FaNotesMedical,
    FaBrain,
    FaCog,
    FaUser,
    FaUsers,
} from "react-icons/fa";
import { useLocation } from "react-router";
import { colors } from "../../theme/colors";
import { isRagEnabled } from "../../utils/helpers/featureFlags";

const NavButton = ({
    icon,
    label,
    onClick,
    isCollapsed,
    badge = null,
    isActive = false,
    accent,
}) => {
    const iconColor = isActive
        ? colors.dark.primaryButton
        : accent
          ? accent
          : colors.dark.overlay2;
    const labelColor = isActive
        ? colors.dark.primaryButton
        : accent
          ? accent
          : colors.dark.textPrimary;
    const weight = isActive || accent ? "600" : "medium";
    return (
        <Flex
            w="100%"
            pr="2"
            py="1.5"
            align="center"
            borderRadius="md"
            cursor="pointer"
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClick();
                }
            }}
            bg={isActive ? "primaryButtonFaint" : undefined}
            boxShadow={
                isActive
                    ? "inset 3px 0 0 var(--chakra-colors-primaryButton)"
                    : undefined
            }
            _hover={{
                bg: isActive
                    ? "primaryButtonHalftone"
                    : colors.dark.sidebar.hover,
            }}
            _active={{ transform: "scale(0.98)" }}
            _focusVisible={{
                outline: "2px solid",
                outlineColor: "accent",
                outlineOffset: "2px",
            }}
            transition="transform 0.1s ease, background 0.15s ease"
            justify="flex-start"
            position="relative"
        >
            <Flex
                ml="14px"
                align="center"
                minW="0"
                flex="1"
                overflow={isCollapsed ? "visible" : "hidden"}
            >
                {isCollapsed && badge ? (
                    <Badge
                        bg="dangerButton"
                        color="white"
                        borderRadius="full"
                        px={1.5}
                        fontSize="xs"
                        ml="-3px"
                        height="22px"
                    >
                        {badge}
                    </Badge>
                ) : (
                    <Icon
                        as={icon}
                        color={iconColor}
                        boxSize={5}
                        mr={isCollapsed ? 0 : 3}
                    />
                )}
                {!isCollapsed && (
                    <Flex align="center" flexShrink={0}>
                        <Text
                            fontWeight={weight}
                            fontSize="sm"
                            color={labelColor}
                            whiteSpace="nowrap"
                        >
                            {label}
                        </Text>

                        {badge && (
                            <Badge
                                ml={2}
                                bg="dangerButton"
                                color="white"
                                borderRadius="full"
                                px={1.5}
                                fontSize="xs"
                            >
                                {badge}
                            </Badge>
                        )}
                    </Flex>
                )}
            </Flex>
        </Flex>
    );
};

const SidebarNavigation = ({
    isCollapsed,
    handleNavigation,
    incompleteJobsCount,
    onNewPatient,
    isAdmin,
    patientScope,
    onTogglePatientScope,
}) => {
    const location = useLocation();
    const isActive = (to) =>
        location.pathname === to || location.pathname.startsWith(`${to}/`);

    return (
        <VStack gap="1" align="stretch" w="100%" py="1">
            <Tooltip
                content="Start a new clinical note"
                positioning={{ placement: isCollapsed ? "right" : "top" }} openDelay={700}
            >
                <Box>
                    <NavButton
                        icon={FaNotesMedical}
                        label="New Note"
                        onClick={onNewPatient}
                        isCollapsed={isCollapsed}
                        accent={colors.dark.brand}
                        isActive={isActive("/new-note")}
                    />
                </Box>
            </Tooltip>

            <Tooltip
                content="Outstanding clinic jobs"
                positioning={{ placement: isCollapsed ? "right" : "top" }} openDelay={700}
            >
                <Box>
                    <NavButton
                        icon={FaTasks}
                        label="All Jobs"
                        onClick={() => handleNavigation("/outstanding-jobs")}
                        isCollapsed={isCollapsed}
                        badge={
                            incompleteJobsCount > 0 ? incompleteJobsCount : null
                        }
                        isActive={isActive("/outstanding-jobs")}
                    />
                </Box>
            </Tooltip>

            {isRagEnabled() && (
                <Tooltip
                    content="Knowledge base & uploaded documents"
                    positioning={{ placement: isCollapsed ? "right" : "top" }} openDelay={700}
                >
                    <Box mb={isCollapsed ? "1px" : "0px"}>
                        <NavButton
                            icon={FaBrain}
                            label="Documents"
                            onClick={() => handleNavigation("/rag")}
                            isCollapsed={isCollapsed}
                            isActive={isActive("/rag")}
                        />
                    </Box>
                </Tooltip>
            )}

            <Tooltip
                content="Models, templates & preferences"
                positioning={{ placement: isCollapsed ? "right" : "top" }} openDelay={700}
            >
                <Box>
                    <NavButton
                        icon={FaCog}
                        label="Settings"
                        onClick={() => handleNavigation("/settings")}
                        isCollapsed={isCollapsed}
                        isActive={isActive("/settings")}
                    />
                </Box>
            </Tooltip>

            {isAdmin && (
                <Tooltip
                    content="Show all users' patients or just your own"
                    positioning={{ placement: isCollapsed ? "right" : "top" }} openDelay={700}
                >
                    <Flex
                        w="100%"
                        pr="2"
                        py="1.5"
                        align="center"
                        borderRadius="md"
                        cursor="pointer"
                        role="button"
                        tabIndex={0}
                        aria-label="Toggle between all users' patients and your own"
                        onClick={onTogglePatientScope}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onTogglePatientScope();
                            }
                        }}
                        _hover={{ bg: colors.dark.sidebar.hover }}
                        _active={{ transform: "scale(0.98)" }}
                        _focusVisible={{
                            outline: "2px solid",
                            outlineColor: "accent",
                            outlineOffset: "2px",
                        }}
                        transition="transform 0.1s ease, background 0.15s ease"
                    >
                        <Flex
                            ml="14px"
                            align="center"
                            minW="0"
                            flex="1"
                            overflow={isCollapsed ? "visible" : "hidden"}
                        >
                            <Icon
                                as={patientScope === "mine" ? FaUser : FaUsers}
                                color={colors.dark.overlay2}
                                boxSize={5}
                                mr={isCollapsed ? 0 : 3}
                            />
                            {!isCollapsed && (
                                <Text
                                    fontWeight="medium"
                                    fontSize="sm"
                                    color={colors.dark.textPrimary}
                                    whiteSpace="nowrap"
                                >
                                    All Patients
                                </Text>
                            )}
                        </Flex>
                        {!isCollapsed && (
                            <Switch.Root
                                size="sm"
                                mr="2"
                                checked={patientScope === "all"}
                                onCheckedChange={onTogglePatientScope}
                                pointerEvents="none"
                            >
                                <Switch.HiddenInput />
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                            </Switch.Root>
                        )}
                    </Flex>
                </Tooltip>
            )}
        </VStack>
    );
};

export default SidebarNavigation;
