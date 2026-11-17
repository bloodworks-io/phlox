import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import DashboardChat from "./DashboardChat";
import { renderWithProviders } from "../../test/utils";

const mocks = vi.hoisted(() => ({
    chat: {
        messages: [],
        setMessages: vi.fn(),
        userInput: "",
        setUserInput: vi.fn(),
        showSuggestions: true,
        setShowSuggestions: vi.fn(),
        loading: false,
        sendMessage: vi.fn(),
    },
    todos: {
        todos: [
            { id: 1, task: "Order FBE", completed: false },
            { id: 2, task: "Send referral", completed: true },
        ],
        visibleTodos: [{ id: 1, task: "Order FBE", completed: false }],
        newTodo: "",
        setNewTodo: vi.fn(),
        showAllTodos: false,
        setShowAllTodos: vi.fn(),
        isCollapsed: false,
        toggleCollapsed: vi.fn(),
        isLoading: false,
        isSaving: false,
        addTodo: vi.fn(),
        toggleTodo: vi.fn(),
        deleteTodo: vi.fn(),
        handleTodoKeyDown: vi.fn(),
    },
}));

vi.mock("../../utils/hooks/useChat", () => ({
    useChat: vi.fn(() => mocks.chat),
}));

vi.mock("../../utils/hooks/useDashboardTodos", () => ({
    useDashboardTodos: vi.fn(() => mocks.todos),
}));

vi.mock("../../utils/api/settingsApi", () => ({
    settingsApi: {
        fetchUserSettings: vi.fn(async () => ({ specialty: "general practice" })),
        fetchConfig: vi.fn(async () => ({
            DOCUMENT_IMAGE_PROCESSING_MODE: "auto",
            VISION_MODEL_CAPABLE: false,
        })),
    },
}));

vi.mock("../../utils/api/chatApi", () => ({
    chatApi: {
        getCurrentVisionCapability: vi.fn(async () => ({
            vision_capable: false,
        })),
    },
}));

const renderChat = () => renderWithProviders(<DashboardChat />);

beforeEach(() => {
    vi.clearAllMocks();
    mocks.chat.messages = [];
    mocks.chat.userInput = "";
    mocks.chat.showSuggestions = true;
    mocks.chat.loading = false;
    mocks.todos.isCollapsed = false;
});

afterEach(cleanup);

describe("DashboardChat", () => {
    it("renders the greeting, selected specialty suggestions, composer, and todo panel", async () => {
        renderChat();

        expect(
            screen.getByText(/how can i help/i, { exact: false }),
        ).toBeInTheDocument();
        await waitFor(() =>
            expect(
                document.querySelectorAll(".dashboard-chat-suggestions").length,
            ).toBe(3),
        );
        expect(
            screen.getByPlaceholderText(/message phlox/i),
        ).toBeInTheDocument();
        expect(screen.getByText("Order FBE")).toBeInTheDocument();
        expect(screen.getByText("1 active")).toBeInTheDocument();
    });

    it("hides specialty suggestions when the preference is disabled", async () => {
        mocks.chat.showSuggestions = false;
        renderChat();

        await waitFor(() =>
            expect(screen.getByPlaceholderText(/message phlox/i)).toBeInTheDocument(),
        );
        expect(
            document.querySelector(".dashboard-chat-suggestions"),
        ).not.toBeInTheDocument();
    });

    it("sends a selected suggestion and closes the suggestion row", async () => {
        vi.useFakeTimers();
        try {
            renderChat();

            await vi.waitFor(() =>
                expect(
                    document.querySelectorAll(".dashboard-chat-suggestions").length,
                ).toBe(3),
            );
            fireEvent.click(
                document.querySelector(".dashboard-chat-suggestions"),
            );

            await vi.advanceTimersByTimeAsync(300);
            expect(mocks.chat.sendMessage).toHaveBeenCalledTimes(1);
            expect(mocks.chat.setShowSuggestions).toHaveBeenCalledWith(false);
        } finally {
            vi.useRealTimers();
        }
    });

    it("renders active chat with the bottom composer and scrolls new messages when near the bottom", async () => {
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;
        mocks.chat.messages = [
            { role: "user", content: "Review this ferritin trend." },
            { role: "assistant", content: "The trend is improving." },
        ];

        renderChat();

        expect(
            screen.getByText("Review this ferritin trend."),
        ).toBeInTheDocument();
        expect(screen.getByText("The trend is improving.")).toBeInTheDocument();
        expect(
            screen.getByPlaceholderText(/message phlox/i),
        ).toBeInTheDocument();
        await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
        expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" });
        delete Element.prototype.scrollIntoView;
    });

    it("keeps the empty-state composer within the established 800px contract", async () => {
        renderChat();

        await waitFor(() =>
            expect(screen.getByPlaceholderText(/message phlox/i)).toBeInTheDocument(),
        );
        const composer = document.querySelector(
            ".dashboard-chat-input-container",
        );
        expect(composer.parentElement).toHaveStyle({ maxWidth: "800px" });
    });
});
