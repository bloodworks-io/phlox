import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { useNavigationGuard } from "./useNavigationGuard";

const wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;

const useHarness = (isModified) => {
    const guard = useNavigationGuard(isModified, vi.fn());
    const location = useLocation();
    return { guard, location };
};

describe("useNavigationGuard", () => {
    it("runs the action immediately when not modified", () => {
        const action = vi.fn();
        const { result } = renderHook(() => useHarness(false), { wrapper });

        act(() => result.current.guard.guardedAction(action));

        expect(action).toHaveBeenCalledTimes(1);
        expect(result.current.guard.isLeaveOpen).toBe(false);
    });

    it("defers the action behind the confirm dialog when modified", () => {
        const action = vi.fn();
        const setIsModified = vi.fn();
        const { result } = renderHook(
            () => useNavigationGuard(true, setIsModified),
            { wrapper },
        );

        act(() => result.current.guardedAction(action));

        expect(action).not.toHaveBeenCalled();
        expect(result.current.isLeaveOpen).toBe(true);

        act(() => result.current.confirmNavigation());

        expect(action).toHaveBeenCalledTimes(1);
        expect(setIsModified).toHaveBeenCalledWith(false);
        expect(result.current.isLeaveOpen).toBe(false);
    });

    it("cancel discards the pending action", () => {
        const action = vi.fn();
        const { result } = renderHook(
            () => useNavigationGuard(true, vi.fn()),
            { wrapper },
        );

        act(() => result.current.guardedAction(action));
        act(() => result.current.cancelNavigation());

        expect(action).not.toHaveBeenCalled();
        expect(result.current.isLeaveOpen).toBe(false);
    });

    it("guardedNavigate navigates when clean", () => {
        const { result } = renderHook(() => useHarness(false), { wrapper });

        act(() =>
            result.current.guard.guardedNavigate("/new-note", {
                viaModal: true,
            }),
        );

        expect(result.current.location.pathname).toBe("/new-note");
        expect(result.current.location.state).toEqual({
            viaModal: true,
        });
    });
});
