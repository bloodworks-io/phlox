import React, { useState, useEffect } from "react";
import {
    Box,
    Text,
    useDisclosure,
    Badge,
    Link,
    VStack,
    HStack,
    Center,
} from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { FaGithub, FaMoon, FaSun } from "react-icons/fa";
import { TbVersions } from "react-icons/tb";
import { BsCheck2All, BsExclamationTriangle } from "react-icons/bs";
import { buildApiUrl } from "../../utils/helpers/apiConfig";
import { universalFetch } from "../../utils/helpers/apiHelpers";
import ChangelogModal from "../modals/ChangelogModal";
import { APP_VERSION } from "../../utils/constants/version";
import changelogContent from "../../../CHANGELOG.md?raw";

const VersionInfo = ({ isCollapsed, colorMode, toggleColorMode }) => {
    const { open, onOpen, onClose } = useDisclosure();
    const [serverStatus, setServerStatus] = useState({
        whisper: false,
        llm: false,
    });

    const version = APP_VERSION;
    const changelog = changelogContent;

    // Sidebar is always-dark by design; sidebar.text token resolves to a light value in both modes

    useEffect(() => {
        // Check server status
        const checkStatus = async () => {
            try {
                const url = await buildApiUrl("/api/config/status");
                const response = await universalFetch(url);
                if (response.ok) {
                    const data = await response.json();
                    setServerStatus(data);
                }
            } catch (error) {
                console.error("Error checking server status:", error);
            }
        };

        checkStatus();
        // Set up interval to check status periodically
        const intervalId = setInterval(checkStatus, 60000); // Check every minute

        return () => clearInterval(intervalId);
    }, []);

    // Combined status icon
    const StatusIcon = () => {
        const allServicesUp = serverStatus.llm && serverStatus.whisper;

        return (
            <Tooltip
                content={
                    allServicesUp
                        ? "All services connected"
                        : `Services: ${serverStatus.llm ? "✓" : "✗"} LLM, ${serverStatus.whisper ? "✓" : "✗"} Whisper`
                }
                positioning={{
                    placement: isCollapsed ? "right" : "top",
                }}
            >
                <Badge
                    colorPalette={allServicesUp ? "green" : "orange"}
                    borderRadius="full"
                    variant="subtle"
                    p={1}
                >
                    {allServicesUp ? (
                        <BsCheck2All />
                    ) : (
                        <BsExclamationTriangle />
                    )}
                </Badge>
            </Tooltip>
        );
    };

    // Display for the collapsed sidebar
    if (isCollapsed) {
        return (
            <Box position="relative" width="100%">
                <VStack gap={2} align="center" width="100%">
                    <Tooltip
                        content="View Version Info"
                        positioning={{
                            placement: "right",
                        }}
                    >
                        <Box
                            onClick={onOpen}
                            cursor="pointer"
                            fontSize="md"
                            color="sidebar.text" // Apply consistent color
                            _hover={{ color: "sidebar.text" }} // Brighten on hover
                        >
                            <TbVersions />
                        </Box>
                    </Tooltip>

                    <Tooltip
                        content="GitHub Repository"
                        positioning={{
                            placement: "right",
                        }}
                    >
                        <Link
                            href="https://github.com/bloodworks-io/phlox"
                            target="_blank"
                            rel="noopener noreferrer"
                            fontSize="md"
                            color="sidebar.text" // Apply consistent color
                            _hover={{ color: "sidebar.text" }} // Brighten on hover
                        >
                            <FaGithub />
                        </Link>
                    </Tooltip>

                    <Tooltip
                        content={
                            colorMode === "light"
                                ? "Switch to Dark Mode"
                                : "Switch to Light Mode"
                        }
                        positioning={{
                            placement: "right",
                        }}
                    >
                        <Box
                            onClick={toggleColorMode}
                            cursor="pointer"
                            fontSize="md"
                            color="sidebar.text"
                            _hover={{ color: "sidebar.text" }}
                        >
                            {colorMode === "light" ? <FaMoon /> : <FaSun />}
                        </Box>
                    </Tooltip>

                    <StatusIcon />
                </VStack>
                <ChangelogModal
                    isOpen={open}
                    onClose={onClose}
                    version={version}
                    changelog={changelog}
                />
            </Box>
        );
    }

    // Display for the expanded sidebar
    return (
        <Box width="100%">
            {/* Center the version, GitHub icon, and status icon */}
            <Center width="100%">
                <HStack gap={4}>
                    <Tooltip content="View Changelog">
                        <Text
                            fontSize="md"
                            onClick={onOpen}
                            cursor="pointer"
                            color="sidebar.text" // Apply consistent color
                            _hover={{
                                textDecoration: "underline",
                                color: "var(--chakra-colors-sidebar-text)",
                            }}
                        >
                            v{version}
                        </Text>
                    </Tooltip>

                    <Tooltip content="GitHub Repository">
                        <Link
                            href="https://github.com/bloodworks-io/phlox"
                            target="_blank"
                            rel="noopener noreferrer"
                            fontSize="lg"
                            color="sidebar.text" // Apply consistent color
                            _hover={{ color: "sidebar.text" }} // Brighten on hover
                        >
                            <FaGithub />
                        </Link>
                    </Tooltip>

                    <Tooltip
                        content={
                            colorMode === "light"
                                ? "Switch to Dark Mode"
                                : "Switch to Light Mode"
                        }
                    >
                        <Box
                            onClick={toggleColorMode}
                            cursor="pointer"
                            fontSize="lg"
                            color="sidebar.text"
                            _hover={{ color: "sidebar.text" }}
                        >
                            {colorMode === "light" ? <FaMoon /> : <FaSun />}
                        </Box>
                    </Tooltip>

                    <StatusIcon />
                </HStack>
            </Center>
            <ChangelogModal
                isOpen={open}
                onClose={onClose}
                version={version}
                changelog={changelog}
            />
        </Box>
    );
};

export default VersionInfo;
