import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { CustomToast } from "./Toast";
import { renderWithProviders } from "../../test/utils";

afterEach(cleanup);

const cases = [
    { status: "success", className: "green-icon" },
    { status: "error", className: "red-icon" },
    { status: "warning", className: "yellow-icon" },
    { status: "info", className: "blue-icon" },
];

describe("CustomToast", () => {
    it.each(cases)(
        "renders the $status status icon treatment",
        ({ status, className }) => {
            const { container } = renderWithProviders(
                <CustomToast status={status} title="Seed title" />,
            );
            expect(container.querySelector(`.${className}`)).not.toBeNull();
        },
    );

    it("renders title and description text", () => {
        renderWithProviders(
            <CustomToast
                status="success"
                title="Saved"
                description="The clinical note was saved."
            />,
        );

        expect(screen.getByText("Saved")).toBeInTheDocument();
        expect(
            screen.getByText("The clinical note was saved."),
        ).toBeInTheDocument();
    });

    it("closes through the explicit close control", () => {
        const onClose = vi.fn();
        renderWithProviders(
            <CustomToast status="error" title="Failed" onClose={onClose} />,
        );

        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("omits the icon for an unknown status", () => {
        const { container } = renderWithProviders(
            <CustomToast status="unknown" title="Seed title" />,
        );

        expect(container.querySelector(".green-icon")).toBeNull();
        expect(container.querySelector(".red-icon")).toBeNull();
        expect(container.querySelector(".yellow-icon")).toBeNull();
        expect(container.querySelector(".blue-icon")).toBeNull();
    });
});
