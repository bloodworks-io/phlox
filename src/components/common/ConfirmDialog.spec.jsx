import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import ConfirmDialog from "./ConfirmDialog";
import { renderWithProviders } from "../../test/utils";

afterEach(cleanup);

const renderDialog = (overrides = {}) =>
    renderWithProviders(
        <ConfirmDialog
            isOpen
            onClose={vi.fn()}
            onConfirm={vi.fn()}
            title="Delete template"
            body="This cannot be undone."
            confirmLabel="Delete"
            {...overrides}
        />,
    );

describe("ConfirmDialog", () => {
    it("renders the title, body, and action order", () => {
        renderDialog();

        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("Delete template")).toBeInTheDocument();
        expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();

        const deleteButton = screen.getByRole("button", { name: "Delete" });
        const cancelButton = screen.getByRole("button", { name: "Cancel" });
        expect(deleteButton.compareDocumentPosition(cancelButton)).toBe(
            Node.DOCUMENT_POSITION_FOLLOWING,
        );
    });

    it("invokes confirm and cancel independently", () => {
        const onConfirm = vi.fn();
        const onClose = vi.fn();
        renderDialog({ onConfirm, onClose });

        fireEvent.click(screen.getByRole("button", { name: "Delete" }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("preserves the current intent-bearing button classes", () => {
        renderDialog();

        expect(screen.getByRole("button", { name: "Delete" })).toHaveClass(
            "red-button",
        );
        expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass(
            "green-button",
        );
    });

    it("supports a custom cancel label", () => {
        renderDialog({ cancelLabel: "Keep template" });

        expect(
            screen.getByRole("button", { name: "Keep template" }),
        ).toBeInTheDocument();
    });
});
