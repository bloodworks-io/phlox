import {
    Box,
    Text,
    Flex,
    IconButton,
    useDisclosure,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalCloseButton,
    Badge,
    Tooltip,
    Link,
    VStack,
    HStack,
} from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { FaGithub } from "react-icons/fa";
import { TbVersions } from "react-icons/tb";
import { BsCheck2All, BsExclamationTriangle } from "react-icons/bs";

const VersionInfo = ({ isCollapsed }) => {
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [version, setVersion] = useState("");
    const [changelog, setChangelog] = useState([]);
    const [serverStatus, setServerStatus] = useState({
        whisper: false,
        ollama: false,
    });

    useEffect(() => {
        // Fetch version from package.json
        fetch("/api/config/version")
            .then((res) => res.json())
            .then((data) => {
                setVersion(data.version);
            })
            .catch((err) => console.error("Error fetching version:", err));

        // Fetch changelog
        fetch("/CHANGELOG.md")
            .then((res) => res.text())
            .then((text) => {
                // Parse changelog markdown to structured data
                const parsedChangelog = parseChangelog(text);
                setChangelog(parsedChangelog);
            })
            .catch((err) => console.error("Error fetching changelog:", err));

        // Check server status
        const checkStatus = async () => {
            try {
                const response = await fetch(`/api/config/status`);
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

    // Simple parser for changelog markdown
    const parseChangelog = (markdown) => {
        const lines = markdown.split("\n");
        const versions = [];
        let currentVersion = null;

        for (const line of lines) {
            if (line.startsWith("## ")) {
                // New version section
                if (currentVersion) {
                    versions.push(currentVersion);
                }
                const versionMatch = line.match(/## \[(.*?)\]/);
                const dateMatch = line.match(/- (.*)$/);
                currentVersion = {
                    version: versionMatch
                        ? versionMatch[1]
                        : line.replace("## ", ""),
                    date: dateMatch ? dateMatch[1] : "",
                    changes: [],
                };
            } else if (line.startsWith("### ") && currentVersion) {
                // Section within version
                currentVersion.changes.push({
                    type: line.replace("### ", ""),
                    items: [],
                });
            } else if (
                line.startsWith("- ") &&
                currentVersion &&
                currentVersion.changes.length > 0
            ) {
                // Change item
                const lastChangeType =
                    currentVersion.changes[currentVersion.changes.length - 1];
                lastChangeType.items.push(line.replace("- ", ""));
            }
        }

        if (currentVersion) {
            versions.push(currentVersion);
        }

        return versions;
    };

    // Combined status icon
    const StatusIcon = () => {
        const allServicesUp = serverStatus.ollama && serverStatus.whisper;

        return (
            <Tooltip
                label={
                    allServicesUp
                        ? "All services connected"
                        : `Services: ${serverStatus.ollama ? "✓" : "✗"} Ollama, ${serverStatus.whisper ? "✓" : "✗"} Whisper`
                }
                placement={isCollapsed ? "right" : "top"}
            >
                <Badge
                    colorScheme={allServicesUp ? "green" : "orange"}
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
            <VStack
                position="absolute"
                bottom="10px"
                left="0"
                width="100%"
                spacing={5}
                align="center"
                px={2}
            >
                <Tooltip label="View Version Info" placement="right">
                    <Box onClick={onOpen} cursor="pointer" fontSize="xl">
                        <TbVersions />
                    </Box>
                </Tooltip>

                <Tooltip label="GitHub Repository" placement="right">
                    <Link
                        href="https://github.com/bloodworks-io/phlox"
                        target="_blank"
                        rel="noopener noreferrer"
                        fontSize="xl"
                    >
                        <FaGithub />
                    </Link>
                </Tooltip>

                <StatusIcon />

                <ChangelogModal
                    isOpen={isOpen}
                    onClose={onClose}
                    version={version}
                    changelog={changelog}
                />
            </VStack>
        );
    }

    // Display for the expanded sidebar
    return (
        <Box width="100%">
            <Flex align="center" justify="center" width="100%">
                <HStack spacing={4}>
                    <Text
                        fontSize="md"
                        onClick={onOpen}
                        cursor="pointer"
                        _hover={{ textDecoration: "underline" }}
                    >
                        v{version}
                    </Text>

                    <Link
                        href="https://github.com/bloodworks-io/phlox"
                        target="_blank"
                        rel="noopener noreferrer"
                        fontSize="xl"
                    >
                        <FaGithub />
                    </Link>

                    <StatusIcon />
                </HStack>
            </Flex>

            <ChangelogModal
                isOpen={isOpen}
                onClose={onClose}
                version={version}
                changelog={changelog}
            />
        </Box>
    );
};

// Separate component for the changelog modal
const ChangelogModal = ({ isOpen, onClose, version, changelog }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
            <ModalOverlay />
            <ModalContent className="modal-style">
                <ModalHeader>Phlox v{version} - Changelog</ModalHeader>
                <ModalCloseButton />
                <ModalBody
                    maxH="70vh"
                    overflowY="auto"
                    className="custom-scrollbar"
                >
                    {changelog.length > 0 ? (
                        changelog.map((release, idx) => (
                            <Box key={idx} mb={6}>
                                <Flex align="baseline" mb={2}>
                                    <Text fontWeight="bold" fontSize="lg">
                                        v{release.version}
                                    </Text>
                                    {release.date && (
                                        <Text
                                            ml={2}
                                            fontSize="sm"
                                            color="gray.500"
                                        >
                                            ({release.date})
                                        </Text>
                                    )}
                                </Flex>

                                {release.changes.map((changeType, typeIdx) => (
                                    <Box key={typeIdx} ml={4} mb={3}>
                                        <Text fontWeight="bold" fontSize="md">
                                            {changeType.type}
                                        </Text>
                                        <VStack
                                            align="start"
                                            ml={4}
                                            spacing={1}
                                            mt={1}
                                        >
                                            {changeType.items.map(
                                                (item, itemIdx) => (
                                                    <Text key={itemIdx}>
                                                        {item}
                                                    </Text>
                                                ),
                                            )}
                                        </VStack>
                                    </Box>
                                ))}
                            </Box>
                        ))
                    ) : (
                        <Text>Loading changelog...</Text>
                    )}
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};

export default VersionInfo;
