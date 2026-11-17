import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompanionSessionList from "./CompanionSessionList";
import { renderWithProviders } from "../../test/utils";

const mutate = vi.fn(async () => undefined);
const api = vi.hoisted(() => ({
    fetchSessions: vi.fn(),
    fetchDocument: vi.fn(),
    retrySession: vi.fn(),
    dismissSession: vi.fn(),
}));

vi.mock("../../utils/api/companionApi", () => ({
    companionApi: api,
}));
vi.mock("react-router", () => ({
    useNavigate: vi.fn(() => vi.fn()),
}));
vi.mock("swr", () => ({
    default: vi.fn(() => ({
        data: {
            sessions: [
                {
                    session_id: "imported",
                    status: "imported",
                    encounter_id: 41,
                    patient_display_name: "Alice Nguyen",
                    started_at: "2026-10-27T09:00:00",
                    ended_at: "2026-10-27T09:12:00",
                },
                {
                    session_id: "received",
                    status: "received",
                    patient_ur_number: "UR00042",
                    started_at: "2026-10-27T10:00:00",
                    ended_at: "2026-10-27T10:08:00",
                },
                {
                    session_id: "failed",
                    status: "failed",
                    error: "Transcription failed",
                    started_at: "2026-10-27T11:00:00",
                    ended_at: "2026-10-27T11:07:00",
                },
                {
                    session_id: "processing",
                    status: "processing",
                    started_at: "2026-10-27T12:00:00",
                    ended_at: "2026-10-27T12:05:00",
                },
            ],
        },
        mutate,
    })),
}));

const renderList = () => renderWithProviders(<CompanionSessionList />);

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("CompanionSessionList", () => {
    it("renders imported, received, failed, and processing sessions", () => {
        renderList();

        expect(screen.getByText("Alice Nguyen")).toBeInTheDocument();
        expect(screen.getByText("UR00042")).toBeInTheDocument();
        expect(screen.getByText("Transcription failed")).toBeInTheDocument();
        expect(
            screen.getAllByText("Quick capture (no patient)"),
        ).toHaveLength(2);
    });

    it("exposes open-note, retry/file, transcript, and dismiss actions by status", () => {
        renderList();

        expect(screen.getByRole("button", { name: /open note/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^file$/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
        expect(
            screen.getAllByRole("button", { name: /^transcript$/i }),
        ).toHaveLength(2);
        expect(
            screen.getAllByRole("button", { name: /dismiss/i }),
        ).toHaveLength(3);
    });

    it("loads and displays a transcript on first expansion", async () => {
        api.fetchDocument.mockResolvedValueOnce({
            utterances: [{ speaker: "Clinician", text: "Review the ferritin." }],
        });
        renderList();

        fireEvent.click(
            screen.getAllByRole("button", { name: /^transcript$/i })[0],
        );

        await waitFor(() =>
            expect(api.fetchDocument).toHaveBeenCalledWith("received"),
        );
        expect(screen.getByText(/review the ferritin/i)).toBeInTheDocument();
    });

    it("keeps an empty transcript state when document loading fails", async () => {
        api.fetchDocument.mockRejectedValueOnce(new Error("No document"));
        renderList();

        fireEvent.click(
            screen.getAllByRole("button", { name: /^transcript$/i })[0],
        );

        await waitFor(() =>
            expect(api.fetchDocument).toHaveBeenCalledWith("received"),
        );
        expect(document.querySelector(".chakra-spinner")).not.toBeNull();
    });

    it("retries a failed session and refreshes the list", async () => {
        api.retrySession.mockResolvedValueOnce(undefined);
        renderList();

        fireEvent.click(screen.getByRole("button", { name: /retry/i }));
        await waitFor(() =>
            expect(api.retrySession).toHaveBeenCalledWith("failed"),
        );
        await waitFor(() => expect(mutate).toHaveBeenCalled());
    });

    it("confirms before dismissing a session", async () => {
        const user = userEvent.setup();
        api.dismissSession.mockResolvedValueOnce(undefined);
        renderList();

        await user.click(screen.getAllByRole("button", { name: /dismiss/i })[0]);

        const confirmButtons = await screen.findAllByRole("button", {
            name: /dismiss/i,
        });
        await user.click(confirmButtons.at(-1));

        await waitFor(() =>
            expect(api.dismissSession).toHaveBeenCalledWith("imported"),
        );
        await waitFor(() => expect(mutate).toHaveBeenCalled());
    });
});
