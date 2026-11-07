import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { CustomToast } from "./Toast";
import { emotionStylesFor, renderWithProviders } from "../../test/utils";

afterEach(cleanup);

const cases = [
    { status: "success", token: "folio-success" },
    { status: "error", token: "folio-danger" },
    { status: "warning", token: "folio-warning" },
    { status: "info", token: "folio-info" },
];

describe("CustomToast", () => {
    it.each(cases)(
        "renders the $status status icon with its Folio role color",
        ({ status, token }) => {
            const { container } = renderWithProviders(
                <CustomToast status={status} title="Seed title" />,
            );
            const svg = container.querySelector("svg");
            expect(svg).not.toBeNull();
            const styles = emotionStylesFor(svg);
            expect(styles).toContain(`var(--chakra-colors-${token})`);
        },
    );

    it("renders on the Folio paper surface with Public Sans text", () => {
        const { container } = renderWithProviders(
            <CustomToast status="success" title="Saved" />,
        );
        // The provider renders a theme script first; the surface is the
        // toast's outermost div.
        const surface = container.querySelector("div");
        const styles = emotionStylesFor(surface);

        expect(styles).toContain("var(--chakra-colors-folio-paper)");
        expect(styles).toContain("var(--chakra-colors-folio-line)");
        expect(styles).toContain("var(--chakra-radii-folio-panel)");
        // Public Sans is the body role; no Roboto is hard-coded anymore.
        expect(styles).not.toContain("Roboto");
    });

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

    it("omits the status icon for an unknown status", () => {
        const { container } = renderWithProviders(
            <CustomToast status="unknown" title="Seed title" />,
        );

        // Only the close affordance remains; no status icon is rendered.
        expect(container.querySelectorAll("svg")).toHaveLength(1);
    });
});
