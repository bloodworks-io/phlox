import {
    Alert,
    AlertDescription,
    AlertIcon,
    Badge,
    Box,
    Button,
    Checkbox,
    Flex,
    FormControl,
    FormErrorMessage,
    FormLabel,
    HStack,
    IconButton,
    Input,
    Spacer,
    Switch,
    Text,
    Tooltip,
    VStack,
    useColorModeValue,
    useToast,
} from "@chakra-ui/react";
import {
    FaPuzzlePiece,
    FaPlus,
    FaCheck,
    FaServer,
    FaLock,
} from "react-icons/fa";
import { DeleteIcon } from "@chakra-ui/icons";
import { useState, useEffect } from "react";

import { toolsApi } from "../../utils/api/toolsApi";
import { settingsApi } from "../../utils/api/settingsApi";

// Built-in tools configuration
const BUILT_IN_TOOLS = [
    {
        name: "transcript_search",
        label: "Transcript Search",
        description: "Search patient transcripts",
        external: false,
    },
    {
        name: "get_relevant_literature",
        label: "Literature Search",
        description: "Local literature database",
        external: false,
    },
    {
        name: "pubmed_search",
        label: "PubMed Search",
        description: "PubMed API (may expose PHI)",
        external: true,
    },
    {
        name: "wiki_search",
        label: "Wikipedia Search",
        description: "Wikipedia API (may expose PHI)",
        external: true,
    },
    {
        name: "get_previous_encounter",
        label: "Previous Encounters",
        description: "Patient history lookup",
        external: false,
    },
];

const ToolsSettingsTab = ({ className }) => {
    const [toolServers, setToolServers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [testingServerId, setTestingServerId] = useState(null);

    const [serverName, setServerName] = useState("");
    const [serverUrl, setServerUrl] = useState("");
    const [allowSensitiveData, setAllowSensitiveData] = useState(false);

    const [nameError, setNameError] = useState("");
    const [urlError, setUrlError] = useState("");

    const [userSettings, setUserSettings] = useState({});
    const [disabledTools, setDisabledTools] = useState([
        "pubmed_search",
        "wiki_search",
    ]);

    const toast = useToast();
    const warningIconColor = useColorModeValue("#df8e1d", "#eed49f");

    const fetchServers = async () => {
        setIsLoading(true);
        try {
            const data = await toolsApi.fetchToolServers();
            setToolServers(data.servers || []);
        } catch (error) {
            console.error("Error fetching tool servers:", error);
            toast({
                title: "Error",
                description: "Failed to load tool servers",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchUserSettings = async () => {
        try {
            const settings = await settingsApi.fetchUserSettings();
            setUserSettings(settings);
            setDisabledTools(
                settings.disabled_tools || ["pubmed_search", "wiki_search"],
            );
        } catch (error) {
            console.error("Error fetching user settings:", error);
        }
    };

    useEffect(() => {
        fetchServers();
        fetchUserSettings();
    }, []);

    const validateForm = () => {
        let isValid = true;
        setNameError("");
        setUrlError("");

        if (!serverName.trim()) {
            setNameError("Server name is required");
            isValid = false;
        }

        if (!serverUrl.trim()) {
            setUrlError("Server URL is required");
            isValid = false;
        } else {
            try {
                new URL(serverUrl);
            } catch {
                setUrlError("Please enter a valid URL");
                isValid = false;
            }
        }

        return isValid;
    };

    const handleAddServer = async () => {
        if (!validateForm()) return;

        setIsLoading(true);
        try {
            const serverData = {
                name: serverName,
                url: serverUrl,
                allow_sensitive_data: allowSensitiveData,
            };

            await toolsApi.addToolServer(serverData);
            await toolsApi.refreshTools();

            toast({
                title: "Success",
                description: "Tool server added successfully",
                status: "success",
                duration: 3000,
                isClosable: true,
            });

            setServerName("");
            setServerUrl("");
            setAllowSensitiveData(false);
            setShowAddForm(false);
            fetchServers();
        } catch (error) {
            console.error("Error adding tool server:", error);
            toast({
                title: "Error",
                description: "Failed to add tool server",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteServer = async (serverId) => {
        setIsLoading(true);
        try {
            await toolsApi.deleteToolServer(serverId);
            await toolsApi.refreshTools();

            toast({
                title: "Success",
                description: "Tool server deleted",
                status: "success",
                duration: 3000,
                isClosable: true,
            });

            fetchServers();
        } catch (error) {
            console.error("Error deleting tool server:", error);
            toast({
                title: "Error",
                description: "Failed to delete tool server",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleServer = async (serverId, enabled) => {
        setIsLoading(true);
        try {
            await toolsApi.toggleToolServer(serverId, enabled);
            await toolsApi.refreshTools();

            toast({
                title: "Success",
                description: `Tool server ${enabled ? "enabled" : "disabled"}`,
                status: "success",
                duration: 3000,
                isClosable: true,
            });

            fetchServers();
        } catch (error) {
            console.error("Error toggling tool server:", error);
            toast({
                title: "Error",
                description: "Failed to toggle tool server",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleSensitiveData = async (serverId, allowSensitive) => {
        setIsLoading(true);
        try {
            await toolsApi.updateToolServer(serverId, { allow_sensitive_data: allowSensitive });
            await toolsApi.refreshTools();

            toast({
                title: "Success",
                description: `Sensitive data ${allowSensitive ? "allowed" : "sanitized"}`,
                status: allowSensitive ? "warning" : "success",
                duration: 3000,
                isClosable: true,
            });

            fetchServers();
        } catch (error) {
            console.error("Error toggling sensitive data:", error);
            toast({
                title: "Error",
                description: "Failed to update sensitive data setting",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleTestServer = async (serverId) => {
        setTestingServerId(serverId);
        try {
            const result = await toolsApi.testToolServer(serverId);

            if (result.success) {
                const serverInfo = result.server_info;
                const toolCount = result.tools?.length || 0;
                const serverName = serverInfo?.name || "";
                const serverVersion = serverInfo?.version || "";

                let description = `Found ${toolCount} tools`;
                if (serverName) {
                    description = `${serverName}${serverVersion ? ` v${serverVersion}` : ""} - ${toolCount} tools`;
                }

                toast({
                    title: "Connection Successful",
                    description: description,
                    status: "success",
                    duration: 4000,
                    isClosable: true,
                });

                // Refresh to get updated description
                fetchServers();
            } else {
                toast({
                    title: "Connection Failed",
                    description:
                        result.message || "Failed to connect to server",
                    status: "error",
                    duration: 5000,
                    isClosable: true,
                });
            }
        } catch (error) {
            console.error("Error testing tool server:", error);
            toast({
                title: "Error",
                description: "Failed to test tool server",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        } finally {
            setTestingServerId(null);
        }
    };

    const handleToggleBuiltInTool = async (toolName, enabled) => {
        const newDisabledTools = enabled
            ? disabledTools.filter((t) => t !== toolName)
            : [...disabledTools, toolName];

        setDisabledTools(newDisabledTools);

        try {
            await settingsApi.saveUserSettings({
                ...userSettings,
                disabled_tools: newDisabledTools,
            });

            toast({
                title: "Success",
                description: `${toolName} ${enabled ? "enabled" : "disabled"}`,
                status: "success",
                duration: 2000,
                isClosable: true,
            });
        } catch (error) {
            console.error("Error saving tool settings:", error);
            // Revert on error
            setDisabledTools(disabledTools);
            toast({
                title: "Error",
                description: "Failed to save tool settings",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        }
    };

    const isToolEnabled = (toolName) => !disabledTools.includes(toolName);

    return (
        <VStack spacing={4} align="stretch" className={className}>
            {/* Warning Banner */}
            <Alert status="warning" borderRadius="md">
                <AlertIcon color={warningIconColor} />
                <AlertDescription fontSize="sm">
                    Tool servers may receive sensitive patient information
                    (PHI). Only add servers you trust that comply with your
                    privacy requirements.
                </AlertDescription>
            </Alert>

            {/* Built-in Tools Section */}
            <Box>
                <Flex align="center" mb={2}>
                    <HStack>
                        <FaPuzzlePiece style={{ opacity: 0.7 }} />
                        <Text fontSize="sm" fontWeight="semibold">
                            Built-in Tools
                        </Text>
                    </HStack>
                </Flex>

                <Text fontSize="xs" className="pill-box-icons" mb={2}>
                    Enable or disable built-in tools. External tools (PubMed,
                    Wikipedia) are disabled by default to protect patient
                    privacy.
                </Text>

                <VStack spacing={1} align="stretch">
                    {BUILT_IN_TOOLS.map((tool) => (
                        <Box
                            key={tool.name}
                            p={2}
                            borderRadius="md"
                            className="floating-main"
                        >
                            <Flex justify="space-between" align="center">
                                <HStack spacing={2} flex="1">
                                    <Box flex="1">
                                        <HStack>
                                            <Text
                                                fontWeight="medium"
                                                fontSize="sm"
                                            >
                                                {tool.label}
                                            </Text>
                                            {tool.external && (
                                                <Tooltip label="External API - may expose PHI">
                                                    <Box>
                                                        <FaLock
                                                            style={{
                                                                opacity: 0.6,
                                                                color: warningIconColor,
                                                            }}
                                                        />
                                                    </Box>
                                                </Tooltip>
                                            )}
                                        </HStack>
                                        <Text
                                            fontSize="xs"
                                            className="pill-box-icons"
                                        >
                                            {tool.description}
                                        </Text>
                                    </Box>
                                </HStack>

                                <Switch
                                    isChecked={isToolEnabled(tool.name)}
                                    onChange={(e) =>
                                        handleToggleBuiltInTool(
                                            tool.name,
                                            e.target.checked,
                                        )
                                    }
                                    size="sm"
                                />
                            </Flex>
                        </Box>
                    ))}
                </VStack>
            </Box>

            {/* Tool Servers Header */}
            <Flex align="center">
                <HStack>
                    <FaPuzzlePiece style={{ opacity: 0.7 }} />
                    <Text fontSize="sm" fontWeight="semibold">
                        Tool Servers
                    </Text>
                </HStack>
                <Spacer />
                <Badge colorScheme="purple" fontSize="xs">
                    Streamable HTTP
                </Badge>
            </Flex>

            <Text fontSize="xs" className="pill-box-icons">
                External tool servers provide additional tools for chat and
                clinical reasoning. Servers must implement the Streamable HTTP
                transport.
            </Text>

            {/* Add Server Button */}
            <Button
                leftIcon={<FaPlus />}
                onClick={() => setShowAddForm(!showAddForm)}
                variant="outline"
                size="sm"
                className="nav-button"
                alignSelf="flex-start"
            >
                Add Server
            </Button>

            {/* Add Server Form */}
            {showAddForm && (
                <Box p={4} borderRadius="md" className="floating-main">
                    <VStack spacing={3}>
                        <FormControl isInvalid={!!nameError}>
                            <FormLabel fontSize="xs">Server Name</FormLabel>
                            <Input
                                value={serverName}
                                onChange={(e) => setServerName(e.target.value)}
                                placeholder="My MCP Server"
                                size="sm"
                                className="input-style"
                            />
                            <FormErrorMessage fontSize="xs">
                                {nameError}
                            </FormErrorMessage>
                        </FormControl>

                        <FormControl isInvalid={!!urlError}>
                            <FormLabel fontSize="xs">Server URL</FormLabel>
                            <Input
                                value={serverUrl}
                                onChange={(e) => setServerUrl(e.target.value)}
                                placeholder="http://localhost:3000/tools"
                                size="sm"
                                className="input-style"
                            />
                            <FormErrorMessage fontSize="xs">
                                {urlError}
                            </FormErrorMessage>
                        </FormControl>

                        <FormControl>
                            <HStack spacing={2}>
                                <Checkbox
                                    isChecked={allowSensitiveData}
                                    onChange={(e) => setAllowSensitiveData(e.target.checked)}
                                    colorScheme="red"
                                    size="sm"
                                >
                                    <Text fontSize="xs">Allow sensitive data (PHI)</Text>
                                </Checkbox>
                                <Tooltip label="When enabled, patient data will be sent to this server without sanitization. Only enable for fully trusted servers.">
                                    <Box>
                                        <FaLock style={{ opacity: 0.6, color: warningIconColor }} />
                                    </Box>
                                </Tooltip>
                            </HStack>
                            <Text fontSize="xs" className="pill-box-icons" mt={1}>
                                Default: sanitized. Enable only for trusted servers.
                            </Text>
                        </FormControl>

                        <HStack justify="flex-end" w="100%">
                            <Button
                                onClick={() => setShowAddForm(false)}
                                variant="ghost"
                                size="sm"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAddServer}
                                isLoading={isLoading}
                                colorScheme="green"
                                size="sm"
                            >
                                Add Server
                            </Button>
                        </HStack>
                    </VStack>
                </Box>
            )}

            {/* Server List */}
            {toolServers.length === 0 ? (
                <Box p={6} textAlign="center" className="floating-main">
                    <FaServer
                        size="1.5em"
                        style={{ opacity: 0.5, marginBottom: "8px" }}
                    />
                    <Text fontSize="sm" className="pill-box-icons">
                        No tool servers configured
                    </Text>
                    <Text fontSize="xs" className="pill-box-icons" mt={1}>
                        Add a server to extend available tools
                    </Text>
                </Box>
            ) : (
                <VStack spacing={2} align="stretch">
                    {toolServers.map((server) => (
                        <Box
                            key={server.id}
                            p={3}
                            borderRadius="md"
                            className="floating-main"
                        >
                            <Flex justify="space-between" align="center">
                                <HStack spacing={3} flex="1">
                                    <FaServer style={{ opacity: 0.5 }} />
                                    <Box flex="1">
                                        <HStack>
                                            <Text
                                                fontWeight="bold"
                                                fontSize="sm"
                                            >
                                                {server.name}
                                            </Text>
                                            <Badge
                                                size="sm"
                                                colorScheme={
                                                    server.enabled
                                                        ? "green"
                                                        : "gray"
                                                }
                                                fontSize="xs"
                                            >
                                                {server.enabled
                                                    ? "Active"
                                                    : "Disabled"}
                                            </Badge>
                                            {server.allow_sensitive_data && (
                                                <Tooltip label="PHI allowed - data sent without sanitization">
                                                    <Badge
                                                        size="sm"
                                                        colorScheme="red"
                                                        fontSize="xs"
                                                    >
                                                        PHI
                                                    </Badge>
                                                </Tooltip>
                                            )}
                                        </HStack>
                                        <Text
                                            fontSize="xs"
                                            className="pill-box-icons"
                                        >
                                            {server.url}
                                        </Text>
                                        {server.description && (
                                            <Text
                                                fontSize="xs"
                                                className="pill-box-icons"
                                                fontStyle="italic"
                                                opacity={0.8}
                                            >
                                                {server.description}
                                            </Text>
                                        )}
                                    </Box>
                                </HStack>

                                <HStack spacing={1}>
                                    <Tooltip label="Test connection">
                                        <IconButton
                                            size="sm"
                                            variant="ghost"
                                            icon={<FaCheck />}
                                            onClick={() =>
                                                handleTestServer(server.id)
                                            }
                                            isLoading={
                                                testingServerId === server.id
                                            }
                                            aria-label="Test connection"
                                        />
                                    </Tooltip>

                                    <Tooltip
                                        label={
                                            server.allow_sensitive_data
                                                ? "PHI allowed - click to sanitize"
                                                : "PHI sanitized - click to allow"
                                        }
                                    >
                                        <IconButton
                                            size="sm"
                                            variant="ghost"
                                            icon={<FaLock />}
                                            colorScheme={server.allow_sensitive_data ? "red" : "gray"}
                                            opacity={server.allow_sensitive_data ? 1 : 0.4}
                                            onClick={() =>
                                                handleToggleSensitiveData(
                                                    server.id,
                                                    !server.allow_sensitive_data,
                                                )
                                            }
                                            aria-label="Toggle PHI sanitization"
                                        />
                                    </Tooltip>

                                    <Tooltip
                                        label={
                                            server.enabled
                                                ? "Disable"
                                                : "Enable"
                                        }
                                    >
                                        <Switch
                                            isChecked={server.enabled}
                                            onChange={(e) =>
                                                handleToggleServer(
                                                    server.id,
                                                    e.target.checked,
                                                )
                                            }
                                            size="sm"
                                        />
                                    </Tooltip>

                                    <Tooltip label="Delete">
                                        <IconButton
                                            size="sm"
                                            icon={<DeleteIcon />}
                                            colorScheme="red"
                                            variant="ghost"
                                            onClick={() =>
                                                handleDeleteServer(server.id)
                                            }
                                            aria-label="Delete server"
                                        />
                                    </Tooltip>
                                </HStack>
                            </Flex>
                        </Box>
                    ))}
                </VStack>
            )}
        </VStack>
    );
};

export default ToolsSettingsTab;
