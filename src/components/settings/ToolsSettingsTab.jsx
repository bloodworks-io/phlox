import { Alert, Badge, Box, Button, Checkbox, Flex, HStack, IconButton, Input, Spacer, Switch, Text, VStack, Field } from "@chakra-ui/react";
import { Tooltip } from '@/components/ui/tooltip';
import {
    FaPuzzlePiece,
    FaPlus,
    FaCheck,
    FaServer,
    FaLock,
} from "react-icons/fa";
import { DeleteIcon } from "../common/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToolServers } from "../../utils/hooks/useToolServers";

// Built-in tools configuration
const BUILT_IN_TOOLS = [
    {
        name: "transcript_search",
        labelKey: "settings.tools.transcriptSearch",
        descriptionKey: "settings.tools.transcriptSearchDescription",
        external: false,
    },
    {
        name: "get_relevant_literature",
        labelKey: "settings.tools.literatureSearch",
        descriptionKey: "settings.tools.literatureSearchDescription",
        external: false,
    },
    {
        name: "pubmed_search",
        labelKey: "settings.tools.pubmedSearch",
        descriptionKey: "settings.tools.pubmedSearchDescription",
        external: true,
    },
    {
        name: "wiki_search",
        labelKey: "settings.tools.wikipediaSearch",
        descriptionKey: "settings.tools.wikipediaSearchDescription",
        external: true,
    },
    {
        name: "get_previous_encounter",
        labelKey: "settings.tools.previousEncounters",
        descriptionKey: "settings.tools.previousEncountersDescription",
        external: false,
    },
];

const ToolsSettingsTab = ({ className }) => {
    const {
        toolServers,
        isLoading,
        testingServerId,
        addServer,
        deleteServer,
        toggleServer,
        toggleSensitiveData,
        testServer,
        toggleBuiltInTool,
        isToolEnabled,
    } = useToolServers();
    const { t } = useTranslation();

    const [showAddForm, setShowAddForm] = useState(false);
    const [serverName, setServerName] = useState("");
    const [serverUrl, setServerUrl] = useState("");
    const [allowSensitiveData, setAllowSensitiveData] = useState(false);
    const [nameError, setNameError] = useState("");
    const [urlError, setUrlError] = useState("");

    const validateForm = () => {
        let isValid = true;
        setNameError("");
        setUrlError("");

        if (!serverName.trim()) {
            setNameError(t("settings.tools.serverNameRequired"));
            isValid = false;
        }

        if (!serverUrl.trim()) {
            setUrlError(t("settings.tools.serverUrlRequired"));
            isValid = false;
        } else {
            try {
                new URL(serverUrl);
            } catch {
                setUrlError(t("settings.tools.invalidUrl"));
                isValid = false;
            }
        }

        return isValid;
    };

    const handleAddServer = async () => {
        if (!validateForm()) return;
        const ok = await addServer({
            name: serverName,
            url: serverUrl,
            allow_sensitive_data: allowSensitiveData,
        });
        if (ok) {
            setServerName("");
            setServerUrl("");
            setAllowSensitiveData(false);
            setShowAddForm(false);
        }
    };

    return (
        <VStack gap={4} align="stretch" className={className}>
            {/* Warning Banner */}
            <Alert.Root status="warning" borderRadius="md">
                <Alert.Indicator color="secondaryButton" />
                <Alert.Description fontSize="sm">
                    {t("settings.tools.warning")}
                </Alert.Description>
            </Alert.Root>
            {/* Built-in Tools Section */}
            <Box>
                <Flex align="center" mb={2}>
                    <HStack>
                        <FaPuzzlePiece style={{ opacity: 0.7 }} />
                        <Text fontSize="sm" fontWeight="semibold">
                            {t("settings.tools.builtinTitle")}
                        </Text>
                    </HStack>
                </Flex>

                <Text fontSize="xs" className="pill-box-icons" mb={2}>
                    {t("settings.tools.builtinDescription")}
                </Text>

                <VStack gap={1} align="stretch">
                    {BUILT_IN_TOOLS.map((tool) => (
                        <Box
                            key={tool.name}
                            p={2}
                            borderRadius="md"
                            className="floating-main"
                        >
                            <Flex justify="space-between" align="center">
                                <HStack gap={2} flex="1">
                                    <Box flex="1">
                                        <HStack>
                                            <Text
                                                fontWeight="medium"
                                                fontSize="sm"
                                            >
                                                {t(tool.labelKey)}
                                            </Text>
                                            {tool.external && (
                                                <Tooltip content={t("settings.tools.externalTooltip")}>
                                                    <Box>
                                                        <FaLock
                                                            style={{
                                                                opacity: 0.6,
                                                                color: "var(--chakra-colors-secondary-button)",
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
                                            {t(tool.descriptionKey)}
                                        </Text>
                                    </Box>
                                </HStack>

                                <Switch.Root
                                    checked={isToolEnabled(tool.name)}
                                    onCheckedChange={({ checked }) =>
                                        toggleBuiltInTool(tool.name, checked)
                                    }
                                    size="sm"
                                >
                                    <Switch.HiddenInput />
                                    <Switch.Control>
                                        <Switch.Thumb />
                                    </Switch.Control>
                                </Switch.Root>
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
                        {t("settings.tools.serversTitle")}
                    </Text>
                </HStack>
                <Spacer />
                <Badge colorPalette="purple" fontSize="xs">
                    {t("settings.tools.streamableHttp")}
                </Badge>
            </Flex>
            <Text fontSize="xs" className="pill-box-icons">
                {t("settings.tools.serversDescription")}
            </Text>
            {/* Add Server Button */}
            <Button
                onClick={() => setShowAddForm(!showAddForm)}
                variant="outline"
                size="sm"
                className="nav-button"
                alignSelf="flex-start"><FaPlus />{t("settings.tools.addServer")}
                            </Button>
            {/* Add Server Form */}
            {showAddForm && (
                <Box p={4} borderRadius="md" className="floating-main">
                    <VStack gap={3}>
                        <Field.Root invalid={!!nameError}>
                            <Field.Label fontSize="xs">{t("settings.tools.serverName")}</Field.Label>
                            <Input
                                value={serverName}
                                onChange={(e) => setServerName(e.target.value)}
                                placeholder={t("settings.tools.serverNamePlaceholder")}
                                size="sm"
                                className="input-style"
                            />
                            <Field.ErrorText fontSize="xs">
                                {nameError}
                            </Field.ErrorText>
                        </Field.Root>

                        <Field.Root invalid={!!urlError}>
                            <Field.Label fontSize="xs">{t("settings.tools.serverUrl")}</Field.Label>
                            <Input
                                value={serverUrl}
                                onChange={(e) => setServerUrl(e.target.value)}
                                placeholder="http://localhost:3000/tools"
                                size="sm"
                                className="input-style"
                            />
                            <Field.ErrorText fontSize="xs">
                                {urlError}
                            </Field.ErrorText>
                        </Field.Root>

                        <Field.Root>
                            <HStack gap={2}>
                                <Checkbox.Root
                                    onCheckedChange={({ checked }) => setAllowSensitiveData(checked)}
                                    colorPalette="red"
                                    size="sm"
                                    checked={allowSensitiveData}
                                ><Checkbox.HiddenInput /><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control><Checkbox.Label>
                                    <Text fontSize="xs">{t("settings.tools.allowSensitive")}</Text>
                                </Checkbox.Label></Checkbox.Root>
                                <Tooltip content={t("settings.tools.allowSensitiveTooltip")}>
                                    <Box>
                                        <FaLock style={{ opacity: 0.6, color: "var(--chakra-colors-secondary-button)" }} />
                                    </Box>
                                </Tooltip>
                            </HStack>
                            <Text fontSize="xs" className="pill-box-icons" mt={1}>
                                {t("settings.tools.sensitiveDefault")}
                            </Text>
                        </Field.Root>

                        <HStack justify="flex-end" w="100%">
                            <Button
                                onClick={() => setShowAddForm(false)}
                                variant="ghost"
                                size="sm"
                            >
                                {t("action.cancel")}
                            </Button>
                            <Button
                                onClick={handleAddServer}
                                loading={isLoading}
                                colorPalette="green"
                                size="sm"
                            >
                                {t("settings.tools.addServer")}
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
                        {t("settings.tools.emptyTitle")}
                    </Text>
                    <Text fontSize="xs" className="pill-box-icons" mt={1}>
                        {t("settings.tools.emptyDescription")}
                    </Text>
                </Box>
            ) : (
                <VStack gap={2} align="stretch">
                    {toolServers.map((server) => (
                        <Box
                            key={server.id}
                            p={3}
                            borderRadius="md"
                            className="floating-main"
                        >
                            <Flex justify="space-between" align="center">
                                <HStack gap={3} flex="1">
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
                                                colorPalette={
                                                    server.enabled
                                                        ? "green"
                                                        : "gray"
                                                }
                                                fontSize="xs"
                                            >
                                                {server.enabled
                                                    ? t("settings.active")
                                                    : t("settings.tools.disabled")}
                                            </Badge>
                                            {server.allow_sensitive_data && (
                                                <Tooltip content={t("settings.tools.phiAllowedTooltip")}>
                                                    <Badge
                                                        size="sm"
                                                        colorPalette="red"
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

                                <HStack gap={1}>
                                    <Tooltip content={t("settings.tools.testConnection")}>
                                        <IconButton
                                            size="sm"
                                            variant="ghost"
                                            onClick={() =>
                                                testServer(server.id)
                                            }
                                            loading={
                                                testingServerId === server.id
                                            }
                                            aria-label={t("settings.tools.testConnection")}><FaCheck /></IconButton>
                                    </Tooltip>

                                    <Tooltip
                                        content={
                                            server.allow_sensitive_data
                                                ? t("settings.tools.phiClickSanitize")
                                                : t("settings.tools.phiClickAllow")
                                        }
                                    >
                                        <IconButton
                                            size="sm"
                                            variant="ghost"
                                            colorPalette={server.allow_sensitive_data ? "red" : "gray"}
                                            opacity={server.allow_sensitive_data ? 1 : 0.4}
                                            onClick={() =>
                                                toggleSensitiveData(
                                                    server.id,
                                                    !server.allow_sensitive_data,
                                                )
                                            }
                                            aria-label={t("settings.tools.togglePhi")}><FaLock /></IconButton>
                                    </Tooltip>

                                    <Tooltip
                                        content={
                                            server.enabled
                                                ? t("settings.disable")
                                                : t("settings.enable")
                                        }
                                    >
                                        <Switch.Root
                                            checked={server.enabled}
                                            onCheckedChange={({ checked }) =>
                                                toggleServer(server.id, checked)
                                            }
                                            size="sm"
                                        >
                                            <Switch.HiddenInput />
                                            <Switch.Control>
                                                <Switch.Thumb />
                                            </Switch.Control>
                                        </Switch.Root>
                                    </Tooltip>

                                    <Tooltip content={t("settings.tools.delete")}>
                                        <IconButton
                                            size="sm"
                                            colorPalette="red"
                                            variant="ghost"
                                            onClick={() =>
                                                deleteServer(server.id)
                                            }
                                            aria-label={t("settings.tools.deleteServer")}><DeleteIcon /></IconButton>
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
