import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { useLiveAgent } from "./useLiveAgent";
import type { Patient } from "../patient/types";

const liveAgentApiMock = vi.hoisted(() => ({
    startSession: vi.fn(),
    sendAudioChunk: vi.fn(),
    sendFeedback: vi.fn(),
    requestTidy: vi.fn(),
    pushJobs: vi.fn(),
    stopSession: vi.fn(),
    getCitations: vi.fn(),
    streamEvents: vi.fn(),
}));

const patientApiMock = vi.hoisted(() => ({ groundNote: vi.fn() }));

vi.mock("../api/liveAgentApi", () => ({ liveAgentApi: liveAgentApiMock }));
vi.mock("../api/patientApi", () => ({ patientApi: patientApiMock }));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../audioRecorder", () => {
    class FakeRecorder {
        onSegment: ((blob: Blob) => void) | null = null;

        async start() {}

        enableSegmentStreaming(callback: (blob: Blob) => void) {
            this.onSegment = callback;
        }

        async stop() {}
    }
    return { AudioRecorder: FakeRecorder };
});

const makePatient = (overrides: Record<string, unknown> = {}) =>
    ({
        id: 7,
        name: "Test",
        raw_transcription: "",
        template_data: {},
        ...overrides,
    }) as unknown as Patient;

const setup = (patient: Patient) =>
    renderHook(() => {
        const [current, setPatient] = useState(patient);
        const api = useLiveAgent({
            patient: current,
            setPatient,
            currentTemplate: null,
            onRequestWrapUp: vi.fn(),
            onLetterSaved: vi.fn(),
            onNoteContentChanged: vi.fn(),
        });
        return { patient: current, setPatient, api };
    });

describe("useLiveAgent stop", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        liveAgentApiMock.startSession.mockResolvedValue({ session_id: "sess-1" });
        liveAgentApiMock.sendAudioChunk.mockResolvedValue(true);
        liveAgentApiMock.sendFeedback.mockResolvedValue(true);
        liveAgentApiMock.stopSession.mockResolvedValue({
            session_id: "sess-1",
            fields: {},
            agent_edits: {},
            transcript: "",
        });
        liveAgentApiMock.streamEvents.mockImplementation(async function* () {});
    });

    it("applies the server transcript and warm citations, including a tail line the event stream dropped", async () => {
        const { result } = setup(makePatient());
        await act(async () => {
            await result.current.api.startLive();
        });
        // No transcript events ever arrived (the late-tail race).
        expect(result.current.patient.raw_transcription).toBe("");

        liveAgentApiMock.stopSession.mockResolvedValue({
            session_id: "sess-1",
            fields: { plan: "1. Review" },
            agent_edits: { plan: "agent" },
            transcript: "S1: a\nS2: tail the UI never saw",
        });
        liveAgentApiMock.getCitations.mockResolvedValue({
            status: "ready",
            citations: {
                transcript_line_count: 2,
                resolved: [],
                fields: {
                    plan: [
                        {
                            line_index: 0,
                            text: "1. Review",
                            sources: [0],
                            contradicts: [],
                            verdict: "supported",
                        },
                    ],
                },
            },
        });

        await act(async () => {
            await result.current.api.stopLive();
        });

        // The server transcript is the source of truth, so the citation
        // line-count gate (transcript_line_count === raw lines) holds.
        expect(result.current.patient.raw_transcription).toBe("S1: a\nS2: tail the UI never saw");
        expect(result.current.patient.template_data?.plan).toBe("1. Review");
        await waitFor(() => {
            expect(result.current.patient.note_citations?.transcript_line_count).toBe(2);
        });
        expect(result.current.patient.note_citations?.transcript_line_count).toBe(
            result.current.patient.raw_transcription?.split("\n").length,
        );
        expect(liveAgentApiMock.getCitations).toHaveBeenCalledWith("sess-1");
        expect(patientApiMock.groundNote).not.toHaveBeenCalled();
    });

    it("grounds resumed notes cold over the full transcript with the session-start baseline", async () => {
        const { result } = setup(
            makePatient({ raw_transcription: "PRIOR line", template_data: { pmh: "old" } }),
        );
        await act(async () => {
            await result.current.api.startLive();
        });

        liveAgentApiMock.stopSession.mockResolvedValue({
            session_id: "sess-1",
            fields: {},
            agent_edits: {},
            transcript: "S1: new",
        });
        patientApiMock.groundNote.mockResolvedValue({
            transcript_line_count: 2,
            resolved: [],
            fields: { pmh: [] },
        });

        await act(async () => {
            await result.current.api.stopLive();
        });

        await waitFor(() => expect(patientApiMock.groundNote).toHaveBeenCalled());
        // The warm turn is skipped: session-relative [N] indices cannot map
        // onto a transcript with a prior prefix.
        expect(liveAgentApiMock.getCitations).not.toHaveBeenCalled();
        const request = patientApiMock.groundNote.mock.calls[0][0];
        expect(request.raw_transcription).toBe("PRIOR line\nS1: new");
        expect(request.baseline_fields).toEqual({ pmh: "old" });
        expect(result.current.patient.raw_transcription).toBe("PRIOR line\nS1: new");
        await waitFor(() => {
            expect(result.current.patient.note_citations?.transcript_line_count).toBe(2);
        });
    });

    it("falls back to cold grounding when the warm turn fails", async () => {
        const { result } = setup(makePatient());
        await act(async () => {
            await result.current.api.startLive();
        });

        liveAgentApiMock.stopSession.mockResolvedValue({
            session_id: "sess-1",
            fields: {},
            agent_edits: {},
            transcript: "S1: only line",
        });
        liveAgentApiMock.getCitations.mockResolvedValue({ status: "failed" });
        patientApiMock.groundNote.mockResolvedValue({
            transcript_line_count: 1,
            resolved: [],
            fields: {
                plan: [
                    {
                        line_index: 0,
                        text: "1. Review",
                        sources: [0],
                        contradicts: [],
                        verdict: "supported",
                    },
                ],
            },
        });

        await act(async () => {
            await result.current.api.stopLive();
        });

        await waitFor(() => expect(patientApiMock.groundNote).toHaveBeenCalled());
        expect(patientApiMock.groundNote.mock.calls[0][0].raw_transcription).toBe("S1: only line");
        await waitFor(() => {
            expect(result.current.patient.note_citations?.fields?.plan).toBeDefined();
        });
    });
});

describe("useLiveAgent note switching", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        liveAgentApiMock.startSession.mockResolvedValue({ session_id: "sess-1" });
        liveAgentApiMock.sendAudioChunk.mockResolvedValue(true);
        liveAgentApiMock.sendFeedback.mockResolvedValue(true);
        liveAgentApiMock.streamEvents.mockImplementation(async function* () {});
    });

    const stopWithAgentEdits = async (
        result: ReturnType<typeof setup>["result"],
    ) => {
        liveAgentApiMock.stopSession.mockResolvedValue({
            session_id: "sess-1",
            fields: {},
            agent_edits: { plan: "agent" },
            transcript: "S1: a",
        });
        await act(async () => {
            await result.current.api.stopLive();
        });
        expect(result.current.api.agentEdits).toEqual({ plan: "agent" });
    };

    it("clears agent-edit markers when a new encounter loads", async () => {
        const { result } = setup(makePatient({ encounter_date: "2026-10-15" }));
        await act(async () => {
            await result.current.api.startLive();
        });
        await stopWithAgentEdits(result);

        await act(async () => {
            result.current.setPatient(
                makePatient({ id: null, encounter_date: "2026-10-16" }),
            );
        });

        expect(result.current.api.agentEdits).toEqual({});
        expect(result.current.api.fieldFlash).toEqual({});
    });

    it("keeps markers on the same note after stop", async () => {
        const { result } = setup(makePatient({ encounter_date: "2026-10-15" }));
        await act(async () => {
            await result.current.api.startLive();
        });
        await stopWithAgentEdits(result);

        // Clinician edits churn template_data, not the note identity.
        await act(async () => {
            result.current.setPatient(
                makePatient({
                    id: 7,
                    encounter_date: "2026-10-15",
                    template_data: { plan: "clinician tweak" },
                }),
            );
        });

        expect(result.current.api.agentEdits).toEqual({ plan: "agent" });
    });

    it("clears markers when switching to a different patient", async () => {
        const { result } = setup(makePatient({ encounter_date: "2026-10-15" }));
        await act(async () => {
            await result.current.api.startLive();
        });
        await stopWithAgentEdits(result);

        await act(async () => {
            result.current.setPatient(
                makePatient({ id: 99, name: "Other", encounter_date: "2026-10-15" }),
            );
        });

        expect(result.current.api.agentEdits).toEqual({});
    });
});
