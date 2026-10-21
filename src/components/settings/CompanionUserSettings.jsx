import { useEffect, useState } from "react";
import {
    Box,
    Button,
    Flex,
    HStack,
    Separator,
    Switch,
    Text,
    VStack,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { companionApi } from "../../utils/api/companionApi";
import { localModelApi } from "../../utils/api/localModelApi";
import { isTauri } from "../../utils/helpers/apiConfig";
import { KEYS } from "../../utils/cache/keys";
import CompanionSessionList from "../companion/CompanionSessionList";

// The user-facing companion controls: enable phone sync (off by default),
// choose the import mode, and read the pairing code the phone app asks for.

const CompanionUserSettings = ({ config, handleConfigChange }) => {
    const { t } = useTranslation();
    const [revealed, setRevealed] = useState(false);
    const [copied, setCopied] = useState(false);

    const { data: status, mutate: mutateStatus } = useSWR(
        KEYS.COMPANION_STATUS,
        companionApi.fetchStatus,
        { refreshInterval: 15000 },
    );
    const pairingCode = status?.pairing_code ?? "";

    // The host only exists in the desktop build; reflect its arrival without
    // waiting for the next poll.
    useEffect(() => {
        if (!isTauri()) return undefined;
        const timer = setInterval(() => mutateStatus(), 4000);
        return () => clearInterval(timer);
    }, [mutateStatus, status?.pairing_code]);

    const handleEnable = ({ checked }) => {
        handleConfigChange("COMPANION_ENABLED", checked);
        if (!isTauri()) return;
        if (checked) {
            localModelApi.startCompanionHost().catch(() => {});
        } else {
            localModelApi.stopCompanionHost().catch(() => {});
        }
        setTimeout(() => mutateStatus(), 800);
    };

    const handleCopy = async () => {
        if (!pairingCode) return;
        await navigator.clipboard.writeText(pairingCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const enabled = !!config?.COMPANION_ENABLED;

    return (
        <VStack gap={4} align="stretch">
            <Flex justify="space-between" align="center">
                <Box>
                    <Text fontSize="sm" fontWeight="medium">
                        {t("settings.companion.enableSync")}
                    </Text>
                    <Text fontSize="xs" className="pill-box-icons">
                        {t("settings.companion.enableSyncDescription")}
                    </Text>
                </Box>
                <Switch.Root
                    size="sm"
                    checked={enabled}
                    onCheckedChange={handleEnable}
                >
                    <Switch.HiddenInput />
                    <Switch.Control>
                        <Switch.Thumb />
                    </Switch.Control>
                </Switch.Root>
            </Flex>

            {enabled && (
                <>
                    <Flex justify="space-between" align="center">
                        <Box>
                            <Text fontSize="sm" fontWeight="medium">
                                {t("settings.companion.autoImport")}
                            </Text>
                            <Text fontSize="xs" className="pill-box-icons">
                                {t("settings.companion.autoImportDescription")}
                            </Text>
                        </Box>
                        <Switch.Root
                            size="sm"
                            checked={config?.COMPANION_AUTO_IMPORT !== false}
                            onCheckedChange={({ checked }) =>
                                handleConfigChange("COMPANION_AUTO_IMPORT", checked)
                            }
                        >
                            <Switch.HiddenInput />
                            <Switch.Control>
                                <Switch.Thumb />
                            </Switch.Control>
                        </Switch.Root>
                    </Flex>

                    <Flex justify="space-between" align="center">
                        <Box>
                            <Text fontSize="sm" fontWeight="medium">
                                {t("settings.companion.pairingCode")}
                            </Text>
                            <Text fontSize="xs" className="pill-box-icons">
                                {status?.pairing_code
                                    ? t("settings.companion.pairingCodeDescription")
                                    : t("settings.companion.hostNotRunning")}
                            </Text>
                        </Box>
                        <HStack gap={2}>
                            {status?.pairing_code ? (
                                <>
                                    <Text
                                        fontSize="sm"
                                        fontFamily="monospace"
                                        color="textSecondary"
                                    >
                                        {revealed
                                            ? pairingCode
                                            : `${pairingCode.slice(0, 2)}••••`}
                                    </Text>
                                    <Button
                                        size="xs"
                                        variant="ghost"
                                        onClick={() => setRevealed(!revealed)}
                                    >
                                        {revealed
                                            ? t("settings.companion.hide")
                                            : t("settings.companion.reveal")}
                                    </Button>
                                    <Button
                                        size="xs"
                                        variant="ghost"
                                        onClick={handleCopy}
                                    >
                                        {copied
                                            ? t("settings.companion.copied")
                                            : t("settings.companion.copy")}
                                    </Button>
                                </>
                            ) : (
                                <Text fontSize="xs" color="textSecondary">
                                    —
                                </Text>
                            )}
                        </HStack>
                    </Flex>

                    <Separator my={2} />

                    <CompanionSessionList />
                </>
            )}
        </VStack>
    );
};

export default CompanionUserSettings;
