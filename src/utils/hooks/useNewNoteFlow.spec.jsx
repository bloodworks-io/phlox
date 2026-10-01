import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { useNewNoteFlow } from "./useNewNoteFlow";

const wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;

const useHarness = () => {
    const flow = useNewNoteFlow();
    const location = useLocation();
    return { flow, location };
};

describe("useNewNoteFlow", () => {
    it("completeNewNote navigates to /new-note with modal state", () => {
        const { result } = renderHook(() => useHarness(), { wrapper });

        act(() => result.current.flow.openNewNoteModal());
        expect(result.current.flow.isNewNoteOpen).toBe(true);

        act(() => result.current.flow.completeNewNote({ cameFromSearch: true }));

        expect(result.current.location.pathname).toBe("/new-note");
        expect(result.current.location.state).toEqual({
            viaModal: true,
            cameFromSearch: true,
        });
        expect(result.current.flow.isNewNoteOpen).toBe(false);
    });

    it("defaults cameFromSearch to false", () => {
        const { result } = renderHook(() => useHarness(), { wrapper });

        act(() => result.current.flow.completeNewNote());

        expect(result.current.location.state).toEqual({
            viaModal: true,
            cameFromSearch: false,
        });
    });
});
