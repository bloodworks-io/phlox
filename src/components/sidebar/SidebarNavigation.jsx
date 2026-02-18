import {
  Box,
  Tooltip,
  VStack,
  Flex,
  Icon,
  Text,
  Badge,
} from "@chakra-ui/react";
import { FaClinicMedical, FaTasks } from "react-icons/fa";
import { GiBrain } from "react-icons/gi";
import { SettingsIcon } from "@chakra-ui/icons";
import { colors } from "../../theme/colors";
import { isChatEnabled } from "../../utils/helpers/featureFlags";

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
      onClick={onClick}
      _hover={{ bg: colors.dark.sidebar.hover }}
      justify={isCollapsed ? "center" : "flex-start"}
      position="relative"
    >
      {isCollapsed && badge ? (
        // For collapsed mode with badge, show the badge instead of the icon
        <Badge
          bg="red.500"
          color="white"
          borderRadius="full"
          px={1.5}
          py={0}
          fontSize="xs"
        >
          {badge}
        </Badge>
      ) : (
        // Show the regular icon if no badge or not collapsed
        <Icon
          as={icon}
          color={color}
          boxSize={isCollapsed ? 4 : 5}
          mr={isCollapsed ? 0 : 3}
        />
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
              bg="red.500"
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
  return (
    <Box w="100%">
      <VStack
        spacing={isCollapsed ? 0 : 1}
        align="stretch"
        w="100%"
        py={isCollapsed ? 1 : 2}
      >
        {/* Day Summary button */}
        <Tooltip
          label="Day Summary"
          placement={isCollapsed ? "right" : "top"}
          isDisabled={!isCollapsed}
        >
          <Box>
            <NavButton
              icon={FaClinicMedical}
              color={colors.dark.primaryButton}
              label="Day Summary"
              onClick={() => handleNavigation("/clinic-summary")}
              isCollapsed={isCollapsed}
            />
          </Box>
        </Tooltip>

        {/* All Jobs button */}
        <Tooltip
          label={
            isCollapsed && incompleteJobsCount > 0
              ? `All Jobs (${incompleteJobsCount})`
              : "All Jobs"
          }
          placement={isCollapsed ? "right" : "top"}
          isDisabled={!isCollapsed}
        >
          <Box>
            <NavButton
              icon={FaTasks}
              color={colors.dark.neutralButton}
              label="All Jobs"
              onClick={() => handleNavigation("/outstanding-jobs")}
              isCollapsed={isCollapsed}
              badge={incompleteJobsCount > 0 ? incompleteJobsCount : null}
            />
          </Box>
        </Tooltip>

        {/* Documents button */}
        {isChatEnabled() && (
          <Tooltip
            label="Documents"
            placement={isCollapsed ? "right" : "top"}
            isDisabled={!isCollapsed}
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
          label="Settings"
          placement={isCollapsed ? "right" : "top"}
          isDisabled={!isCollapsed}
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
    </Box>
  );
};

export default SidebarNavigation;
