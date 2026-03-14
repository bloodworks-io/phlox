import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
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
} from "react-icons/fa";
import { DeleteIcon } from "@chakra-ui/icons";
import { useState, useEffect } from "react";

import { mcpApi } from "../../utils/api/mcpApi";

const McpSettingsTab = ({ className }) => {
  const [mcpServers, setMcpServers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testingServerId, setTestingServerId] = useState(null);

  const [serverName, setServerName] = useState("");
  const [serverUrl, setServerUrl] = useState("");

  const [nameError, setNameError] = useState("");
  const [urlError, setUrlError] = useState("");

  const toast = useToast();
  const warningIconColor = useColorModeValue("#df8e1d", "#eed49f");

  const fetchServers = async () => {
    setIsLoading(true);
    try {
      const data = await mcpApi.fetchMcpServers();
      setMcpServers(data.servers || []);
    } catch (error) {
      console.error("Error fetching MCP servers:", error);
      toast({
        title: "Error",
        description: "Failed to load MCP servers",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
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
      };

      await mcpApi.addMcpServer(serverData);
      await mcpApi.refreshMcpTools();

      toast({
        title: "Success",
        description: "MCP server added successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      setServerName("");
      setServerUrl("");
      setShowAddForm(false);
      fetchServers();
    } catch (error) {
      console.error("Error adding MCP server:", error);
      toast({
        title: "Error",
        description: "Failed to add MCP server",
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
      await mcpApi.deleteMcpServer(serverId);
      await mcpApi.refreshMcpTools();

      toast({
        title: "Success",
        description: "MCP server deleted",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      fetchServers();
    } catch (error) {
      console.error("Error deleting MCP server:", error);
      toast({
        title: "Error",
        description: "Failed to delete MCP server",
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
      await mcpApi.toggleMcpServer(serverId, enabled);
      await mcpApi.refreshMcpTools();

      toast({
        title: "Success",
        description: `MCP server ${enabled ? "enabled" : "disabled"}`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      fetchServers();
    } catch (error) {
      console.error("Error toggling MCP server:", error);
      toast({
        title: "Error",
        description: "Failed to toggle MCP server",
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
      const result = await mcpApi.testMcpServer(serverId);

      if (result.success) {
        toast({
          title: "Connection Successful",
          description: `Found ${result.tools?.length || 0} tools`,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: result.message || "Failed to connect to server",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error("Error testing MCP server:", error);
      toast({
        title: "Error",
        description: "Failed to test MCP server",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setTestingServerId(null);
    }
  };

  return (
    <VStack spacing={4} align="stretch" className={className}>
      {/* Warning Banner */}
      <Alert status="warning" borderRadius="md">
        <AlertIcon color={warningIconColor} />
        <AlertDescription fontSize="sm">
          MCP servers may receive sensitive patient information (PHI). Only add
          servers you trust that comply with your privacy requirements.
        </AlertDescription>
      </Alert>

      {/* Header */}
      <Flex align="center">
        <HStack>
          <FaPuzzlePiece style={{ opacity: 0.7 }} />
          <Text fontSize="sm" fontWeight="semibold">
            MCP Servers
          </Text>
        </HStack>
        <Spacer />
        <Badge colorScheme="purple" fontSize="xs">
          Streamable HTTP
        </Badge>
      </Flex>

      <Text fontSize="xs" className="pill-box-icons">
        External MCP servers provide additional tools for chat and clinical
        reasoning. Servers must implement the Streamable HTTP transport.
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
              <FormErrorMessage fontSize="xs">{nameError}</FormErrorMessage>
            </FormControl>

            <FormControl isInvalid={!!urlError}>
              <FormLabel fontSize="xs">Server URL</FormLabel>
              <Input
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://localhost:3000/mcp"
                size="sm"
                className="input-style"
              />
              <FormErrorMessage fontSize="xs">{urlError}</FormErrorMessage>
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
      {mcpServers.length === 0 ? (
        <Box p={6} textAlign="center" className="floating-main">
          <FaServer size="1.5em" style={{ opacity: 0.5, marginBottom: "8px" }} />
          <Text fontSize="sm" className="pill-box-icons">
            No MCP servers configured
          </Text>
          <Text fontSize="xs" className="pill-box-icons" mt={1}>
            Add a server to extend available tools
          </Text>
        </Box>
      ) : (
        <VStack spacing={2} align="stretch">
          {mcpServers.map((server) => (
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
                      <Text fontWeight="bold" fontSize="sm">
                        {server.name}
                      </Text>
                      <Badge
                        size="sm"
                        colorScheme={server.enabled ? "green" : "gray"}
                        fontSize="xs"
                      >
                        {server.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </HStack>
                    <Text fontSize="xs" className="pill-box-icons">
                      {server.url}
                    </Text>
                  </Box>
                </HStack>

                <HStack spacing={1}>
                  <Tooltip label="Test connection">
                    <IconButton
                      size="sm"
                      variant="ghost"
                      icon={<FaCheck />}
                      onClick={() => handleTestServer(server.id)}
                      isLoading={testingServerId === server.id}
                      aria-label="Test connection"
                    />
                  </Tooltip>

                  <Tooltip label={server.enabled ? "Disable" : "Enable"}>
                    <Switch
                      isChecked={server.enabled}
                      onChange={(e) =>
                        handleToggleServer(server.id, e.target.checked)
                      }
                      size="sm"
                    />
                  </Tooltip>

                  <Tooltip label="Delete">
                    <IconButton
                      size="sm"
                      icon={<DeleteIcon />}
                      colorScheme="red"
                      onClick={() => handleDeleteServer(server.id)}
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

export default McpSettingsTab;
