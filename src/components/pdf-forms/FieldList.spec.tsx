import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import FieldList from "./FieldList";
import { renderWithProviders } from "../../test/utils";
import { t } from "@/i18n";
import type { FormField } from "./types";

const field = (overrides: Partial<FormField>): FormField => ({
    id: "f1",
    name: "Patient Name",
    field_type: "text",
    page_number: 1,
    x: 72,
    y: 640,
    width: 300,
    height: 18,
    ...overrides,
});

const fields = [
    field({ id: "f2", name: "Visit Date", field_type: "date", page_number: 2 }),
    field({ id: "f1", name: "Patient Name", page_number: 1 }),
    field({ id: "f3", name: "Urgent", field_type: "checkbox", page_number: 1 }),
    field({ id: "f4", name: "", page_number: 1 }),
];

const renderList = (
    props: Partial<Parameters<typeof FieldList>[0]> = {},
) =>
    renderWithProviders(
        <FieldList
            fields={fields}
            selectedFieldId={null}
            onSelectField={vi.fn()}
            onDeleteField={vi.fn()}
            onJumpToPage={vi.fn()}
            {...props}
        />,
    );

afterEach(cleanup);

describe("FieldList", () => {
    it("shows the empty hint without fields", () => {
        renderList({ fields: [] });

        expect(
            screen.getByText(t("forms.noFieldsYet") as string),
        ).toBeInTheDocument();
    });

    it("lists fields sorted by page then name", () => {
        renderList();

        const deleteButtons = screen.getAllByRole("button", {
            name: /^Delete field/,
        });
        expect(deleteButtons).toHaveLength(4);
        expect(deleteButtons.map((b) => b.getAttribute("aria-label"))).toEqual(
            [
                t("forms.deleteFieldNamed", { name: t("forms.unnamed") }),
                t("forms.deleteFieldNamed", { name: "Patient Name" }),
                t("forms.deleteFieldNamed", { name: "Urgent" }),
                t("forms.deleteFieldNamed", { name: "Visit Date" }),
            ],
        );

        const pageTags = deleteButtons
            .map((b) => b.parentElement?.textContent ?? "")
            .map((text) => text.match(/p(\d)/)?.[0]);
        expect(pageTags).toEqual(["p1", "p1", "p1", "p2"]);
    });

    it("selects a field and jumps to its page on row click", () => {
        const onSelectField = vi.fn();
        const onJumpToPage = vi.fn();
        renderList({ onSelectField, onJumpToPage });

        fireEvent.click(screen.getByText("Visit Date"));

        expect(onSelectField).toHaveBeenCalledWith("f2");
        expect(onJumpToPage).toHaveBeenCalledWith(2);
        expect(onSelectField).toHaveBeenCalledTimes(1);
    });

    it("deletes through the row action without selecting the field", () => {
        const onSelectField = vi.fn();
        const onDeleteField = vi.fn();
        renderList({ onSelectField, onDeleteField });

        fireEvent.click(
            screen.getByRole("button", {
                name: t("forms.deleteFieldNamed", {
                    name: "Patient Name",
                }) as string,
            }),
        );

        expect(onDeleteField).toHaveBeenCalledWith("f1");
        expect(onSelectField).not.toHaveBeenCalled();
    });

    it("deletes unnamed fields through the unnamed label", () => {
        const onDeleteField = vi.fn();
        renderList({ onDeleteField });

        fireEvent.click(
            screen.getByRole("button", {
                name: t("forms.deleteFieldNamed", {
                    name: t("forms.unnamed"),
                }) as string,
            }),
        );

        expect(onDeleteField).toHaveBeenCalledWith("f4");
    });
});
