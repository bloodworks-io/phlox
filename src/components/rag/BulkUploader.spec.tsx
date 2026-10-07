import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import BulkUploader from "./BulkUploader";
import { renderWithProviders } from "../../test/utils";
import { useBulkUploadQueue, STATUS } from "../../utils/hooks/useBulkUploadQueue";
import { toaster } from "@/components/ui/toaster";
import { t } from "@/i18n";

vi.mock("../../utils/hooks/useBulkUploadQueue", async (importOriginal) => ({
    ...(await importOriginal<
        typeof import("../../utils/hooks/useBulkUploadQueue")
    >()),
    useBulkUploadQueue: vi.fn(),
}));
vi.mock("@/components/ui/toaster", () => ({
    toaster: { create: vi.fn() },
}));

const pdf = (name = "doc.pdf") =>
    new File(["bytes"], name, { type: "application/pdf" });
const txt = (name = "notes.txt") => new File(["x"], name, { type: "text/plain" });

const queue = [
    {
        id: "q1",
        file: pdf("ready.pdf"),
        status: STATUS.EXTRACTED,
        error: null,
        metadata: {
            disease_name: "influenza",
            document_source: "WHO",
            focus_area: "guidelines",
        },
    },
    {
        id: "q2",
        file: pdf("pending.pdf"),
        status: STATUS.PENDING,
        error: null,
        metadata: null,
    },
    {
        id: "q3",
        file: pdf("failed.pdf"),
        status: STATUS.FAILED,
        error: "could not read",
        metadata: null,
    },
];

const mocks = {
    addFiles: vi.fn(),
    removeFromQueue: vi.fn(),
    updateQueueEntry: vi.fn(),
    updateMetadata: vi.fn(),
    extractAll: vi.fn(),
    commitAll: vi.fn(),
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useBulkUploadQueue).mockReturnValue({
        fileQueue: queue,
        isProcessing: false,
        ...mocks,
        extractedCount: 1,
        committedCount: 0,
        totalPending: 1,
        readyToCommit: 1,
        hasPendingOrFailed: true,
    } as ReturnType<typeof useBulkUploadQueue>);
});

afterEach(cleanup);

const drop = (files: File[]) => {
    const zone = screen.getByText(t("rag.dropZoneHint") as string).closest("div")!;
    fireEvent.drop(zone, { dataTransfer: { files } });
};

describe("BulkUploader", () => {
    it("renders one row per queue entry with filenames", () => {
        renderWithProviders(<BulkUploader setCollections={() => {}} />);
        expect(screen.getByText("ready.pdf")).toBeInTheDocument();
        expect(screen.getByText("pending.pdf")).toBeInTheDocument();
        expect(screen.getByText("failed.pdf")).toBeInTheDocument();
        expect(screen.getByText("could not read")).toBeInTheDocument();
    });

    it("drop filters to PDFs and warns about skipped files", () => {
        renderWithProviders(<BulkUploader setCollections={() => {}} />);
        drop([pdf("a.pdf"), pdf("b.pdf"), txt()]);

        expect(mocks.addFiles).toHaveBeenCalledTimes(1);
        expect(mocks.addFiles).toHaveBeenCalledWith([pdf("a.pdf"), pdf("b.pdf")]);
        expect(toaster.create).toHaveBeenCalledWith(
            expect.objectContaining({ type: "info" }),
        );
    });

    it("drop with no PDFs warns and adds nothing", () => {
        renderWithProviders(<BulkUploader setCollections={() => {}} />);
        drop([txt()]);

        expect(mocks.addFiles).not.toHaveBeenCalled();
        expect(toaster.create).toHaveBeenCalledWith(
            expect.objectContaining({ type: "warning" }),
        );
    });

    it("file input selection adds all files", () => {
        renderWithProviders(<BulkUploader setCollections={() => {}} />);
        const input = document.querySelector(
            "input[type=file][multiple]",
        ) as HTMLInputElement;
        fireEvent.change(input, { target: { files: [pdf("c.pdf")] } });

        expect(mocks.addFiles).toHaveBeenCalledWith([pdf("c.pdf")]);
    });

    it("pending and extracted rows can be removed", () => {
        renderWithProviders(<BulkUploader setCollections={() => {}} />);
        const removeButtons = screen.getAllByRole("button", {
            name: t("rag.removeFromQueue") as string,
        });
        // ready.pdf (extracted) and pending.pdf are removable; failed is not
        expect(removeButtons).toHaveLength(2);
        fireEvent.click(removeButtons[0]);
        expect(mocks.removeFromQueue).toHaveBeenCalledWith("q1");
    });

    it("metadata editor edits the extracted entry", () => {
        renderWithProviders(<BulkUploader setCollections={() => {}} />);
        fireEvent.click(
            screen.getByRole("button", { name: t("rag.editMetadata") as string }),
        );
        const diseaseInput = screen.getByDisplayValue("influenza");
        fireEvent.change(diseaseInput, { target: { value: "covid" } });

        expect(mocks.updateMetadata).toHaveBeenCalledWith(
            "q1",
            "disease_name",
            "covid",
        );
    });

    it("wires extract/commit actions with queue counts", () => {
        renderWithProviders(<BulkUploader setCollections={() => {}} />);
        fireEvent.click(
            screen.getByRole("button", { name: t("rag.extractAll") as string }),
        );
        expect(mocks.extractAll).toHaveBeenCalledTimes(1);

        const commit = screen.getByRole("button", {
            name: t("rag.commitAll") as string,
        });
        expect(commit).not.toBeDisabled();
        fireEvent.click(commit);
        expect(mocks.commitAll).toHaveBeenCalledTimes(1);
    });

    it("commits are disabled when nothing is ready", () => {
        vi.mocked(useBulkUploadQueue).mockReturnValue({
            fileQueue: queue,
            isProcessing: false,
            ...mocks,
            extractedCount: 0,
            committedCount: 0,
            totalPending: 3,
            readyToCommit: 0,
            hasPendingOrFailed: true,
        } as ReturnType<typeof useBulkUploadQueue>);
        renderWithProviders(<BulkUploader setCollections={() => {}} />);
        expect(
            screen.getByRole("button", { name: t("rag.commitAll") as string }),
        ).toBeDisabled();
    });
});
