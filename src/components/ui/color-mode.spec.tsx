import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useThemePreference } from "./color-mode";
import { renderWithProviders } from "../../test/utils";

const ThemePreferenceProbe = () => {
    const { themePreference, setThemePreference } = useThemePreference();

    return (
        <>
            <button type="button" onClick={() => setThemePreference("dark")}>
                Set dark
            </button>
            <button type="button" onClick={() => setThemePreference("system")}>
                Use system
            </button>
            <output>{themePreference}</output>
        </>
    );
};

afterEach(() => {
    cleanup();
    if (window.localStorage) {
        window.localStorage.removeItem("theme");
    }
});

describe("theme preference API", () => {
    it("supports explicit and system preferences", async () => {
        renderWithProviders(<ThemePreferenceProbe />);

        expect(screen.getByRole("status")).toHaveTextContent("system");

        fireEvent.click(screen.getByRole("button", { name: "Set dark" }));

        await waitFor(() =>
            expect(screen.getByRole("status")).toHaveTextContent("dark"),
        );
        expect(document.documentElement.dataset.themePreference).toBe("dark");
        expect(document.documentElement.dataset.effectiveTheme).toBe("dark");

        fireEvent.click(
            screen.getByRole("button", { name: "Use system" }),
        );

        await waitFor(() =>
            expect(screen.getByRole("status")).toHaveTextContent("system"),
        );
        expect(document.documentElement.dataset.themePreference).toBe("system");
        expect(document.documentElement.dataset.effectiveTheme).toBe("light");
    });
});
