import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardTodoPanel from "./DashboardTodoPanel";
import { renderWithProviders } from "../../test/utils";

const todos = [
    { id: 1, task: "Order FBE", completed: false },
    { id: 2, task: "Review iron results", completed: false },
    { id: 3, task: "Send referral", completed: true },
];

const baseProps = {
    todos,
    visibleTodos: todos.filter((todo) => !todo.completed),
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
};

const renderPanel = (overrides = {}) =>
    renderWithProviders(<DashboardTodoPanel {...baseProps} {...overrides} />);

afterEach(cleanup);

describe("DashboardTodoPanel", () => {
    it("requests collapse while retaining the active count", () => {
        renderPanel({ isCollapsed: true });

        expect(screen.getByRole("button", { name: /todo list/i })).toBeInTheDocument();
        expect(screen.getByText("2 active")).toBeInTheDocument();
    });

    it("expands and renders active and completed counts", () => {
        renderPanel();

        expect(screen.getByText("Order FBE")).toBeInTheDocument();
        expect(screen.getByText("Review iron results")).toBeInTheDocument();
        expect(screen.getByText("1 completed")).toBeInTheDocument();
        expect(screen.queryByText("Send referral")).not.toBeInTheDocument();
    });

    it("edits and submits a new task", () => {
        renderPanel();
        const input = screen.getByPlaceholderText("Add a task...");

        fireEvent.change(input, { target: { value: "Check ferritin" } });
        expect(baseProps.setNewTodo).toHaveBeenCalledWith("Check ferritin");

        fireEvent.keyDown(input, { key: "Enter" });
        expect(baseProps.handleTodoKeyDown).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole("button", { name: "Add todo" }));
        expect(baseProps.addTodo).toHaveBeenCalledTimes(1);
    });

    it("toggles and deletes visible tasks", async () => {
        renderPanel();
        const user = userEvent.setup();

        await user.click(screen.getByText("Order FBE"));
        expect(baseProps.toggleTodo).toHaveBeenCalledWith(1);

        fireEvent.click(
            screen.getAllByRole("button", { name: "Delete todo" })[0],
        );
        expect(baseProps.deleteTodo).toHaveBeenCalledWith(1);
    });

    it("switches between active-only and all-tasks views", () => {
        renderPanel();

        fireEvent.click(screen.getByRole("button", { name: "Show all" }));
        expect(baseProps.setShowAllTodos).toHaveBeenCalledTimes(1);

        cleanup();
        renderPanel({ showAllTodos: true, visibleTodos: todos });
        expect(screen.getByText("Send referral")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Show active" })).toBeInTheDocument();
    });

    it("renders the loading spinner instead of task rows", () => {
        const { container } = renderPanel({ isLoading: true });

        expect(screen.queryByText("Order FBE")).not.toBeInTheDocument();
        expect(container.querySelector(".chakra-spinner")).not.toBeNull();
    });

    it("disables task mutations while saving", () => {
        renderPanel({ isSaving: true });

        expect(screen.getByPlaceholderText("Add a task...")).toBeDisabled();
        expect(screen.getByRole("button", { name: "Add todo" })).toBeDisabled();
        expect(
            screen.getAllByRole("button", { name: "Delete todo" })[0],
        ).toBeDisabled();
    });

    it("shows the empty state", () => {
        renderPanel({ todos: [], visibleTodos: [] });

        expect(screen.getByText("No tasks yet.")).toBeInTheDocument();
        expect(screen.getByText("0 active")).toBeInTheDocument();
    });
});
