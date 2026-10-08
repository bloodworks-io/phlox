import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AudioRecorder } from "../audioRecorder";
import { liveAgentApi } from "../api/liveAgentApi";
import { toaster } from "@/components/ui/toaster";

// Let the flushed tail segment's transcription land before stop.
const TAIL_SETTLE_MS = 1200;
const FEEDBACK_DEBOUNCE_MS = 1500;
const MAX_STATUS_ITEMS = 8;

const TIDY_TICK_MS = 3 * 60_000;

export const useLiveAgent = ({
    patient,
    setPatient,
    currentTemplate,
    onRequestWrapUp,
    onLetterSaved,

    onNoteContentChanged,
}) => {
    const { t } = useTranslation();
    const [status, setStatus] = useState("idle"); // idle|connecting|live|stopping|review|error
    const [agentState, setAgentState] = useState("listening");
    const [transcripts, setTranscripts] = useState([]);
    const [statuses, setStatuses] = useState([]);
    const [artifacts, setArtifacts] = useState([]);
    const [stagedJobs, setStagedJobs] = useState([]);
    const [lastError, setLastError] = useState(null);
    const [backlog, setBacklog] = useState(0);
    const [fieldFlash, setFieldFlash] = useState({}); // {field_key: timestamp}

    const sessionIdRef = useRef(null);
    const recorderRef = useRef(null);
    const runningRef = useRef(false);
    const toastRef = useRef(false);
    const feedbackTimerRef = useRef(null);
    // Latest session content and status, readable inside stable callbacks
    // (stop/end transitions decide between "review" and "idle" from these).
    const transcriptsRef = useRef([]);
    const artifactsRef = useRef([]);
    const statusRef = useRef("idle");
    const agentStateRef = useRef("listening");
    const templateDataRef = useRef(patient?.template_data);
    const currentTemplateRef = useRef(currentTemplate);
    const patientRef = useRef(patient);
    const wrapUpRef = useRef(onRequestWrapUp);
    const letterSavedRef = useRef(onLetterSaved);
    const noteChangedRef = useRef(onNoteContentChanged);

    useEffect(() => {
        templateDataRef.current = patient?.template_data;
        patientRef.current = patient;
        currentTemplateRef.current = currentTemplate;
        wrapUpRef.current = onRequestWrapUp;
        letterSavedRef.current = onLetterSaved;
        noteChangedRef.current = onNoteContentChanged;
        transcriptsRef.current = transcripts;
        artifactsRef.current = artifacts;
        statusRef.current = status;
        agentStateRef.current = agentState;
    });

    const pushStatus = useCallback((content, kind = "info") => {
        setStatuses((prev) =>
            [{ id: `${Date.now()}-${Math.random()}`, content, kind }, ...prev].slice(
                0,
                MAX_STATUS_ITEMS,
            ),
        );
    }, []);

    const settleAfterSession = useCallback(() => {
        setStatus(
            transcriptsRef.current.length > 0 || artifactsRef.current.length > 0
                ? "review"
                : "idle",
        );
    }, []);

    const decodeBinaryArtifact = useCallback((artifact) => {
        if (!artifact?.data) return artifact;
        try {
            const bytes = Uint8Array.from(atob(artifact.data), (c) => c.charCodeAt(0));
            const blob = new Blob([bytes], {
                type: artifact.mime_type || "application/octet-stream",
            });
            return {
                ...artifact,
                size: artifact.size ?? bytes.length,
                url: URL.createObjectURL(blob),
            };
        } catch (error) {
            console.error("Failed to decode live artifact:", error);
            return artifact;
        }
    }, []);

    const handleEvent = useCallback(
        async (event) => {
            switch (event.type) {
                case "transcript": {
                    const line = event.speaker
                        ? `${event.speaker}: ${event.text}`
                        : event.text;
                    setTranscripts((prev) => [...prev, line]);
                    setPatient((prev) => ({
                        ...prev,
                        raw_transcription: prev.raw_transcription
                            ? `${prev.raw_transcription}\n${line}`
                            : line,
                    }));
                    noteChangedRef.current?.();
                    break;
                }
                case "field_update":
                    setPatient((prev) => ({
                        ...prev,
                        template_data: {
                            ...prev.template_data,
                            [event.field_key]: event.content,
                        },
                    }));
                    setFieldFlash((prev) => ({
                        ...prev,
                        [event.field_key]: Date.now(),
                    }));
                    pushStatus(
                        t("liveAgent.status.noteUpdated", {
                            field: event.field_key,
                        }),
                        "edit",
                    );
                    noteChangedRef.current?.();
                    break;
                // Replayed state on (re)connect: apply without the flash.
                case "field_state":
                    setPatient((prev) => ({
                        ...prev,
                        template_data: {
                            ...prev.template_data,
                            [event.field_key]: event.content,
                        },
                    }));
                    noteChangedRef.current?.();
                    break;
                case "agent_status":
                    pushStatus(event.content);
                    break;
                case "agent_state":
                    setAgentState(event.state);
                    break;
                case "backlog":
                    setBacklog(event.count ?? 0);
                    break;
                case "command_result":
                    pushStatus(event.content, "command");
                    break;
                case "artifact_staged": {
                    const artifact = decodeBinaryArtifact(event.artifact);
                    // Letters replace (refinement); other artifacts stack.
                    setArtifacts((prev) =>
                        artifact.type === "letter"
                            ? [
                                  ...prev.filter((a) => a.type !== "letter"),
                                  artifact,
                              ]
                            : [...prev, artifact],
                    );
                    pushStatus(
                        t("liveAgent.status.staged", {
                            name:
                                artifact.title ||
                                artifact.template_name ||
                                artifact.filename ||
                                t("liveAgent.status.artifact"),
                        }),
                        "artifact",
                    );
                    noteChangedRef.current?.();
                    break;
                }
                case "jobs_staged":
                    setStagedJobs(event.jobs || []);
                    pushStatus(t("liveAgent.status.jobsUpdated"), "command");
                    break;
                case "request_wrap_up":
                    pushStatus(t("liveAgent.status.openingWrapUp"), "command");
                    wrapUpRef.current?.();
                    break;
                case "letter_saved":
                    pushStatus(t("liveAgent.status.letterSaved"), "command");
                    letterSavedRef.current?.();
                    break;
                case "error":
                    console.error("Live agent error:", event.content);
                    if (!toastRef.current) {
                        toastRef.current = true;
                        toaster.create({
                            title: t("liveAgent.toast.error"),
                            description: event.content,
                            type: "error",
                            duration: 5000,
                        });
                    }
                    break;
                case "end":
                    runningRef.current = false;
                    sessionIdRef.current = null;
                    settleAfterSession();
                    setAgentState("listening");
                    setBacklog(0);
                    break;
                default:
                    break;
            }
        },
        [setPatient, pushStatus, decodeBinaryArtifact, settleAfterSession, t],
    );

    const consumeEvents = useCallback(
        async (sessionId) => {
            try {
                for await (const event of liveAgentApi.streamEvents(sessionId)) {
                    if (!runningRef.current) break;
                    await handleEvent(event);
                    if (event.type === "end") break;
                }
            } catch (error) {
                if (runningRef.current) {
                    console.error("Live event stream failed:", error);
                    runningRef.current = false;
                    sessionIdRef.current = null;

                    recorderRef.current?.stop()?.catch(() => {});
                    recorderRef.current = null;
                    setLastError(
                        t("liveAgent.error.streamEnded"),
                    );
                    setStatus("error");
                    setBacklog(0);
                }
            }
        },
        [handleEvent, t],
    );

    const startLive = useCallback(async () => {
        if (runningRef.current) return true;

        const current = patientRef.current;
        const template = currentTemplateRef.current;
        setStatus("connecting");
        try {
            const result = await liveAgentApi.startSession({
                note_id: current?.id ?? null,
                template_key: template?.template_key ?? null,
                template_data: current?.template_data ?? {},
                patient: {
                    name: current?.name ?? "",
                    dob: current?.dob ?? "",
                    gender: current?.gender ?? "",
                    ur_number: current?.ur_number ?? "",
                    encounter_date: current?.encounter_date ?? "",
                },
            });
            const sessionId = result?.session_id;
            if (!sessionId) throw new Error("No session id returned");

            const recorder = new AudioRecorder();
            await recorder.start();
            recorder.enableSegmentStreaming((blob) => {
                if (sessionIdRef.current !== sessionId) return;
                liveAgentApi.sendAudioChunk(sessionId, blob).catch((error) => {
                    console.error("Live audio upload failed:", error);
                    if (!toastRef.current) {
                        toastRef.current = true;
                        toaster.create({
                            title: t("liveAgent.toast.audioUploadFailed"),
                            description: t(
                                "liveAgent.toast.audioUploadFailedDescription",
                            ),
                            type: "warning",
                            duration: 5000,
                        });
                    }
                });
            });

            recorderRef.current = recorder;
            sessionIdRef.current = sessionId;
            runningRef.current = true;
            toastRef.current = false;
            setLastError(null);
            setTranscripts([]);
            setStatuses([]);
            setArtifacts([]);
            setStagedJobs([]);
            setFieldFlash({});
            setBacklog(0);
            setStatus("live");
            setAgentState("listening");
            consumeEvents(sessionId);
            return true;
        } catch (error) {
            console.error("Failed to start live session:", error);
            recorderRef.current?.stop()?.catch(() => {});
            recorderRef.current = null;
            setStatus("error");
            setLastError(error?.message || t("liveAgent.error.unknown"));
            return false;
        }
    }, [consumeEvents, t]);

    const stopLive = useCallback(async () => {
        const sessionId = sessionIdRef.current;
        if (!sessionId) return null;
        runningRef.current = false;
        setStatus("stopping");

        if (recorderRef.current) {
            const recorder = recorderRef.current;
            recorderRef.current = null;
            await recorder.stop().catch(() => {});
        }

        await new Promise((resolve) => setTimeout(resolve, TAIL_SETTLE_MS));

        // Flush any debounced field edits so the server's final state
        // includes them (the feedback debounce can outlive the settle wait).
        if (feedbackTimerRef.current) {
            clearTimeout(feedbackTimerRef.current);
            feedbackTimerRef.current = null;
        }
        const pendingFields = templateDataRef.current;
        if (pendingFields) {
            await liveAgentApi
                .sendFeedback(sessionId, pendingFields)
                .catch((error) => {
                    console.error("Live feedback flush failed:", error);
                });
        }

        try {
            const finalState = await liveAgentApi.stopSession(sessionId);
            if (finalState?.fields) {
                setPatient((prev) => ({
                    ...prev,
                    template_data: {
                        ...prev.template_data,
                        ...finalState.fields,
                    },
                }));
                noteChangedRef.current?.();
            }
            return finalState;
        } catch (error) {
            console.error("Failed to stop live session:", error);
            return null;
        } finally {
            sessionIdRef.current = null;
            settleAfterSession();
            setAgentState("listening");
            setBacklog(0);
        }
    }, [setPatient, settleAfterSession]);

    const retryLive = useCallback(async () => {
        if (runningRef.current) return true;
        setLastError(null);
        return startLive();
    }, [startLive]);

    const dismissReview = useCallback(() => {
        if (statusRef.current !== "review" && statusRef.current !== "error")
            return;
        setStatus("idle");
        setLastError(null);
        setBacklog(0);
        setTranscripts([]);
        setStatuses([]);
        setArtifacts([]);
        setStagedJobs([]);
        setFieldFlash({});
    }, []);

    // Called by WrapUpModal after the standard extract-jobs pipeline.
    const pushExtractedJobs = useCallback((actionItems) => {
        const sessionId = sessionIdRef.current;
        if (!sessionId || !Array.isArray(actionItems)) return;
        const jobs = actionItems.map((item) => ({
            text: String(item.text ?? ""),
            checked: item.checked !== false,
        }));
        liveAgentApi.pushJobs(sessionId, jobs).catch((error) => {
            console.error("Live jobs push failed:", error);
        });
    }, []);

    // Push clinician edits back to the agent (debounced snapshot diff).
    const templateDataKey = JSON.stringify(patient?.template_data);
    useEffect(() => {
        if (!runningRef.current) return;
        if (status !== "live") return;
        const sessionId = sessionIdRef.current;
        if (!sessionId) return;

        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => {
            const fields = templateDataRef.current;
            if (fields && sessionIdRef.current === sessionId) {
                liveAgentApi.sendFeedback(sessionId, fields).catch((error) => {
                    console.error("Live feedback failed:", error);
                });
            }
        }, FEEDBACK_DEBOUNCE_MS);

        return () => {
            if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        };
    }, [templateDataKey, status]);

    // Stop the session when leaving the page or switching patients.
    useEffect(() => {
        return () => {
            if (runningRef.current) {
                const sessionId = sessionIdRef.current;
                runningRef.current = false;
                recorderRef.current?.stop()?.catch(() => {});
                if (sessionId) {
                    liveAgentApi.stopSession(sessionId).catch(() => {});
                }
            }
        };
    }, [patient?.id]);

    const isLiveActive = ["connecting", "live", "stopping"].includes(status);

    useEffect(() => {
        if (status !== "live") return undefined;
        const id = window.setInterval(() => {
            const sessionId = sessionIdRef.current;
            if (!runningRef.current || !sessionId) return;
            if (agentStateRef.current === "working") return;
            liveAgentApi.requestTidy(sessionId).catch((error) => {
                console.error("Tidy tick request failed:", error);
            });
        }, TIDY_TICK_MS);
        return () => window.clearInterval(id);
    }, [status]);

    return {
        status,
        isLiveActive,
        agentState,
        transcripts,
        statuses,
        artifacts,
        stagedJobs,
        fieldFlash,
        lastError,
        backlog,
        startLive,
        stopLive,
        retryLive,
        dismissReview,
        pushExtractedJobs,
    };
};
