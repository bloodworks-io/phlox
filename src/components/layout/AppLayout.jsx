import { Box, Flex, IconButton } from "@chakra-ui/react";
import Sidebar from "../sidebar/Sidebar";
import CollapseIcon from "../common/icons/CollapseIcon";
import { isTauri } from "../../utils/helpers/apiConfig";

const AppLayout = ({
    isSmallScreen,
    isCollapsed,
    toggleSidebar,
    sidebarProps,
    children,
}) => {
    return (
        <Flex position="relative">
            {/* Floating hamburger button for small screens */}
            {isSmallScreen && isCollapsed && (
                <IconButton
                    onClick={toggleSidebar}
                    position="fixed"
                    top="6"
                    left="6"
                    zIndex="101"
                    aria-label="Toggle sidebar"
                    className="dark-toggle"
                >
                    <CollapseIcon />
                </IconButton>
            )}
            <Sidebar {...sidebarProps} />
            <Box
                flex="1"
                ml={
                    isSmallScreen
                        ? "0"
                        : isCollapsed
                          ? isTauri()
                              ? "96px"
                              : "80px"
                          : isTauri()
                            ? "236px"
                            : "220px"
                }
                minH="100vh"
                transition="margin-left 0.3s ease"
                bg={isTauri() ? "sidebar.background" : "transparent"}
                display="flex"
                flexDirection="column"
            >
                {/* Tauri titlebar drag region for macOS */}
                {isTauri() && (
                    <Box
                        data-tauri-drag-region
                        height="25px"
                        position="fixed"
                        top="0"
                        right="0"
                        left={
                            isSmallScreen ? "0" : isCollapsed ? "96px" : "236px"
                        }
                        zIndex="1000"
                        transition="left 0.3s ease"
                    />
                )}

                <Box
                    m="0px"
                    borderRadius="0px"
                    p={isTauri() ? "6" : "0"}
                    pt={
                        isSmallScreen && isTauri()
                            ? "50px"
                            : isTauri()
                              ? "6"
                              : "0"
                    }
                    className="main-bg"
                    height="100vh"
                    overflowY="auto"
                    position="relative"
                >
                    {children}
                </Box>
            </Box>
        </Flex>
    );
};

export default AppLayout;
