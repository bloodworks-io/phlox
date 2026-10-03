import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";
import DocumentExplorer from "./DocumentExplorer";
import { renderWithProviders } from "../../test/utils";
import { ragApi } from "../../utils/api/ragApi";
import { toaster } from "@/components/ui/toaster";
import { t } from "@/i18n";

vi.mock("../../utils/api/ragApi", () => ({
    ragApi: {
        fetchCollectionFiles: vi.fn(),
        fetchCollections: vi.fn(),
        renameCollection: vi.fn(),
        downloadPdf: vi.fn(),
    },
}));
vi.mock("@/components/ui/toaster", () => ({
    toaster: { create: vi.fn() },
}));

const collections = [
    { name: "influenza", files: [], loaded: false },
    { name: "diabetes", files: [], loaded: true },
];

let clickSpy;
let createObjectURL;
let revokeObjectURL;

beforeEach(() => {
    vi.clearAllMocks();
    createObjectURL = vi.fn(() => "blob:mock-url");
    revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {});
});

afterEach(() => {
    clickSpy.mockRestore();
    cleanup();
});

// Holds collection state like the real parent (KnowledgeBasePanel) so
// setCollections updates actually re-render the explorer.
function Harness(props = {}) {
    const [cols, setCols] = useState(collections);
    return (
        <DocumentExplorer
            isCollapsed={false}
            setIsCollapsed={() => {}}
            collections={cols}
            setCollections={setCols}
            loading={false}
            setItemToDelete={() => {}}
            {...props}
        />
    );
}

const renderExplorer = (props = {}) => renderWithProviders(<Harness {...props} />);

describe("DocumentExplorer", () => {
    it("renders every collection name", () => {
        renderExplorer();
        expect(screen.getByText("influenza")).toBeInTheDocument();
        expect(screen.getByText("diabetes")).toBeInTheDocument();
    });

    it("expanding an unloaded collection fetches and shows its files", async () => {
        vi.mocked(ragApi.fetchCollectionFiles).mockResolvedValue({
            files: [{ filename: "guide.pdf", title: "Flu Guide", has_pdf: true }],
        });
        renderExplorer();

        fireEvent.click(
            screen.getAllByLabelText(t("rag.toggleCollection") as string)[0],
        );

        await waitFor(() => {
            expect(ragApi.fetchCollectionFiles).toHaveBeenCalledWith("influenza");
        });
        await waitFor(() => {
            expect(screen.getByText("Flu Guide")).toBeInTheDocument();
        });
    });

    it("fetch failure shows an error toast", async () => {
        vi.mocked(ragApi.fetchCollectionFiles).mockRejectedValue(
            new Error("boom"),
        );
        renderExplorer();

        fireEvent.click(
            screen.getAllByLabelText(t("rag.toggleCollection") as string)[0],
        );

        await waitFor(() => {
            expect(toaster.create).toHaveBeenCalledWith(
                expect.objectContaining({ type: "error" }),
            );
        });
    });

    it("download button fetches the blob and triggers a file download", async () => {
        vi.mocked(ragApi.fetchCollectionFiles).mockResolvedValue({
            files: [{ filename: "guide.pdf", title: "Flu Guide", has_pdf: true }],
        });
        const blob = new Blob(["pdf"], { type: "application/pdf" });
        vi.mocked(ragApi.downloadPdf).mockResolvedValue(blob);
        renderExplorer();

        fireEvent.click(
            screen.getAllByLabelText(t("rag.toggleCollection") as string)[0],
        );
        const download = await screen.findByLabelText(
            t("rag.downloadPdf") as string,
        );
        fireEvent.click(download);

        await waitFor(() => {
            expect(ragApi.downloadPdf).toHaveBeenCalledWith(
                "influenza",
                "guide.pdf",
            );
        });
        await waitFor(() => {
            expect(clickSpy).toHaveBeenCalledTimes(1);
        });
        expect(clickSpy.mock.instances[0].download).toBe("guide.pdf");
    });

    it("delete collection button targets the collection", () => {
        const setItemToDelete = vi.fn();
        renderExplorer({ setItemToDelete });

        fireEvent.click(
            screen.getAllByLabelText(t("rag.deleteCollection") as string)[0],
        );
        expect(setItemToDelete).toHaveBeenCalledWith({
            type: "collection",
            name: "influenza",
            collection: null,
        });
    });

    it("delete file button targets the file within its collection", async () => {
        vi.mocked(ragApi.fetchCollectionFiles).mockResolvedValue({
            files: [{ filename: "guide.pdf", title: "Flu Guide", has_pdf: false }],
        });
        const setItemToDelete = vi.fn();
        renderExplorer({ setItemToDelete });

        fireEvent.click(
            screen.getAllByLabelText(t("rag.toggleCollection") as string)[0],
        );
        const deleteFile = await screen.findByLabelText(
            t("rag.deleteFile") as string,
        );
        fireEvent.click(deleteFile);

        expect(setItemToDelete).toHaveBeenCalledWith({
            type: "file",
            name: "guide.pdf",
            collection: "influenza",
        });
    });

    it("rename via prompt renames and refetches collections", async () => {
        vi.stubGlobal(
            "prompt",
            vi.fn(() => "renamed-flu"),
        );
        const setCollections = vi.fn();
        vi.mocked(ragApi.renameCollection).mockResolvedValue({});
        vi.mocked(ragApi.fetchCollections).mockResolvedValue({
            files: ["renamed-flu"],
        });
        renderExplorer({ setCollections });

        fireEvent.click(
            screen.getAllByLabelText(t("rag.renameCollection") as string)[0],
        );

        await waitFor(() => {
            expect(ragApi.renameCollection).toHaveBeenCalledWith(
                "influenza",
                "renamed-flu",
            );
        });
        await waitFor(() => {
            expect(setCollections).toHaveBeenCalledWith([
                { name: "renamed-flu", files: [], loaded: false },
            ]);
        });
        vi.unstubAllGlobals();
    });

    it("cancelled rename does nothing", () => {
        vi.stubGlobal("prompt", vi.fn(() => null));
        renderExplorer();

        fireEvent.click(
            screen.getAllByLabelText(t("rag.renameCollection") as string)[0],
        );

        expect(ragApi.renameCollection).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });
});
