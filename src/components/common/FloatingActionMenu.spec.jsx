import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import FloatingActionMenu from "./FloatingActionMenu";
import { renderWithProviders } from "../../test/utils";

afterEach(cleanup);

const renderMenu = (overrides = {}) =>
    renderWithProviders(
        <FloatingActionMenu
            onOpenChat={vi.fn()}
            onOpenLetter={vi.fn()}
            onOpenReasoning={vi.fn()}
            onOpenDocument={vi.fn()}
            onOpenPreviousVisit={vi.fn()}
            hasPreviousVisit
            isEncounterSaved
            {...overrides}
        />,
    );

describe("FloatingActionMenu", () => {
    it("renders every consultation tool with its stable id", () => {
        renderMenu();

        for (const id of [
            "fab-document",
            "fab-previous-visit",
            "fab-chat",
            "fab-reasoning",
            "fab-letter",
        ]) {
            expect(document.getElementById(id)).not.toBeNull();
        }
    });

    it("invokes each tool callback", () => {
        const callbacks = {
            onOpenChat: vi.fn(),
            onOpenLetter: vi.fn(),
            onOpenReasoning: vi.fn(),
            onOpenDocument: vi.fn(),
            onOpenPreviousVisit: vi.fn(),
        };
        renderMenu(callbacks);

        fireEvent.click(screen.getByRole("button", { name: /open document upload/i }));
        fireEvent.click(screen.getByRole("button", { name: /open previous visit/i }));
        fireEvent.click(screen.getByRole("button", { name: /open chat/i }));
        fireEvent.click(screen.getByRole("button", { name: /open reasoning/i }));
        fireEvent.click(screen.getByRole("button", { name: /open letter/i }));

        expect(callbacks.onOpenDocument).toHaveBeenCalledTimes(1);
        expect(callbacks.onOpenPreviousVisit).toHaveBeenCalledTimes(1);
        expect(callbacks.onOpenChat).toHaveBeenCalledTimes(1);
        expect(callbacks.onOpenReasoning).toHaveBeenCalledTimes(1);
        expect(callbacks.onOpenLetter).toHaveBeenCalledTimes(1);
    });

    it("disables gated tools until prior data and a saved encounter exist", () => {
        const callbacks = {
            onOpenLetter: vi.fn(),
            onOpenReasoning: vi.fn(),
            onOpenPreviousVisit: vi.fn(),
        };
        renderMenu({
            ...callbacks,
            hasPreviousVisit: false,
            isEncounterSaved: false,
        });

        expect(
            screen.getByRole("button", { name: /open previous visit/i }),
        ).toBeDisabled();
        expect(screen.getByRole("button", { name: /open reasoning/i })).toBeDisabled();
        expect(screen.getByRole("button", { name: /open letter/i })).toBeDisabled();

        fireEvent.click(screen.getByRole("button", { name: /open previous visit/i }));
        fireEvent.click(screen.getByRole("button", { name: /open reasoning/i }));
        fireEvent.click(screen.getByRole("button", { name: /open letter/i }));

        expect(callbacks.onOpenPreviousVisit).not.toHaveBeenCalled();
        expect(callbacks.onOpenReasoning).not.toHaveBeenCalled();
        expect(callbacks.onOpenLetter).not.toHaveBeenCalled();
    });

    it("exposes previous-visit unread and critical-reasoning indicators", () => {
        const { container } = renderMenu({
            showPreviousVisitDot: true,
            hasCriticalReasoning: true,
        });

        const dots = container.querySelectorAll(
            ".pill-box-icons + div, #fab-reasoning + div",
        );
        expect(dots.length).toBeGreaterThanOrEqual(2);
    });
});
