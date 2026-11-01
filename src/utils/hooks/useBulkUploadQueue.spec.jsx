import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { STATUS, useBulkUploadQueue } from "./useBulkUploadQueue";
import { renderWithProviders } from "../../test/utils";

const ragApiMock = vi.hoisted(() => ({
    commitDirect: vi.fn(),
    commitToDatabase: vi.fn(),
    fetchCollections: vi.fn(),
}));

const extractMock = vi.hoisted(() => ({
    extractPdfMetadata: vi.fn(),
}));

const toasterMock = vi.hoisted(() => ({
    create: vi.fn(),
}));

vi.mock("../api/ragApi", () => ({ ragApi: ragApiMock }));
vi.mock("../helpers/pdfExtractHelpers", () => extractMock);
vi.mock("@/components/ui/toaster", () => ({ toaster: toasterMock }));

function Harness({ setCollections }) {
    const queue = useBulkUploadQueue({ setCollections });
    const [files] = useState([
        new File(["pdf-one"], "one.pdf", { type: "application/pdf" }),
        new File(["pdf-two"], "two.pdf", { type: "application/pdf" }),
    ]);

    return (
        <div>
            <button onClick={() => queue.addFiles(files)}>add</button>
            <button onClick={() => queue.extractAll()}>extract</button>
            <button onClick={() => queue.commitAll()}>commit</button>
            <button onClick={() => queue.removeFromQueue(queue.fileQueue[0].id)}>
                remove
            </button>
            <button
                onClick={() =>
                    queue.updateQueueEntry(queue.fileQueue[0].id, {
                        status: "manual",
                    })
                }
            >
                update
            </button>
            <ul>
                {queue.fileQueue.map((entry) => (
                    <li key={entry.id}>
                        {entry.file.name}:{entry.status}
                        {entry.error ? `:${entry.error}` : ""}
                    </li>
                ))}
            </ul>
            <output>
                {queue.extractedCount}/{queue.committedCount}/{queue.totalPending}/
                {queue.readyToCommit}/{String(queue.hasPendingOrFailed)}
            </output>
        </div>
    );
}

const renderHarness = () =>
    renderWithProviders(<Harness setCollections={vi.fn()} />);

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
});

describe("useBulkUploadQueue", () => {
    it("adds files as pending queue entries", () => {
        renderHarness();
        fireEvent.click(screen.getByRole("button", { name: "add" }));

        expect(screen.getByText("one.pdf:pending")).toBeInTheDocument();
        expect(screen.getByText("two.pdf:pending")).toBeInTheDocument();
        expect(screen.getByText("0/0/2/0/true")).toBeInTheDocument();
    });

    it("removes a selected queue entry", () => {
        renderHarness();
        fireEvent.click(screen.getByRole("button", { name: "add" }));
        fireEvent.click(screen.getByRole("button", { name: "remove" }));

        expect(screen.queryByText("one.pdf:pending")).not.toBeInTheDocument();
        expect(screen.getByText("two.pdf:pending")).toBeInTheDocument();
    });

    it("supports direct status updates for queue consumers", () => {
        renderHarness();
        fireEvent.click(screen.getByRole("button", { name: "add" }));
        fireEvent.click(screen.getByRole("button", { name: "update" }));

        expect(screen.getByText("one.pdf:manual")).toBeInTheDocument();
    });

    it("extracts PDF metadata and reports success", async () => {
        renderHarness();
        extractMock.extractPdfMetadata.mockResolvedValue({
            extractedText: "guideline text",
            pdfBase64: "cGRm",
            disease_name: "Guidelines",
            focus_area: "Anaemia",
            document_source: "Seed",
            filename: "one.pdf",
            title: "One",
        });

        fireEvent.click(screen.getByRole("button", { name: "add" }));
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "extract" }));
        });

        await waitFor(() =>
            expect(screen.getByText("2/0/0/2/false")).toBeInTheDocument(),
        );
        expect(toasterMock.create).toHaveBeenCalledWith(
            expect.objectContaining({ type: "success" }),
        );
    });

    it("marks extraction failures and reports a partial warning", async () => {
        renderHarness();
        extractMock.extractPdfMetadata
            .mockResolvedValueOnce({
                extractedText: "good text",
                disease_name: "Guidelines",
                focus_area: "Anaemia",
                document_source: "Seed",
                filename: "one.pdf",
                title: "One",
            })
            .mockRejectedValueOnce(new Error("Invalid PDF"));

        fireEvent.click(screen.getByRole("button", { name: "add" }));
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "extract" }));
        });

        await waitFor(() =>
            expect(screen.getByText("two.pdf:failed:Invalid PDF")).toBeInTheDocument(),
        );
        expect(toasterMock.create).toHaveBeenCalledWith(
            expect.objectContaining({ type: "warning" }),
        );
    });

    it("commits extracted text directly and refreshes collections", async () => {
        const setCollections = vi.fn();
        renderWithProviders(<Harness setCollections={setCollections} />);
        extractMock.extractPdfMetadata.mockResolvedValue({
            extractedText: "guideline text",
            pdfBase64: "cGRm",
            disease_name: "Guidelines",
            focus_area: "Anaemia",
            document_source: "Seed",
            filename: "one.pdf",
            title: "One",
        });
        ragApiMock.commitDirect.mockResolvedValue({});
        ragApiMock.fetchCollections.mockResolvedValue({
            files: ["Guidelines"],
        });

        fireEvent.click(screen.getByRole("button", { name: "add" }));
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "extract" }));
        });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "commit" }));
        });

        await waitFor(() =>
            expect(screen.getByText("2/2/0/0/false")).toBeInTheDocument(),
        );
        expect(ragApiMock.commitDirect).toHaveBeenCalledTimes(2);
        expect(setCollections).toHaveBeenCalledWith([
            { name: "Guidelines", files: [], loaded: false },
        ]);
    });

    it("uses the textless commit path when extraction has no text", async () => {
        renderHarness();
        extractMock.extractPdfMetadata.mockResolvedValue({
            extractedText: null,
            disease_name: "Guidelines",
            focus_area: "Anaemia",
            document_source: "Seed",
            filename: "one.pdf",
            title: "One",
        });
        ragApiMock.commitToDatabase.mockResolvedValue({});
        ragApiMock.fetchCollections.mockResolvedValue({ files: [] });

        fireEvent.click(screen.getByRole("button", { name: "add" }));
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "extract" }));
        });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "commit" }));
        });

        expect(ragApiMock.commitToDatabase).toHaveBeenCalledTimes(2);
        expect(ragApiMock.commitDirect).not.toHaveBeenCalled();
    });

    it("marks commit failures without losing the queue entry", async () => {
        renderHarness();
        extractMock.extractPdfMetadata.mockResolvedValue({
            extractedText: "guideline text",
            disease_name: "Guidelines",
            focus_area: "Anaemia",
            document_source: "Seed",
            filename: "one.pdf",
            title: "One",
        });
        ragApiMock.commitDirect.mockRejectedValue(new Error("Database full"));
        ragApiMock.fetchCollections.mockResolvedValue({ files: [] });

        fireEvent.click(screen.getByRole("button", { name: "add" }));
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "extract" }));
        });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "commit" }));
        });

        await waitFor(() =>
            expect(screen.getAllByText(/failed:Database full/)).toHaveLength(2),
        );
        expect(toasterMock.create).toHaveBeenCalledWith(
            expect.objectContaining({ type: "warning" }),
        );
    });

    it("keeps the public status vocabulary stable", () => {
        expect(STATUS).toEqual({
            PENDING: "pending",
            EXTRACTING: "extracting",
            EXTRACTED: "extracted",
            COMMITTING: "committing",
            COMMITTED: "committed",
            FAILED: "failed",
        });
    });
});
