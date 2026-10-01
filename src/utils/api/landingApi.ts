// API functions for handling dashboard data.
import { handleApiRequest, universalFetch } from "../helpers/apiHelpers";
import { buildApiUrl } from "../helpers/apiConfig";
import { t } from "@/i18n";

export const landingApi = {
  fetchTodos: async () =>
    handleApiRequest({
      apiCall: async (signal) => {
        const url = await buildApiUrl("/api/dashboard/todos");
        return universalFetch(url, { signal });
      },
      errorMessage: t("api.landing.fetchTodosFailed"),
    }),

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
      successMessage: t("api.landing.addTodoSuccess"),
      errorMessage: t("api.landing.addTodoFailed"),
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
      successMessage: t("api.landing.toggleTodoSuccess"),
      errorMessage: t("api.landing.toggleTodoFailed"),
    }),

  deleteTodo: async (id) =>
    handleApiRequest({
      apiCall: async () => {
        const url = await buildApiUrl(`/api/dashboard/todos/${id}`);
        return universalFetch(url, { method: "DELETE" });
      },
      successMessage: t("api.landing.deleteTodoSuccess"),
      errorMessage: t("api.landing.deleteTodoFailed"),
    }),
};
