import {
    Flex,
    Avatar,
    Text,
    IconButton,
    Box,
    useColorModeValue,
} from "@chakra-ui/react";
import { ChevronDownIcon, ChevronUpIcon } from "@chakra-ui/icons";
import { colors } from "../../theme/colors";

export const getAvatarColor = (name) => {
    // Catppuccin Frappé colors
    const catppuccinColors = [
        "#f2d5cf", // Rosewater
        "#eebebe", // Flamingo
        "#f4b8e4", // Pink
        "#ca9ee6", // Mauve
        "#e78284", // Red
        "#ea999c", // Maroon
        "#ef9f76", // Peach
        "#e5c890", // Yellow
        "#a6d189", // Green
        "#81c8be", // Teal
        "#99d1db", // Sky
        "#85c1dc", // Sapphire
        "#8caaee", // Blue
        "#babbf1", // Lavender
    ];

    // Simple hash function for the name
    let hash = 0;
    if (name) {
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
    }

    // Get a consistent color from the array
    const index = Math.abs(hash) % catppuccinColors.length;
    return catppuccinColors[index];
};

export const getInitials = (name) => {
    // Check if name is in "Last, First" format
    if (name.includes(",")) {
        const [lastName, firstName] = name
            .split(",")
            .map((part) => part.trim());
        return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }

    // Fallback for "First Last" format
    const nameParts = name.split(" ");
    return nameParts.length > 1
        ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
        : nameParts[0].slice(0, 2).toUpperCase();
};

export const SectionHeader = ({ title, count, isCollapsed, onToggle }) => {
    const labelColor = colors.dark.textSecondary;

    return (
        <Flex
            w="100%"
            justifyContent="space-between"
            alignItems="center"
            onClick={onToggle}
            cursor="pointer"
            _hover={{ color: "gray.600" }}
            mt="2"
        >
            <Text fontSize="xs" fontWeight="medium" color={labelColor}>
                {title} {count > 0 ? `(${count})` : ""}
            </Text>
            <IconButton
                icon={isCollapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
                variant="ghost"
                size="xs"
                color={colors.dark.textPrimary}
                _hover={{
                    bg: `rgba(184, 192, 224, 0.1)`,
                }}
                aria-label={isCollapsed ? "Expand section" : "Collapse section"}
            />
        </Flex>
    );
};

export const AvatarButton = ({
    icon,
    backgroundColor,
    label,
    onClick,
    isCollapsed,
    badge = null,
}) => {
    const sidebarBg = colors.dark.sidebar.background;

    return (
        <Flex
            w="100%"
            justifyContent={isCollapsed ? "center" : "flex-start"}
            position="relative"
        >
            <Flex
                align="center"
                p={isCollapsed ? "1.5" : "2"}
                borderRadius="lg"
                role="group"
                cursor="pointer"
                w={isCollapsed ? "auto" : "100%"}
                onClick={onClick}
                className="avatar-button"
                _hover={{
                    bg: `rgba(184, 192, 224, 0.1)`,
                }}
                transition="all 0.2s"
            >
                <Box position="relative">
                    <Avatar
                        icon={icon}
                        bg={backgroundColor}
                        color="white"
                        size={isCollapsed ? "sm" : "sm"}
                        mr={isCollapsed ? "0" : "3"}
                    />

                    {badge && (
                        <Box
                            position="absolute"
                            top="-2px"
                            right={isCollapsed ? "-5px" : "-8px"}
                            borderRadius="full"
                            bg="red.500"
                            color="white"
                            fontSize="0.6rem"
                            p="1px 5px"
                            boxShadow={`0 0 0 2px ${sidebarBg}`}
                        >
                            {badge}
                        </Box>
                    )}
                </Box>

                {!isCollapsed && (
                    <Text fontWeight="medium" color={colors.dark.textPrimary}>
                        {label}
                    </Text>
                )}
            </Flex>
        </Flex>
    );
};

export default {
    getAvatarColor,
    getInitials,
    SectionHeader,
    AvatarButton,
};
