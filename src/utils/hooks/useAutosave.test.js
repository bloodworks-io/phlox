import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutosave } from "./useAutosave";

const DELAY = 800;

describe("useAutosave", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    const setup = (initialValue = "a", enabled = true) => {
        const saver = vi.fn().mockResolvedValue(undefined);
        const hook = renderHook(
            ({ value, enabled }) => useAutosave(value, saver, DELAY, enabled),
            { initialProps: { value: initialValue, enabled } },
        );
        return { saver, ...hook };
    };

    it("treats the initial value as the baseline and does not save on mount", () => {
        const { saver, result } = setup("a");
        expect(result.current.isDirty).toBe(false);
        expect(saver).not.toHaveBeenCalled();
    });

    it("marks dirty and saves the latest value after the debounce window", async () => {
        const { saver, rerender, result } = setup("a");
        rerender({ value: "b", enabled: true });

        expect(result.current.isDirty).toBe(true);
        expect(saver).not.toHaveBeenCalled();

        await act(async () => {
            vi.advanceTimersByTime(DELAY);
        });

        expect(saver).toHaveBeenCalledExactlyOnceWith("b");
        expect(result.current.isDirty).toBe(false);
    });

    it("collapses rapid successive changes into one save of the final value", async () => {
        const { saver, rerender, result } = setup("a");
        rerender({ value: "b", enabled: true });
        await act(async () => {
            vi.advanceTimersByTime(DELAY / 2);
        });
        rerender({ value: "c", enabled: true });
        await act(async () => {
            vi.advanceTimersByTime(DELAY / 2);
        });
        expect(saver).not.toHaveBeenCalled();

        await act(async () => {
            vi.advanceTimersByTime(DELAY / 2);
        });
        expect(saver).toHaveBeenCalledExactlyOnceWith("c");
        expect(result.current.isDirty).toBe(false);
    });

    it("flush() saves immediately without waiting for the debounce", async () => {
        const { saver, rerender, result } = setup("a");
        rerender({ value: "b", enabled: true });

        await act(async () => {
            await result.current.flush();
        });

        expect(saver).toHaveBeenCalledExactlyOnceWith("b");
        expect(result.current.isDirty).toBe(false);

        // The cancelled timer must not fire a second save later
        await act(async () => {
            vi.advanceTimersByTime(DELAY * 2);
        });
        expect(saver).toHaveBeenCalledTimes(1);
    });

    it("flush() is a no-op when nothing is pending", async () => {
        const { saver, result } = setup("a");
        await act(async () => {
            await result.current.flush();
        });
        expect(saver).not.toHaveBeenCalled();
    });

    it("clears the dirty flag and logs when the save fails", async () => {
        const errorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
        const saver = vi.fn().mockRejectedValue(new Error("disk full"));
        const { result, rerender } = renderHook(
            ({ value }) => useAutosave(value, saver, DELAY, true),
            { initialProps: { value: "a" } },
        );
        rerender({ value: "b" });

        await act(async () => {
            vi.advanceTimersByTime(DELAY);
        });

        expect(saver).toHaveBeenCalledWith("b");
        expect(result.current.isDirty).toBe(false);
        expect(errorSpy).toHaveBeenCalledWith(
            "Autosave failed:",
            expect.any(Error),
        );
    });

    it("does not save while disabled and rebaselines on re-enable", async () => {
        const { saver, rerender, result } = setup("a", false);

        rerender({ value: "b", enabled: false });
        await act(async () => {
            vi.advanceTimersByTime(DELAY * 2);
        });
        expect(saver).not.toHaveBeenCalled();
        expect(result.current.isDirty).toBe(false);

        // Enabling adopts the current value as the new baseline — no catch-up save
        rerender({ value: "b", enabled: true });
        await act(async () => {
            vi.advanceTimersByTime(DELAY * 2);
        });
        expect(saver).not.toHaveBeenCalled();

        // Only changes after enabling trigger saves again
        rerender({ value: "c", enabled: true });
        await act(async () => {
            vi.advanceTimersByTime(DELAY);
        });
        expect(saver).toHaveBeenCalledExactlyOnceWith("c");
    });

    it("flushes pending changes on unmount", async () => {
        const { saver, rerender, unmount } = setup("a");
        rerender({ value: "b", enabled: true });

        await act(async () => {
            unmount();
        });

        expect(saver).toHaveBeenCalledExactlyOnceWith("b");
    });

    it("does not flush on unmount when nothing changed", () => {
        const { saver, unmount } = setup("a");
        unmount();
        expect(saver).not.toHaveBeenCalled();
    });
});
