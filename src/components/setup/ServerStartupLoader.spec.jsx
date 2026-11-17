import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import ServerStartupLoader from "./ServerStartupLoader";
import { renderWithProviders } from "../../test/utils";

const settingsApiMock = vi.hoisted(() => ({
    fetchServerStatus: vi.fn(),
}));

vi.mock("../../utils/api/settingsApi", () => ({
    settingsApi: settingsApiMock,
}));
vi.mock("../../utils/helpers/apiConfig", () => ({
    isTauri: () => false,
}));

describe("ServerStartupLoader", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it("calls onReady as soon as the server reports ready", async () => {
        settingsApiMock.fetchServerStatus.mockResolvedValue({ ready: true });
        const onReady = vi.fn();
        const onError = vi.fn();

        renderWithProviders(
            <ServerStartupLoader onReady={onReady} onError={onError} />,
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(settingsApiMock.fetchServerStatus).toHaveBeenCalledTimes(1);
        expect(onReady).toHaveBeenCalledTimes(1);
        expect(onError).not.toHaveBeenCalled();
    });

    it("times out after sixty seconds and reports the error to the parent", async () => {
        settingsApiMock.fetchServerStatus.mockRejectedValue(
            new Error("not ready"),
        );
        const onReady = vi.fn();
        const onError = vi.fn();

        renderWithProviders(
            <ServerStartupLoader onReady={onReady} onError={onError} />,
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(60_000);
        });

        expect(onReady).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
        expect(
            screen.getByRole("button", { name: /try again/i }),
        ).toBeInTheDocument();
    });

    it("can retry locally after a timeout", async () => {
        let rejectPoll = true;
        settingsApiMock.fetchServerStatus.mockImplementation(() =>
            rejectPoll
                ? Promise.reject(new Error("not ready"))
                : Promise.resolve({ ready: true }),
        );
        const onReady = vi.fn();
        const onError = vi.fn();

        renderWithProviders(
            <ServerStartupLoader onReady={onReady} onError={onError} />,
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(60_000);
        });
        expect(onError).toHaveBeenCalledTimes(1);

        rejectPoll = false;
        await act(async () => {
            fireEvent.click(
                screen.getByRole("button", { name: /try again/i }),
            );
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(onReady).toHaveBeenCalledTimes(1);
    });
});
