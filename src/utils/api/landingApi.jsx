// API functions for handling dashboard data.
import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";

export const landingApi = {
  addTodo: async (task) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl("/api/dashboard/todos");
        return universalFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task }),
        });
      },
      successMessage: "Todo added successfully",
      errorMessage: "Error adding todo",
    }),

  toggleTodo: async (id, completed, task) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/dashboard/todos/${id}`);
        return universalFetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task, completed: !completed }),
        });
      },
      successMessage: "Todo updated successfully",
      errorMessage: "Error updating todo",
    }),

  deleteTodo: async (id) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/dashboard/todos/${id}`);
        return universalFetch(url, { method: "DELETE" });
      },
      successMessage: "Todo deleted successfully",
      errorMessage: "Error deleting todo",
    }),
};
