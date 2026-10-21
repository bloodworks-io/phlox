import { useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    Checkbox,
    Dialog,
    Heading,
    HStack,
    Icon,
    NativeSelect,
    Portal,
    Text,
    VStack,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { LuCheck, LuCircleAlert, LuSmartphone } from "react-icons/lu";
import { companionApi } from "../../utils/api/companionApi";
import { templateApi } from "../../utils/api/templateApi";
import { KEYS } from "../../utils/cache/keys";
import { formatDuration, sessionDay, sessionTime } from "../companion/sessionUi";

const selectable = (session) =>
    session.status === "received" || session.status === "failed";

const CompanionImportModal = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const [selected, setSelected] = useState(() => new Set());
    const [saving, setSaving] = useState(false);
    const [showOption, setShowOption] = useState(false);
    const [templateKey, setTemplateKey] = useState("");

    const { data: templatesData } = useSWR(
        isOpen ? ["companionTemplates"] : null,
        () => templateApi.fetchTemplates().catch(() => null),
    );
    const templates = useMemo(
        () =>
            (templatesData ?? []).filter(
                (tpl) => tpl.is_active !== false && !tpl.is_deleted,
            ),
        [templatesData],
    );

    const { data, mutate } = useSWR(
        isOpen ? KEYS.COMPANION_SESSIONS : null,
        companionApi.fetchSessions,
        { refreshInterval: 2000, revalidateOnMount: true },
    );
    const sessions = (data?.sessions ?? []).filter(
        (session) => session.status !== "imported",
    );

    const { data: status, mutate: mutateStatus } = useSWR(
        isOpen ? KEYS.COMPANION_STATUS : null,
        companionApi.fetchStatus,
        { refreshInterval: 2000, revalidateOnMount: true },
    );
    const phoneConnected = !!status?.phone?.connected;
    const savingCount = sessions.filter((s) => s.status === "processing").length;
    const readyCount = sessions.filter(selectable).length;

    // Clicking the phone icon IS the sync trigger: opening the dialog asks
    // the phone (via the host) to transfer now, then watch the results land.
    useEffect(() => {
        if (!isOpen) return undefined;
        companionApi
            .triggerSync()
            .catch(() => {})
            .finally(() => {
                mutate();
                mutateStatus();
            });
        const refresh = setInterval(() => {
            mutate();
            mutateStatus();
        }, 2000);
        return () => clearInterval(refresh);
    }, [isOpen, mutate, mutateStatus]);

    const groups = useMemo(() => {
        const byDay = new Map();
        for (const session of sessions) {
            const key = sessionDay(session, t);
            if (!byDay.has(key)) byDay.set(key, []);
            byDay.get(key).push(session);
        }
        return [...byDay.entries()];
    }, [sessions, t]);

    const toggle = (sessionId) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(sessionId)) next.delete(sessionId);
            else next.add(sessionId);
            return next;
        });
    };

    const toggleDay = (daySessions) => {
        setSelected((prev) => {
            const ids = daySessions.filter(selectable).map((s) => s.session_id);
            const allOn = ids.every((id) => prev.has(id));
            const next = new Set(prev);
            ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
            return next;
        });
    };

    const save = async (writeNotes = false) => {
        if (selected.size === 0) return;
        setSaving(true);
        try {
            await companionApi.importBatch([...selected], {
                generate: writeNotes,
                templateKey: writeNotes ? templateKey || undefined : undefined,
            });
            setSelected(new Set());
            setShowOption(false);
            await mutate();
        } catch {
            // toast already raised
        } finally {
            setSaving(false);
        }
    };

    const statusLine = () => {
        if (savingCount > 0) {
            return t("settings.companion.modalSaving", { count: savingCount });
        }
        if (!phoneConnected) {
            return t("settings.companion.modalPhoneClosed");
        }
        if (readyCount === 0 && sessions.length === 0) {
            return t("settings.companion.modalUpToDate");
        }
        return t("settings.companion.modalReady", { count: readyCount });
    };

    return (
        <Dialog.Root
            open={isOpen}
            onOpenChange={(e) => {
                if (!e.open) onClose();
            }}
            size="lg"
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content className="modal-style">
                        <Dialog.Header>
                            <Heading as="h2" size="md" fontFamily="heading">
                                {t("settings.companion.modalTitle")}
                            </Heading>
                        </Dialog.Header>
                        <Dialog.CloseTrigger />
                        <Dialog.Body maxH="70vh" overflowY="auto" className="custom-scrollbar">
                            {/* Plain-language status line */}
                            <HStack
                                gap={2}
                                pb={4}
                                color={phoneConnected ? "textPrimary" : "textSecondary"}
                                fontSize="sm"
                            >
                                <Icon
                                    as={phoneConnected ? LuCheck : LuSmartphone}
                                    color={phoneConnected ? "successButton" : "textSecondary"}
                                    boxSize={4}
                                />
                                <Text>{statusLine()}</Text>
                            </HStack>

                            {sessions.length === 0 ? (
                                <Text fontSize="sm" color="textSecondary">
                                    {t("settings.companion.modalEmptyFriendly")}
                                </Text>
                            ) : (
                                <VStack gap={4} align="stretch">
                                    {groups.map(([day, daySessions]) => {
                                        const selectableIds = daySessions
                                            .filter(selectable)
                                            .map((s) => s.session_id);
                                        const selectedHere = selectableIds.filter((id) =>
                                            selected.has(id),
                                        ).length;
                                        const dayState =
                                            selectableIds.length > 0 &&
                                            selectedHere === selectableIds.length
                                                ? true
                                                : selectedHere > 0
                                                  ? "indeterminate"
                                                  : false;
                                        return (
                                            <VStack key={day || "none"} gap={1} align="stretch">
                                                <HStack
                                                    justify="space-between"
                                                    borderBottom="1px solid"
                                                    borderColor="border"
                                                    pb={1}
                                                >
                                                    <Checkbox.Root
                                                        size="md"
                                                        checked={dayState}
                                                        onCheckedChange={() =>
                                                            toggleDay(daySessions)
                                                        }
                                                    >
                                                        <Checkbox.HiddenInput />
                                                        <Checkbox.Control>
                                                            <Checkbox.Indicator />
                                                        </Checkbox.Control>
                                                        <Checkbox.Label
                                                            fontWeight="semibold"
                                                        >
                                                            {day ||
                                                                t("settings.companion.modalNoDate")}
                                                        </Checkbox.Label>
                                                    </Checkbox.Root>
                                                    <Text fontSize="xs" color="textSecondary">
                                                        {t(
                                                            "settings.companion.modalDayCount",
                                                            { count: daySessions.length },
                                                        )}
                                                    </Text>
                                                </HStack>
                                                {daySessions.map((session) => (
                                                    <SessionLine
                                                        key={session.session_id}
                                                        session={session}
                                                        checked={selected.has(
                                                            session.session_id,
                                                        )}
                                                        onToggle={() =>
                                                            toggle(session.session_id)
                                                        }
                                                    />
                                                ))}
                                            </VStack>
                                        );
                                    })}
                                </VStack>
                            )}
                        </Dialog.Body>
                        <Dialog.Footer>
                            <VStack gap={2} align="stretch" width="100%">
                                {showOption && (
                                    <HStack justify="space-between">
                                        <Text fontSize="xs" color="textSecondary">
                                            {t("settings.companion.modalTemplateHint")}
                                        </Text>
                                        <NativeSelect.Root size="sm" width="240px">
                                            <NativeSelect.Field
                                                value={templateKey}
                                                onChange={(e) =>
                                                    setTemplateKey(e.target.value)
                                                }
                                                className="input-style"
                                            >
                                                <option value="">
                                                    {t("settings.companion.modalDefaultTemplate")}
                                                </option>
                                                {templates?.map((tpl) => (
                                                    <option
                                                        key={tpl.template_key}
                                                        value={tpl.template_key}
                                                    >
                                                        {tpl.template_name}
                                                    </option>
                                                ))}
                                            </NativeSelect.Field>
                                            <NativeSelect.Indicator />
                                        </NativeSelect.Root>
                                    </HStack>
                                )}
                                <HStack justify="space-between" width="100%">
                                    <Button
                                        size="sm"
                                        variant="plain"
                                        color="textSecondary"
                                        _hover={{ color: "textPrimary" }}
                                        disabled={selected.size === 0 || saving}
                                        onClick={() => setShowOption((v) => !v)}
                                    >
                                        {showOption
                                            ? t("settings.companion.modalHideOption")
                                            : t("settings.companion.modalWriteNotesOption")}
                                    </Button>
                                    <HStack gap={2}>
                                        {showOption && (
                                            <Button
                                                className="green-button"
                                                loading={saving}
                                                disabled={selected.size === 0}
                                                onClick={() => save(true)}
                                            >
                                                {t(
                                                    "settings.companion.modalSaveAndWrite",
                                                    { count: selected.size },
                                                )}
                                            </Button>
                                        )}
                                        <Button
                                            className="green-button"
                                            loading={saving}
                                            disabled={selected.size === 0}
                                            onClick={() => save(false)}
                                        >
                                            {showOption
                                                ? t("settings.companion.modalSaveOnly", {
                                                      count: selected.size,
                                                  })
                                                : t("settings.companion.modalSave", {
                                                      count: selected.size,
                                                  })}
                                        </Button>
                                        <Button
                                            className="grey-button"
                                            onClick={onClose}
                                        >
                                            {t("action.close")}
                                        </Button>
                                    </HStack>
                                </HStack>
                            </VStack>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
};


const SessionLine = ({ session, checked, onToggle }) => {
    const { t } = useTranslation();
    const when = [sessionTime(session), formatDuration(session.started_at, session.ended_at)]
        .filter(Boolean)
        .join(" · ");
    const failed = session.status === "failed";
    const inProgress = session.status === "processing";

    return (
        <HStack
            gap={3}
            pl={2}
            py={1.5}
            align="center"
            borderRadius="md"
            _hover={{ bg: "surfaceMuted" }}
            opacity={inProgress ? 0.6 : 1}
            cursor={inProgress ? "default" : "pointer"}
            onClick={inProgress ? undefined : onToggle}
        >
            <Checkbox.Root
                size="md"
                checked={checked}
                disabled={inProgress}
                onCheckedChange={onToggle}
            >
                <Checkbox.HiddenInput />
                <Checkbox.Control>
                    <Checkbox.Indicator />
                </Checkbox.Control>
            </Checkbox.Root>
            <Box minW={0} flex="1">
                <Text fontWeight="medium" isTruncated>
                    {session.patient_display_name ||
                        session.patient_ur_number ||
                        t("settings.companion.consultation")}
                </Text>
                <Text fontSize="xs" color="textSecondary" isTruncated>
                    {when}
                </Text>
            </Box>
            {failed && (
                <HStack gap={1} color="dangerButton" fontSize="xs" pr={2}>
                    <Icon as={LuCircleAlert} boxSize={3.5} />
                    <Text>{t("settings.companion.modalProblem")}</Text>
                </HStack>
            )}
            {inProgress && (
                <Text fontSize="xs" color="textSecondary" pr={2}>
                    {t("settings.companion.modalSavingOne")}
                </Text>
            )}
        </HStack>
    );
};

export default CompanionImportModal;
