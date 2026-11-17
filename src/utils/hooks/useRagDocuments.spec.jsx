import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { useRagDocuments } from "./useRagDocuments";
import { ragApi } from "../api/ragApi";
import { toaster } from "@/components/ui/toaster";
import { renderWithProviders } from "../../test/utils";

vi.mock("../api/ragApi", () => ({
    ragApi: {
        fetchCollections: vi.fn(),
        deleteFile: vi.fn(),
        deleteCollection: vi.fn(),
    },
}));
vi.mock("@/components/ui/toaster", () => ({
    toaster: { create: vi.fn() },
}));

function Harness() {
    const rag = useRagDocuments();
    return (
        <div>
            <ul>
                {rag.collections.map((c) => (
                    <li key={c.name}>
                        {c.name}:{String(c.loaded)}:{c.files.length}
                    </li>
                ))}
            </ul>
            <output data-testid="loading">{String(rag.loading)}</output>
            <output data-testid="pending">{rag.itemToDelete?.name ?? "none"}</output>
            <button
                onClick={() =>
                    rag.setItemToDelete({
                        type: "file",
                        name: "guide.pdf",
                        collection: "influenza",
                    })
                }
            >
                target-file
            </button>
            <button
                onClick={() =>
                    rag.setItemToDelete({
                        type: "collection",
                        name: "influenza",
                        collection: null,
                    })
                }
            >
                target-collection
            </button>
            <button onClick={rag.handleDelete}>confirm</button>
            <button onClick={rag.collapseExplorer.toggle}>toggle-explorer</button>
            <output data-testid="explorer">
                {String(rag.collapseExplorer.isCollapsed)}
            </output>
            <button onClick={rag.collapseUploader.toggle}>toggle-uploader</button>
            <output data-testid="uploader">
                {String(rag.collapseUploader.isCollapsed)}
            </output>
        </div>
    );
}

const renderHook = () => renderWithProviders(<Harness />);

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ragApi.fetchCollections).mockResolvedValue({
        files: ["influenza", "diabetes"],
    });
});

afterEach(cleanup);

describe("useRagDocuments", () => {
    it("loads collections as unloaded shells on mount", async () => {
        renderHook();

        await waitFor(() => {
            expect(screen.getByText("influenza:false:0")).toBeInTheDocument();
        });
        expect(screen.getByText("diabetes:false:0")).toBeInTheDocument();
        expect(screen.getByTestId("loading")).toHaveTextContent("false");
        expect(ragApi.fetchCollections).toHaveBeenCalledTimes(1);
    });

    it("toasts and stops loading when the initial fetch fails", async () => {
        vi.mocked(ragApi.fetchCollections).mockRejectedValue(
            new Error("chroma down"),
        );
        renderHook();

        await waitFor(() => {
            expect(toaster.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "error",
                    description: "chroma down",
                }),
            );
        });
        expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    it("deletes a file, refreshes collections, and clears the pending item", async () => {
        vi.mocked(ragApi.deleteFile).mockResolvedValue({});
        vi.mocked(ragApi.fetchCollections)
            .mockResolvedValueOnce({ files: ["influenza", "diabetes"] })
            .mockResolvedValueOnce({ files: ["diabetes"] });
        renderHook();
        await waitFor(() =>
            expect(screen.getByText("influenza:false:0")).toBeInTheDocument(),
        );

        fireEvent.click(screen.getByRole("button", { name: "target-file" }));
        expect(screen.getByTestId("pending")).toHaveTextContent("guide.pdf");
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "confirm" }));
        });

        await waitFor(() => {
            expect(ragApi.deleteFile).toHaveBeenCalledWith(
                "influenza",
                "guide.pdf",
            );
        });
        expect(ragApi.deleteCollection).not.toHaveBeenCalled();
        expect(ragApi.fetchCollections).toHaveBeenCalledTimes(2);
        await waitFor(() => {
            expect(screen.getByText("diabetes:false:0")).toBeInTheDocument();
        });
        expect(
            screen.queryByText("influenza:false:0"),
        ).not.toBeInTheDocument();
        expect(screen.getByTestId("pending")).toHaveTextContent("none");
        expect(toaster.create).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "success",
                description: "File deleted successfully",
            }),
        );
    });

    it("deletes a whole collection through the collection endpoint", async () => {
        vi.mocked(ragApi.deleteCollection).mockResolvedValue({});
        vi.mocked(ragApi.fetchCollections)
            .mockResolvedValueOnce({ files: ["influenza", "diabetes"] })
            .mockResolvedValueOnce({ files: [] });
        renderHook();
        await waitFor(() =>
            expect(screen.getByText("influenza:false:0")).toBeInTheDocument(),
        );

        fireEvent.click(
            screen.getByRole("button", { name: "target-collection" }),
        );
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "confirm" }));
        });

        await waitFor(() => {
            expect(ragApi.deleteCollection).toHaveBeenCalledWith("influenza");
        });
        expect(ragApi.deleteFile).not.toHaveBeenCalled();
        await waitFor(() =>
            expect(screen.getByTestId("pending")).toHaveTextContent("none"),
        );
        expect(toaster.create).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "success",
                description: "Collection deleted successfully",
            }),
        );
    });

    it("toasts and clears the pending item when deletion fails", async () => {
        vi.mocked(ragApi.deleteFile).mockRejectedValue(new Error("locked"));
        renderHook();
        await waitFor(() =>
            expect(screen.getByText("influenza:false:0")).toBeInTheDocument(),
        );

        fireEvent.click(screen.getByRole("button", { name: "target-file" }));
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "confirm" }));
        });

        await waitFor(() => {
            expect(toaster.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "error",
                    description: "Failed to delete file",
                }),
            );
        });
        expect(screen.getByTestId("pending")).toHaveTextContent("none");
    });

    it("exposes independent collapse state for the explorer and uploader", async () => {
        renderHook();
        await waitFor(() =>
            expect(screen.getByTestId("loading")).toHaveTextContent("false"),
        );

        expect(screen.getByTestId("explorer")).toHaveTextContent("false");
        expect(screen.getByTestId("uploader")).toHaveTextContent("false");

        fireEvent.click(screen.getByRole("button", { name: "toggle-explorer" }));
        expect(screen.getByTestId("explorer")).toHaveTextContent("true");
        expect(screen.getByTestId("uploader")).toHaveTextContent("false");

        fireEvent.click(screen.getByRole("button", { name: "toggle-uploader" }));
        expect(screen.getByTestId("uploader")).toHaveTextContent("true");
        expect(screen.getByTestId("explorer")).toHaveTextContent("true");
    });
});
