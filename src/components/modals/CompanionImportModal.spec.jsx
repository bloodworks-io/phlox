import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompanionImportModal from "./CompanionImportModal";
import { renderWithProviders } from "../../test/utils";

const state = vi.hoisted(() => ({
    mutate: vi.fn(async () => undefined),
    mutateStatus: vi.fn(async () => undefined),
    sessions: [
        {
            session_id: "received-1",
            status: "received",
            patient_display_name: "Alice Nguyen",
            started_at: "2026-10-27T09:00:00",
            ended_at: "2026-10-27T09:12:00",
        },
        {
            session_id: "failed-1",
            status: "failed",
            patient_display_name: "Bob Chen",
            started_at: "2026-10-27T10:00:00",
            ended_at: "2026-10-27T10:08:00",
        },
        {
            session_id: "processing-1",
            status: "processing",
            patient_display_name: "Processing patient",
            started_at: "2026-10-27T11:00:00",
            ended_at: "2026-10-27T11:05:00",
        },
        {
            session_id: "imported-1",
            status: "imported",
            patient_display_name: "Already imported",
            started_at: "2026-10-27T08:00:00",
            ended_at: "2026-10-27T08:05:00",
        },
    ],
}));
const mutate = state.mutate;
const mutateStatus = state.mutateStatus;
const sessions = state.sessions;
const api = vi.hoisted(() => ({
    triggerSync: vi.fn(async () => undefined),
    importBatch: vi.fn(async () => undefined),
}));

vi.mock("../../utils/api/companionApi", () => ({
    companionApi: {
        fetchSessions: vi.fn(),
        fetchStatus: vi.fn(),
        triggerSync: api.triggerSync,
        importBatch: api.importBatch,
    },
}));
vi.mock("../../utils/api/templateApi", () => ({
    templateApi: {
        fetchTemplates: vi.fn(),
    },
}));

const swrMock = vi.hoisted(() => vi.fn());

vi.mock("swr", () => ({
    default: swrMock,
    useSWR: swrMock,
}));

swrMock.mockImplementation((key) => {
    if (Array.isArray(key) && key[0] === "companionTemplates") {
        return {
            data: [
                {
                    template_key: "general",
                    template_name: "General practice",
                    is_active: true,
                },
            ],
        };
    }
    if (Array.isArray(key) && key[0] === "companionSessions") {
        return { data: { sessions }, mutate };
    }
    if (Array.isArray(key) && key[0] === "companionStatus") {
        return {
            data: {
                phone: { connected: true },
                pairing_code: "AB1234",
            },
            mutate: mutateStatus,
        };
    }
    return { data: undefined };
});

const renderModal = (isOpen = true) =>
    renderWithProviders(<CompanionImportModal isOpen={isOpen} onClose={vi.fn()} />);

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("CompanionImportModal", () => {
    it("triggers phone sync and renders selectable, failed, and processing sessions", async () => {
        renderModal();

        await waitFor(() =>
            expect(api.triggerSync).toHaveBeenCalledTimes(1),
        );
        expect(screen.getByText(/saving 1 consultation/i)).toBeInTheDocument();
        expect(screen.getByText("Alice Nguyen")).toBeInTheDocument();
        expect(screen.getByText("Bob Chen")).toBeInTheDocument();
        expect(screen.getByText("Processing patient")).toBeInTheDocument();
        expect(
            screen.getByText("Saving 1 consultation…"),
        ).toBeInTheDocument();
        expect(
            screen.queryByText("Already imported"),
        ).not.toBeInTheDocument();
    });

    it("keeps save actions disabled until a session is selected", async () => {
        renderModal();

        const save = screen.getByRole("button", { name: /save 0 to records/i });
        expect(save).toBeDisabled();

        await userEvent.click(screen.getByText("Alice Nguyen"));
        expect(
            screen.getByRole("button", { name: /save 1 to records/i }),
        ).toBeEnabled();
    });

    it("saves selected sessions without generating notes", async () => {
        renderModal();
        await userEvent.click(screen.getByText("Alice Nguyen"));

        await userEvent.click(
            screen.getByRole("button", { name: /save 1 to records/i }),
        );

        await waitFor(() =>
            expect(api.importBatch).toHaveBeenCalledWith(["received-1"], {
                generate: false,
                templateKey: undefined,
            }),
        );
    });

    it("saves selected sessions with a chosen note template", async () => {
        renderModal();
        await userEvent.click(screen.getByText("Bob Chen"));
        await userEvent.click(
            screen.getByRole("button", { name: /write the notes as well/i }),
        );

        const templateSelect = document.querySelector("select");
        await userEvent.selectOptions(templateSelect, "general");

        await userEvent.click(
            screen.getByRole("button", { name: /save & write 1 note/i }),
        );

        await waitFor(() =>
            expect(api.importBatch).toHaveBeenCalledWith(["failed-1"], {
                generate: true,
                templateKey: "general",
            }),
        );
    });

    it("prioritizes the saving status over the phone-ready status", async () => {
        const { useSWR } = await import("swr");
        useSWR.mockImplementation((key) => {
            if (Array.isArray(key) && key[0] === "companionSessions") {
                return {
                    data: {
                        sessions: [sessions[2]],
                    },
                    mutate,
                };
            }
            if (Array.isArray(key) && key[0] === "companionStatus") {
                return {
                    data: { phone: { connected: true } },
                    mutate: mutateStatus,
                };
            }
            if (Array.isArray(key) && key[0] === "companionTemplates") {
                return { data: [] };
            }
            return { data: undefined };
        });

        renderModal();

        await waitFor(() => expect(screen.getByText(/saving 1/i)).toBeInTheDocument());
    });

    it("does not trigger sync or render content while closed", () => {
        renderModal(false);

        expect(api.triggerSync).not.toHaveBeenCalled();
        expect(screen.queryByText("Alice Nguyen")).not.toBeInTheDocument();
    });
});
