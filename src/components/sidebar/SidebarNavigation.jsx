import { Box, VStack, Flex, Icon, Text, Badge, Collapsible } from "@chakra-ui/react";
import { Tooltip } from '@/components/ui/tooltip';
import { FaClinicMedical, FaTasks } from "react-icons/fa";
import { GiBrain } from "react-icons/gi";
import { SettingsIcon } from "../common/icons";
import { colors } from "../../theme/colors";
import { isRagEnabled } from "../../utils/helpers/featureFlags";
import { SectionHeader } from "./SidebarHelpers";
import { useState } from "react";

const NavButton = ({
    icon,
    label,
    onClick,
    isCollapsed,
    badge = null,
    color,
}) => {
    return (
        <Flex
            w="100%"
            px={isCollapsed ? 2 : 3}
            py={isCollapsed ? 1.5 : 2}
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
            _hover={{ bg: colors.dark.sidebar.hover }}
            _active={{ transform: "scale(0.98)" }}
            _focusVisible={{ outline: "2px solid", outlineColor: "accent", outlineOffset: "2px" }}
            transition="transform 0.1s ease, background 0.15s ease"
            justify={isCollapsed ? "center" : "flex-start"}
            position="relative"
        >
            {isCollapsed && badge ? (
                // For collapsed mode with badge, show the badge instead of the icon
                (<Badge
                    bg="dangerButton"
                    color="white"
                    borderRadius="full"
                    px={1.5}
                    py={0}
                    fontSize="xs"
                >
                    {badge}
                </Badge>)
            ) : (
                // Show the regular icon if no badge or not collapsed
                (<Icon
                    as={icon}
                    color={color}
                    boxSize={isCollapsed ? 4 : 5}
                    mr={isCollapsed ? 0 : 3}
                />)
            )}
            {!isCollapsed && (
                <Flex align="center">
                    <Text fontWeight="medium" color={colors.dark.textPrimary}>
                        {label}
                    </Text>

                    {/* Show badge next to text in expanded view */}
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
    );
};

const SidebarNavigation = ({
    isCollapsed,
    handleNavigation,
    incompleteJobsCount,
}) => {
    const [isNavCollapsed, setIsNavCollapsed] = useState(false);

    return (
        <Box w="100%">
            {/* Navigation Header - Collapsible when expanded */}
            {!isCollapsed && (
                <SectionHeader
                    title="NAVIGATION"
                    count={null}
                    isCollapsed={isNavCollapsed}
                    onToggle={() => setIsNavCollapsed(!isNavCollapsed)}
                />
            )}
            {/* Navigation Items */}
            <Collapsible.Root open={isCollapsed || !isNavCollapsed}>
                <Collapsible.Content>
                    <VStack
                        gap={isCollapsed ? 0 : 1}
                        align="stretch"
                        w="100%"
                        py={isCollapsed ? 1 : 2}
                    >
                        {/* Day Summary button */}
                        <Tooltip
                            content="Day Summary"
                            disabled={!isCollapsed}
                            positioning={{
                                placement: isCollapsed ? "right" : "top"
                            }}
                        >
                            <Box>
                                <NavButton
                                    icon={FaClinicMedical}
                                    color={colors.dark.primaryButton}
                                    label="Day Summary"
                                    onClick={() =>
                                        handleNavigation("/clinic-summary")
                                    }
                                    isCollapsed={isCollapsed}
                                />
                            </Box>
                        </Tooltip>

                        {/* All Jobs button */}
                        <Tooltip
                            content={
                                isCollapsed && incompleteJobsCount > 0
                                    ? `All Jobs (${incompleteJobsCount})`
                                    : "All Jobs"
                            }
                            disabled={!isCollapsed}
                            positioning={{
                                placement: isCollapsed ? "right" : "top"
                            }}
                        >
                            <Box>
                                <NavButton
                                    icon={FaTasks}
                                    color={colors.dark.neutralButton}
                                    label="All Jobs"
                                    onClick={() =>
                                        handleNavigation("/outstanding-jobs")
                                    }
                                    isCollapsed={isCollapsed}
                                    badge={
                                        incompleteJobsCount > 0
                                            ? incompleteJobsCount
                                            : null
                                    }
                                />
                            </Box>
                        </Tooltip>

                        {/* Documents button */}
                        {isRagEnabled() && (
                            <Tooltip
                                content="Documents"
                                disabled={!isCollapsed}
                                positioning={{
                                    placement: isCollapsed ? "right" : "top"
                                }}
                            >
                                <Box>
                                    <NavButton
                                        icon={GiBrain}
                                        color={colors.dark.chatIcon}
                                        label="Documents"
                                        onClick={() => handleNavigation("/rag")}
                                        isCollapsed={isCollapsed}
                                    />
                                </Box>
                            </Tooltip>
                        )}

                        {/* Settings button */}
                        <Tooltip
                            content="Settings"
                            disabled={!isCollapsed}
                            positioning={{
                                placement: isCollapsed ? "right" : "top"
                            }}
                        >
                            <Box>
                                <NavButton
                                    icon={SettingsIcon}
                                    color={colors.dark.extraButton}
                                    label="Settings"
                                    onClick={() => handleNavigation("/settings")}
                                    isCollapsed={isCollapsed}
                                />
                            </Box>
                        </Tooltip>
                    </VStack>
                </Collapsible.Content>
            </Collapsible.Root>
        </Box>
    );
};

export default SidebarNavigation;
