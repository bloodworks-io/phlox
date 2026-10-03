import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import KnowledgeBasePanel from "./KnowledgeBasePanel";
import { renderWithProviders } from "../../test/utils";

vi.mock("./DocumentExplorer", () => ({
    default: vi.fn(({ collections, setCollections, loading, setItemToDelete, isCollapsed, setIsCollapsed }) => (
        <div
            data-testid="explorer"
            data-collapsed={String(isCollapsed)}
            data-collections={collections.map((c) => c.name).join(",")}
            data-loading={String(loading)}
            data-setter={typeof setCollections}
            data-delete={typeof setItemToDelete}
            data-toggle={typeof setIsCollapsed}
        />
    )),
}));
vi.mock("./Uploader", () => ({
    default: vi.fn(({ setCollections, isCollapsed, setIsCollapsed }) => (
        <div
            data-testid="uploader"
            data-collapsed={String(isCollapsed)}
            data-setter={typeof setCollections}
            data-toggle={typeof setIsCollapsed}
        />
    )),
}));

afterEach(cleanup);

describe("KnowledgeBasePanel", () => {
    it("renders the explorer and uploader and forwards props", () => {
        const collections = [{ name: "colA", files: [], loaded: false }];
        const toggle = () => {};
        renderWithProviders(
            <KnowledgeBasePanel
                collapseExplorer={{ isCollapsed: false, toggle }}
                collapseUploader={{ isCollapsed: true, toggle }}
                collections={collections}
                setCollections={() => {}}
                loading={false}
                setItemToDelete={() => {}}
            />,
        );
        const explorer = screen.getByTestId("explorer");
        const uploader = screen.getByTestId("uploader");
        expect(explorer).toBeInTheDocument();
        expect(uploader).toBeInTheDocument();
        expect(explorer).toHaveAttribute("data-collapsed", "false");
        expect(explorer).toHaveAttribute("data-collections", "colA");
        expect(explorer).toHaveAttribute("data-loading", "false");
        expect(explorer).toHaveAttribute("data-setter", "function");
        expect(explorer).toHaveAttribute("data-delete", "function");
        expect(uploader).toHaveAttribute("data-collapsed", "true");
        expect(uploader).toHaveAttribute("data-setter", "function");
        expect(uploader).toHaveAttribute("data-toggle", "function");
    });
});
