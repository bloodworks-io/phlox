import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { EditDocumentPopover } from "./EditDocumentPopover";
import { renderWithProviders } from "../../test/utils";
import { ragApi } from "../../utils/api/ragApi";
import { toaster } from "@/components/ui/toaster";
import { t } from "@/i18n";
import type { RagFileObject } from "./types";

vi.mock("../../utils/api/ragApi", () => ({
    ragApi: { updateDocumentMetadata: vi.fn() },
}));
vi.mock("@/components/ui/toaster", () => ({
    toaster: { create: vi.fn() },
}));

const file: RagFileObject = {
    filename: "guide.pdf",
    title: "Flu Guide",
    source: "WHO",
    focus_area: "guidelines",
    has_pdf: true,
};

const openPopover = async () => {
    fireEvent.click(
        screen.getByRole("button", { name: t("rag.editDocument") as string }),
    );
    await screen.findByPlaceholderText(
        t("rag.titlePlaceholder") as string,
    );
};

const trigger = () =>
    screen.getByRole("button", { name: t("rag.editDocument") as string });

// Chakra keeps the popover content mounted through its exit presence, so
// closure is characterized through the trigger's expanded state.
const expectClosed = async () => {
    await waitFor(() =>
        expect(trigger()).toHaveAttribute("aria-expanded", "false"),
    );
};

const renderPopover = (onSaved = vi.fn()) =>
    renderWithProviders(
        <EditDocumentPopover
            collectionName="influenza"
            file={file}
            onSaved={onSaved}
        />,
    );

const save = () =>
    fireEvent.click(
        screen.getByRole("button", { name: t("action.save") as string }),
    );

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("EditDocumentPopover", () => {
    it("renders a closed edit trigger", () => {
        renderPopover();

        expect(trigger()).toHaveAttribute("aria-expanded", "false");
        expect(trigger()).toBeInTheDocument();
    });

    it("opens with the file's metadata in the title, source, and focus inputs", async () => {
        renderPopover();
        await openPopover();

        expect(screen.getByDisplayValue("Flu Guide")).toBeInTheDocument();
        expect(screen.getByDisplayValue("WHO")).toBeInTheDocument();
        expect(screen.getByDisplayValue("guidelines")).toBeInTheDocument();
    });

    it("offers the canonical focus areas in its datalist", async () => {
        renderPopover();
        await openPopover();

        const options = Array.from(
            document.querySelectorAll("#focus-area-options option"),
        ).map((option) => option.getAttribute("value"));
        expect(options).toEqual([
            "guidelines",
            "diagnosis",
            "treatment",
            "epidemiology",
            "pathophysiology",
            "prognosis",
            "clinical_features",
            "prevention",
            "miscellaneous",
        ]);
    });

    it("saves edited metadata and reports the updated file", async () => {
        const onSaved = vi.fn();
        vi.mocked(ragApi.updateDocumentMetadata).mockResolvedValue({});
        renderPopover(onSaved);
        await openPopover();

        fireEvent.change(screen.getByDisplayValue("Flu Guide"), {
            target: { value: "Influenza guideline" },
        });
        fireEvent.change(screen.getByDisplayValue("WHO"), {
            target: { value: "CDC" },
        });
        save();

        await waitFor(() => {
            expect(ragApi.updateDocumentMetadata).toHaveBeenCalledWith({
                collection_name: "influenza",
                filename: "guide.pdf",
                title: "Influenza guideline",
                source: "CDC",
                focus_area: "guidelines",
            });
        });
        await waitFor(() =>
            expect(onSaved).toHaveBeenCalledWith({
                ...file,
                title: "Influenza guideline",
                source: "CDC",
                focus_area: "guidelines",
            }),
        );
        await expectClosed();
    });

    it("sends null for fields the user cleared", async () => {
        vi.mocked(ragApi.updateDocumentMetadata).mockResolvedValue({});
        renderPopover();
        await openPopover();

        fireEvent.change(screen.getByDisplayValue("Flu Guide"), {
            target: { value: "" },
        });
        fireEvent.change(screen.getByDisplayValue("guidelines"), {
            target: { value: "" },
        });
        save();

        await waitFor(() => {
            expect(ragApi.updateDocumentMetadata).toHaveBeenCalledWith({
                collection_name: "influenza",
                filename: "guide.pdf",
                title: null,
                source: "WHO",
                focus_area: null,
            });
        });
    });

    it("keeps the popover open and toasts when the update fails", async () => {
        const onSaved = vi.fn();
        vi.mocked(ragApi.updateDocumentMetadata).mockRejectedValue(
            new Error("boom"),
        );
        renderPopover(onSaved);
        await openPopover();
        save();

        await waitFor(() => {
            expect(toaster.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "error",
                    description: t("rag.toast.failedToUpdateDocument"),
                }),
            );
        });
        expect(onSaved).not.toHaveBeenCalled();
        expect(trigger()).toHaveAttribute("aria-expanded", "true");
        expect(
            screen.getByPlaceholderText(t("rag.titlePlaceholder") as string),
        ).toBeInTheDocument();
    });

    it("closes without saving on cancel", async () => {
        const onSaved = vi.fn();
        renderPopover(onSaved);
        await openPopover();

        fireEvent.click(
            screen.getByRole("button", { name: t("action.cancel") as string }),
        );

        await expectClosed();
        expect(ragApi.updateDocumentMetadata).not.toHaveBeenCalled();
        expect(onSaved).not.toHaveBeenCalled();
    });

    it("closes without saving via the header close control", async () => {
        const onSaved = vi.fn();
        renderPopover(onSaved);
        await openPopover();

        fireEvent.click(
            screen.getByRole("button", { name: t("action.close") as string }),
        );

        await expectClosed();
        expect(ragApi.updateDocumentMetadata).not.toHaveBeenCalled();
    });
});
