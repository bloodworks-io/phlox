import { Box, VStack, Flex, Icon, Text, Badge } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { FaTasks, FaNotesMedical, FaBrain, FaCog } from "react-icons/fa";
import { useLocation } from "react-router";
import { isRagEnabled } from "../../utils/helpers/featureFlags";

const NavButton = ({
    icon,
    label,
    onClick,
    isCollapsed,
    badge = null,
    isActive = false,
    accent = false,
}) => {
    const ink = isActive
        ? "folio.selectionInk"
        : accent
          ? "folio.brandOnSidebar"
          : "folio.sidebarMuted";
    const weight = isActive || accent ? "600" : "medium";
    return (
        <Flex
            w="100%"
            pr="2"
            py="1.5"
            align="center"
            borderRadius="folioControl"
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
            color={ink}
            bg={isActive ? "folio.selection" : undefined}
            boxShadow={
                isActive ? "inset 2px 0 0 var(--chakra-colors-folio-accent)" : undefined
            }
            _hover={{
                bg: isActive ? "folio.selection" : "folio.sidebarAlt",
                color: isActive ? "folio.selectionInk" : "folio.sidebarInk",
            }}
            _focusVisible={{
                outline: "2px solid",
                outlineColor: "folio.brandOnSidebar",
                outlineOffset: "2px",
            }}
            transition="background-color 160ms ease, color 160ms ease"
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
                        bg="folio.danger"
                        color="folio.badgeInk"
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
                        color="currentColor"
                        boxSize={5}
                        mr={isCollapsed ? 0 : 3}
                    />
                )}
                {!isCollapsed && (
                    <Flex align="center" flexShrink={0}>
                        <Text
                            fontWeight={weight}
                            fontSize="sm"
                            color="currentColor"
                            whiteSpace="nowrap"
                        >
                            {label}
                        </Text>

                        {badge && (
                            <Badge
                                ml={2}
                                bg="folio.danger"
                                color="folio.badgeInk"
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
}) => {
    const location = useLocation();
    const { t } = useTranslation();
    const isActive = (to) =>
        location.pathname === to || location.pathname.startsWith(`${to}/`);

    return (
        <VStack gap="1" align="stretch" w="100%" py="1">
            <Tooltip
                content={t("nav.newNote.tooltip")}
                positioning={{ placement: isCollapsed ? "right" : "top" }} openDelay={700}
            >
                <Box>
                    <NavButton
                        icon={FaNotesMedical}
                        label={t("nav.newNote.label")}
                        onClick={onNewPatient}
                        isCollapsed={isCollapsed}
                        accent
                        isActive={isActive("/new-note")}
                    />
                </Box>
            </Tooltip>

            <Tooltip
                content={t("nav.allJobs.tooltip")}
                positioning={{ placement: isCollapsed ? "right" : "top" }} openDelay={700}
            >
                <Box>
                    <NavButton
                        icon={FaTasks}
                        label={t("nav.allJobs.label")}
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
                    content={t("nav.documents.tooltip")}
                    positioning={{ placement: isCollapsed ? "right" : "top" }} openDelay={700}
                >
                    <Box mb={isCollapsed ? "1px" : "0px"}>
                        <NavButton
                            icon={FaBrain}
                            label={t("page.rag.title")}
                            onClick={() => handleNavigation("/rag")}
                            isCollapsed={isCollapsed}
                            isActive={isActive("/rag")}
                        />
                    </Box>
                </Tooltip>
            )}

            <Tooltip
                content={t("nav.settings.tooltip")}
                positioning={{ placement: isCollapsed ? "right" : "top" }} openDelay={700}
            >
                <Box>
                    <NavButton
                        icon={FaCog}
                        label={t("page.settings.title")}
                        onClick={() => handleNavigation("/settings")}
                        isCollapsed={isCollapsed}
                        isActive={isActive("/settings")}
                    />
                </Box>
            </Tooltip>
        </VStack>
    );
};

export default SidebarNavigation;
