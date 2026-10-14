import { describe, it, expect, vi, beforeEach } from "vitest";

const { universalFetchMock } = vi.hoisted(() => ({
    universalFetchMock: vi.fn(),
}));

vi.mock("../helpers/apiHelpers", () => ({
    handleApiRequest: vi.fn(),
    universalFetch: universalFetchMock,
}));

vi.mock("../helpers/apiConfig", () => ({
    buildApiUrl: async (path: string) => `http://localhost${path}`,
}));

import { patientApi } from "./patientApi";

const sseResponse = (chunks: string[]) => ({
    ok: true,
    body: new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            for (const chunk of chunks) {
                controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
        },
    }),
    json: async () => ({}),
});

beforeEach(() => {
    universalFetchMock.mockReset();
});

describe("patientApi.generateReasoningStream", () => {
    it("reassembles SSE events split across network chunks", async () => {
        const event = `data: ${JSON.stringify({
            type: "result",
            data: { summary: "ok", thinking: "x".repeat(4096) },
        })}\n\n`;
        const mid = Math.floor(event.length / 2);
        universalFetchMock.mockResolvedValue(
            sseResponse([event.slice(0, mid), event.slice(mid)]),
        );

        const result = await patientApi.generateReasoningStream(1, vi.fn(), null);
        expect(result).toEqual({ summary: "ok", thinking: "x".repeat(4096) });
    });

    it("delivers status events to the onStatus callback", async () => {
        universalFetchMock.mockResolvedValue(
            sseResponse([
                `data: ${JSON.stringify({ type: "status", message: "Analyzing..." })}\n\n`,
                `data: ${JSON.stringify({
                    type: "result",
                    data: { summary: "done" },
                })}\n\n`,
            ]),
        );

        const onStatus = vi.fn();
        const result = await patientApi.generateReasoningStream(1, onStatus, null);
        expect(onStatus).toHaveBeenCalledWith("Analyzing...");
        expect(result).toEqual({ summary: "done" });
    });

    it("surfaces SSE error events as rejections", async () => {
        universalFetchMock.mockResolvedValue(
            sseResponse([
                `data: ${JSON.stringify({
                    type: "error",
                    message: "The model returned an unreadable analysis.",
                })}\n\n`,
            ]),
        );

        await expect(
            patientApi.generateReasoningStream(1, vi.fn(), null),
        ).rejects.toThrow("The model returned an unreadable analysis.");
    });

    it("rejects when the stream ends without a result event", async () => {
        universalFetchMock.mockResolvedValue(
            sseResponse([
                `data: ${JSON.stringify({ type: "status", message: "working" })}\n\n`,
            ]),
        );

        await expect(
            patientApi.generateReasoningStream(1, vi.fn(), null),
        ).rejects.toThrow();
    });
});
