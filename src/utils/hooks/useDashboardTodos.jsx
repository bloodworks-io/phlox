import { useCallback, useEffect, useMemo, useState } from "react";
import { landingApi } from "../api/landingApi";
import { universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

export const useDashboardTodos = ({
  initialShowAll = false,
  initialCollapsed = true,
  autoFetch = true,
} = {}) => {
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState("");
  const [showAllTodos, setShowAllTodos] = useState(initialShowAll);
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const visibleTodos = useMemo(
    () => (showAllTodos ? todos : todos.filter((todo) => !todo.completed)),
    [showAllTodos, todos],
  );

  const refreshTodos = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await universalFetch(await buildApiUrl("/api/dashboard/todos"));
      if (!response.ok) {
        throw new Error(`Failed to fetch todos (${response.status})`);
      }

      const data = await response.json();
      setTodos(Array.isArray(data?.todos) ? data.todos : []);
      return data?.todos || [];
    } catch (err) {
      setError(err);
      console.error("Error fetching todos:", err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addTodo = useCallback(async () => {
    const task = newTodo.trim();
    if (!task) return null;

    setIsSaving(true);
    setError(null);

    try {
      const response = await landingApi.addTodo(task);
      const createdTodo = response?.todo ?? null;

      if (createdTodo) {
        setTodos((prev) => [...prev, createdTodo]);
      } else {
        await refreshTodos();
      }

      setNewTodo("");
      return createdTodo;
    } catch (err) {
      setError(err);
      console.error("Error adding todo:", err);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [newTodo, refreshTodos]);

  const toggleTodo = useCallback(
    async (todoId) => {
      setIsSaving(true);
      setError(null);

      try {
        const existing = todos.find((todo) => todo.id === todoId);
        if (!existing) return null;

        const response = await landingApi.toggleTodo(
          todoId,
          existing.completed,
          existing.task,
        );

        if (response?.todo) {
          setTodos((prev) =>
            prev.map((todo) => (todo.id === todoId ? response.todo : todo)),
          );
          return response.todo;
        }

        await refreshTodos();
        return null;
      } catch (err) {
        setError(err);
        console.error("Error toggling todo:", err);
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [todos, refreshTodos],
  );

  const deleteTodo = useCallback(
    async (todoId) => {
      setIsSaving(true);
      setError(null);

      try {
        await landingApi.deleteTodo(todoId);
        setTodos((prev) => prev.filter((todo) => todo.id !== todoId));
        return true;
      } catch (err) {
        setError(err);
        console.error("Error deleting todo:", err);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  const handleTodoKeyDown = useCallback(
    async (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        await addTodo();
      }
    },
    [addTodo],
  );

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  useEffect(() => {
    if (autoFetch) {
      refreshTodos();
    }
  }, [autoFetch, refreshTodos]);

  return {
    todos,
    visibleTodos,
    newTodo,
    setNewTodo,
    showAllTodos,
    setShowAllTodos,
    isCollapsed,
    setIsCollapsed,
    toggleCollapsed,
    isLoading,
    isSaving,
    error,
    refreshTodos,
    addTodo,
    toggleTodo,
    deleteTodo,
    handleTodoKeyDown,
  };
};

export default useDashboardTodos;
