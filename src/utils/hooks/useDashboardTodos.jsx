import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { landingApi } from "../api/landingApi";
import { KEYS } from "../cache/keys";

export const useDashboardTodos = ({
  initialShowAll = false,
  initialCollapsed = true,
  autoFetch = true,
} = {}) => {
  const [newTodo, setNewTodo] = useState("");
  const [showAllTodos, setShowAllTodos] = useState(initialShowAll);
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const {
    data: todos = [],
    isValidating: isLoading,
    error: fetchError,
    mutate: mutateTodos,
  } = useSWR(autoFetch ? KEYS.TODOS : null, async () => {
    const data = await landingApi.fetchTodos();
    return Array.isArray(data?.todos) ? data.todos : [];
  });

  useEffect(() => {
    if (fetchError) {
      setError(fetchError);
      console.error("Error fetching todos:", fetchError);
    }
  }, [fetchError]);

  const visibleTodos = useMemo(
    () => (showAllTodos ? todos : todos.filter((todo) => !todo.completed)),
    [showAllTodos, todos],
  );

  const refreshTodos = useCallback(() => mutateTodos(), [mutateTodos]);

  const addTodo = useCallback(async () => {
    const task = newTodo.trim();
    if (!task) return null;

    setIsSaving(true);
    setError(null);

    try {
      const response = await landingApi.addTodo(task);
      const createdTodo = response?.todo ?? null;

      if (createdTodo) {
        mutateTodos((prev) => [...prev, createdTodo], { revalidate: false });
      } else {
        await mutateTodos();
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
  }, [newTodo, mutateTodos]);

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
          mutateTodos(
            (prev) =>
              prev.map((todo) =>
                todo.id === todoId ? response.todo : todo,
              ),
            { revalidate: false },
          );
          return response.todo;
        }

        await mutateTodos();
        return null;
      } catch (err) {
        setError(err);
        console.error("Error toggling todo:", err);
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [todos, mutateTodos],
  );

  const deleteTodo = useCallback(
    async (todoId) => {
      setIsSaving(true);
      setError(null);

      try {
        await landingApi.deleteTodo(todoId);
        mutateTodos(
          (prev) => prev.filter((todo) => todo.id !== todoId),
          { revalidate: false },
        );
        return true;
      } catch (err) {
        setError(err);
        console.error("Error deleting todo:", err);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [mutateTodos],
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
