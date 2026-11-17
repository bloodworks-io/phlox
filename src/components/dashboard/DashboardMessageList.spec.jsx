import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import DashboardMessageList from "./DashboardMessageList";
import { renderWithProviders } from "../../test/utils";

afterEach(cleanup);

const renderMessages = (visibleMessages) =>
    renderWithProviders(
        <DashboardMessageList
            visibleMessages={visibleMessages}
            setMessages={vi.fn()}
            messagesEndRef={{ current: document.createElement("div") }}
        />,
    );

describe("DashboardMessageList", () => {
    it("separates quiet assistant documents from user messages", () => {
        renderMessages([
            { message: { role: "assistant", content: "Consider iron studies." }, messageIndex: 0 },
            { message: { role: "user", content: "Please review the result." }, messageIndex: 1 },
        ]);

        const boxes = document.querySelectorAll(".message-box");
        expect(boxes).toHaveLength(2);
        expect(boxes[0]).toHaveClass("assistant");
        expect(boxes[1]).toHaveClass("user");
        expect(screen.getByText("Consider iron studies.")).toBeInTheDocument();
        expect(screen.getByText("Please review the result.")).toBeInTheDocument();
    });

    it("renders a loading assistant message without content", () => {
        renderMessages([
            { message: { role: "assistant", content: "", loading: true }, messageIndex: 0 },
        ]);

        expect(document.querySelector(".chakra-spinner")).not.toBeNull();
    });

    it("labels PDF and image attachments on user messages", () => {
        renderMessages([
            {
                message: {
                    role: "user",
                    content: "Review both documents.",
                    attachments: [
                        { filename: "referral.pdf", type: "application/pdf" },
                        { filename: "wound.png", type: "image/png" },
                    ],
                },
                messageIndex: 0,
            },
        ]);

        expect(screen.getByText("referral.pdf")).toBeInTheDocument();
        expect(screen.getByText("wound.png")).toBeInTheDocument();
        expect(screen.getByText("Review both documents.")).toBeInTheDocument();
    });

    it("renders assistant citations and artifacts through the shared surfaces", () => {
        renderMessages([
            {
                message: {
                    role: "assistant",
                    content: "The ferritin is improving.[^1]",
                    context: {
                        1: {
                            document_name: "Pathology report.pdf",
                            page_number: 2,
                        },
                    },
                    artifacts: [
                        {
                            id: "artifact-1",
                            filename: "letter.pdf",
                            content_type: "application/pdf",
                            size: 2048,
                        },
                    ],
                },
                messageIndex: 0,
            },
        ]);

        expect(screen.getByText(/the ferritin is improving/i)).toBeInTheDocument();
        expect(screen.getByText("letter.pdf")).toBeInTheDocument();
    });

    it("exposes the messages-end anchor used for near-bottom scrolling", () => {
        const messagesEndRef = { current: null };
        renderWithProviders(
            <DashboardMessageList
                visibleMessages={[]}
                setMessages={vi.fn()}
                messagesEndRef={messagesEndRef}
            />,
        );

        expect(messagesEndRef.current).toBeInstanceOf(HTMLDivElement);
    });
});
