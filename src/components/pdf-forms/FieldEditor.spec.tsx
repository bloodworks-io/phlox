import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FieldEditor from "./FieldEditor";
import { renderWithProviders } from "../../test/utils";
import { t } from "@/i18n";
import type { FormField } from "./types";

const field: FormField = {
    id: "f1",
    name: "Patient Name",
    description: "Full legal name",
    field_type: "text",
    required: false,
    page_number: 2,
    x: 50.25,
    y: 400.5,
    width: 120,
    height: 18,
    font_size: 12,
};

const renderEditor = (
    props: Partial<Parameters<typeof FieldEditor>[0]> = {},
) =>
    renderWithProviders(
        <FieldEditor
            field={field}
            onChange={vi.fn()}
            onDelete={vi.fn()}
            previewValue=""
            onPreviewValueChange={vi.fn()}
            {...props}
        />,
    );

afterEach(cleanup);

describe("FieldEditor", () => {
    it("shows the selection hint without a field", () => {
        renderEditor({ field: null });

        expect(
            screen.getByText(t("forms.selectFieldHint") as string),
        ).toBeInTheDocument();
    });

    it("edits the name, type, and description of the selected field", () => {
        const onChange = vi.fn();
        renderEditor({ onChange });

        const name = screen.getByLabelText(t("forms.name") as string);
        expect(name).toHaveValue("Patient Name");
        fireEvent.change(name, { target: { value: "Given name" } });
        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({ id: "f1", name: "Given name" }),
        );

        const type = screen.getByLabelText(t("forms.type") as string);
        expect(type).toHaveValue("text");
        fireEvent.change(type, { target: { value: "date" } });
        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({ field_type: "date" }),
        );

        const description = screen.getByLabelText(
            t("forms.description") as string,
        );
        expect(description).toHaveValue("Full legal name");
        fireEvent.change(description, {
            target: { value: "As printed on the referral" },
        });
        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({
                description: "As printed on the referral",
            }),
        );
    });

    it("routes preview text to the preview value callback", () => {
        const onPreviewValueChange = vi.fn();
        renderEditor({ onPreviewValueChange });

        const preview = screen.getByLabelText(
            t("forms.previewText") as string,
        );
        fireEvent.change(preview, { target: { value: "Ada Lovelace" } });

        expect(onPreviewValueChange).toHaveBeenCalledWith("Ada Lovelace");
    });

    it("hides the preview input for checkbox fields", () => {
        renderEditor({
            field: { ...field, field_type: "checkbox", height: 14 },
        });

        expect(
            screen.queryByLabelText(t("forms.previewText") as string),
        ).toBeNull();
    });

    it("edits the font size and page number", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        renderEditor({ onChange });

        const [fontSize, page] = screen.getAllByRole("spinbutton");

        await user.clear(fontSize);
        await user.type(fontSize, "14");
        expect(onChange).toHaveBeenLastCalledWith(
            expect.objectContaining({ font_size: 14 }),
        );

        await user.clear(page);
        await user.type(page, "3");
        expect(onChange).toHaveBeenLastCalledWith(
            expect.objectContaining({ page_number: 3 }),
        );
    });

    it("toggles the required flag", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        renderEditor({ onChange });

        const required = screen.getByRole("checkbox");
        expect(required).not.toBeChecked();
        await user.click(screen.getByText(t("forms.requiredField") as string));

        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({ required: true }),
        );
    });

    it("deletes the field through the header action", () => {
        const onDelete = vi.fn();
        renderEditor({ onDelete });

        fireEvent.click(
            screen.getByRole("button", {
                name: t("forms.deleteField") as string,
            }),
        );

        expect(onDelete).toHaveBeenCalledWith("f1");
    });

    it("reports the absolute PDF-point geometry", () => {
        renderEditor();

        expect(
            screen.getByText(
                t("forms.positionSize", {
                    x: "50.3",
                    y: "400.5",
                    width: "120.0",
                    height: "18.0",
                }) as string,
            ),
        ).toBeInTheDocument();
    });

    it("warns when the sample cannot fit even after auto-fit", async () => {
        renderEditor({
            field: {
                ...field,
                name: "Tiny",
                width: 26,
                height: 10,
                font_size: 12,
            },
            previewValue: "An extremely long unbreakable value",
        });

        const warning = await screen.findByText(/pt — enlarge the box\./);
        expect(warning).toBeInTheDocument();
        await waitFor(() => {
            expect(
                screen.queryByText(/Auto-fit: renders at/),
            ).not.toBeInTheDocument();
        });
    });

    it("notes when auto-fit shrinks the font to fit", async () => {
        renderEditor({
            field: {
                ...field,
                name: "Narrow",
                width: 58,
                height: 14,
                font_size: 12,
            },
            previewValue: "Reasonably long sample",
        });

        expect(
            await screen.findByText(/Auto-fit: renders at \d+pt to fit\.|Auto-fit: renders at \d+\.\d+pt to fit\./),
        ).toBeInTheDocument();
        await waitFor(() => {
            expect(
                screen.queryByText(/pt — enlarge the box\./),
            ).not.toBeInTheDocument();
        });
    });

    it("shows no fit note for text that already fits", async () => {
        renderEditor({ previewValue: "Ada" });

        // Helvetica measure loads asynchronously; give it a beat to settle.
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(screen.queryByText(/Auto-fit: renders at/)).toBeNull();
        expect(screen.queryByText(/pt — enlarge the box\./)).toBeNull();
    });
});
