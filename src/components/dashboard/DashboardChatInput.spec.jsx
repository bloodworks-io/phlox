import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardChatInput from "./DashboardChatInput";
import { renderWithProviders } from "../../test/utils";

const pdfFile = new File(["%PDF-1.4"], "consultation.pdf", {
    type: "application/pdf",
});
const rejectedFile = new File(["notes"], "notes.txt", { type: "text/plain" });

const renderInput = (overrides = {}) =>
    renderWithProviders(
        <DashboardChatInput
            value=""
            onChange={vi.fn()}
            onSend={vi.fn()}
            isLoading={false}
            {...overrides}
        />,
    );

afterEach(cleanup);

describe("DashboardChatInput", () => {
    it("keeps send disabled until content or an attachment exists", () => {
        renderInput();
        const send = screen.getByRole("button", { name: /send message/i });
        expect(send).toBeDisabled();

        cleanup();
        renderInput({ value: "Review the plan" });
        expect(screen.getByRole("button", { name: /send message/i })).toBeEnabled();

        cleanup();
        renderInput({ value: "", isLoading: true, pendingImage: pdfFile });
        expect(
            screen.getByRole("button", { name: /send message/i }),
        ).toBeDisabled();
    });

    it("sends on Enter without Shift and preserves Shift+Enter", () => {
        const onSend = vi.fn();
        renderInput({ value: "Check ferritin", onSend });

        const textarea = screen.getByRole("textbox");
        fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
        expect(onSend).not.toHaveBeenCalled();

        fireEvent.keyDown(textarea, { key: "Enter" });
        expect(onSend).toHaveBeenCalledTimes(1);
    });

    it("blocks Enter submission while an attachment is processing", () => {
        const onSend = vi.fn();
        renderInput({
            value: "Read this document",
            onSend,
            pendingImage: pdfFile,
            isProcessingImage: true,
        });

        fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
        expect(onSend).not.toHaveBeenCalled();
    });

    it("shows and clears the drag-over state", () => {
        renderInput();

        const target = document.querySelector(".dashboard-chat-input-container");
        fireEvent.dragOver(target, {
            dataTransfer: { files: [pdfFile] },
        });
        expect(screen.getByText(/drop image or pdf here/i)).toBeInTheDocument();

        fireEvent.dragLeave(target);
        expect(
            screen.queryByText(/drop image or pdf here/i),
        ).not.toBeInTheDocument();
    });

    it("accepts supported dropped files and ignores unsupported files", () => {
        const onImageSelect = vi.fn();
        renderInput({ onImageSelect });

        const target = document.querySelector(".dashboard-chat-input-container");
        fireEvent.drop(target, {
            dataTransfer: { files: [rejectedFile] },
        });
        expect(onImageSelect).not.toHaveBeenCalled();

        fireEvent.drop(target, {
            dataTransfer: { files: [pdfFile] },
        });
        expect(onImageSelect).toHaveBeenCalledWith(pdfFile);
    });

    it("renders a PDF attachment with removal gated by processing", () => {
        renderInput({ pendingImage: pdfFile });

        expect(screen.getByText("consultation.pdf")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /remove file/i }),
        ).toBeEnabled();

        cleanup();
        renderInput({ pendingImage: pdfFile, isProcessingImage: true });
        expect(
            screen.getByRole("button", { name: /remove file/i }),
        ).toBeDisabled();
    });

    it("selects a file through the hidden input and resets it after selection", async () => {
        const onImageSelect = vi.fn();
        renderInput({ onImageSelect });

        await userEvent.click(
            screen.getByRole("button", { name: /attach/i }),
        );
        const input = document.querySelector('input[type="file"]');
        expect(input).toHaveAttribute(
            "accept",
            expect.stringContaining(".pdf"),
        );

        await userEvent.upload(input, pdfFile);
        expect(onImageSelect).toHaveBeenCalledWith(pdfFile);
        expect(input.value).toBe("");
    });

    it("maintains the minimum composer height while autosizing", () => {
        renderInput({ value: "Short message" });

        const textarea = screen.getByRole("textbox");
        expect(textarea).toHaveStyle({ height: "32px" });
    });
});
