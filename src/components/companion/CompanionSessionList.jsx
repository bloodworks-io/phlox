import { useState } from "react";
import { useNavigate } from "react-router";
import useSWR from "swr";
import {
    Box,
    Button,
    Collapsible,
    Flex,
    HStack,
    Spinner,
    Text,
    VStack,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { companionApi } from "../../utils/api/companionApi";
import { KEYS } from "../../utils/cache/keys";
import ConfirmDialog from "../common/ConfirmDialog";
import { SessionStatusIcon, sessionDetails } from "./sessionUi";

// The companion session management list: every uploaded phone session with
// its status, transcript viewer, retry/convert, and dismiss. Shared surface
// for the User Settings Phone Companion tab.

const SessionRow = ({ session, onRetry, onDismiss, onOpenNote, onView }) => {
    const { t } = useTranslation();
    const details = sessionDetails(session, t);

    return (
        <Box p={2} borderRadius="md" border="1px solid" borderColor="border">
            <Flex justify="space-between" align="center" gap={2}>
                <HStack align="center" gap={2} minW={0}>
                    <SessionStatusIcon status={session.status} />
                    <Box minW={0}>
                        <Text
                            fontSize="sm"
                            fontWeight="medium"
                            color="textPrimary"
                            isTruncated
                        >
                            {session.patient_display_name ||
                                session.patient_ur_number ||
                                t("settings.companion.quickCapture")}
                        </Text>
                        <Text fontSize="xs" color="textSecondary" isTruncated>
                            {details}
                        </Text>
                    </Box>
                </HStack>
                <HStack gap={1}>
                    {session.status === "imported" && session.encounter_id && (
                        <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => onOpenNote(session)}
                        >
                            {t("settings.companion.openNote")}
                        </Button>
                    )}
                    {(session.status === "failed" ||
                        session.status === "received") && (
                        <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => onRetry(session)}
                        >
                            {session.status === "received"
                                ? t("settings.companion.file")
                                : t("settings.companion.retry")}
                        </Button>
                    )}
                    {(session.status === "failed" ||
                        session.status === "received") && (
                        <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => onView(session)}
                        >
                            {t("settings.companion.viewTranscript")}
                        </Button>
                    )}
                    {session.status !== "processing" && (
                        <Button
                            size="xs"
                            variant="ghost"
                            color="dangerButton"
                            onClick={() => onDismiss(session)}
                        >
                            {t("settings.companion.dismiss")}
                        </Button>
                    )}
                </HStack>
            </Flex>
            {session.status === "failed" && session.error && (
                <Text fontSize="xs" color="dangerButton" pt={1} px={6} noOfLines={2}>
                    {session.error}
                </Text>
            )}
            <Collapsible.Root
                open={session.expanded}
                onOpenChange={() => onView(session)}
            >
                <Collapsible.Content>
                    <Box
                        mt={2}
                        mx={6}
                        p={2}
                        borderRadius="md"
                        bg="surfaceMuted"
                        maxHeight="240px"
                        overflowY="auto"
                    >
                        {session.utterances ? (
                            session.utterances.map((u, i) => (
                                <Text key={i} fontSize="xs" fontFamily="monospace">
                                    {u.speaker ? `${u.speaker}: ` : ""}
                                    {u.text}
                                </Text>
                            ))
                        ) : (
                            <Spinner size="xs" />
                        )}
                    </Box>
                </Collapsible.Content>
            </Collapsible.Root>
        </Box>
    );
};

const CompanionSessionList = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [dismissTarget, setDismissTarget] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [transcripts, setTranscripts] = useState({});

    const { data, mutate } = useSWR(
        KEYS.COMPANION_SESSIONS,
        companionApi.fetchSessions,
        { refreshInterval: 5000, revalidateOnMount: true },
    );
    const sessions = data?.sessions ?? [];

    const handleRetry = async (session) => {
        try {
            await companionApi.retrySession(session.session_id);
            await mutate();
        } catch {
            // toast already raised
        }
    };

    const handleView = async (session) => {
        if (expandedId === session.session_id) {
            setExpandedId(null);
            return;
        }
        setExpandedId(session.session_id);
        if (!transcripts[session.session_id]) {
            try {
                const document = await companionApi.fetchDocument(
                    session.session_id,
                );
                setTranscripts((prev) => ({
                    ...prev,
                    [session.session_id]: document?.utterances ?? [],
                }));
            } catch {
                setTranscripts((prev) => ({
                    ...prev,
                    [session.session_id]: [],
                }));
            }
        }
    };

    const confirmDismiss = async () => {
        if (!dismissTarget) return;
        try {
            await companionApi.dismissSession(dismissTarget.session_id);
            await mutate();
        } catch {
            // toast already raised
        }
        setDismissTarget(null);
    };

    const rows = sessions.map((session) => ({
        ...session,
        expanded: expandedId === session.session_id,
        utterances: transcripts[session.session_id],
    }));

    return (
        <VStack gap={3} align="stretch">
            <Text fontSize="sm" fontWeight="medium">
                {t("settings.companion.sessionsTitle")}
            </Text>
            {rows.length === 0 ? (
                <Text fontSize="xs" color="textSecondary">
                    {t("settings.companion.empty")}
                </Text>
            ) : (
                <VStack gap={2} align="stretch">
                    {rows.map((session) => (
                        <SessionRow
                            key={session.session_id}
                            session={session}
                            onRetry={handleRetry}
                            onDismiss={setDismissTarget}
                            onOpenNote={(s) => navigate(`/note/${s.encounter_id}`)}
                            onView={handleView}
                        />
                    ))}
                </VStack>
            )}

            <ConfirmDialog
                isOpen={!!dismissTarget}
                onClose={() => setDismissTarget(null)}
                onConfirm={confirmDismiss}
                title={t("settings.companion.dismissTitle")}
                body={t("settings.companion.dismissBody", {
                    patient:
                        dismissTarget?.patient_display_name ||
                        t("settings.companion.quickCapture"),
                })}
                confirmLabel={t("settings.companion.dismiss")}
            />
        </VStack>
    );
};

export default CompanionSessionList;
