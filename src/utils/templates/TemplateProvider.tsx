import React, {
  createContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useApiToast } from "../helpers/apiToastContext";
import { templateApi } from "../api/templateApi";
import { isDefaultTemplate } from "./templateFamily";
import { useAppInit } from "../context/appInit";

// Single source of truth for template state. Every mutation (default
// selection, save/fork/version bump, delete) flows through here so the
// active list, default pointer, and current selection can never drift
// apart the way the old mount-once load did.
const TemplateContext = createContext(null);

// Initial state
const initialState = {
  templates: [],
  currentTemplate: null,
  defaultTemplateKey: null,
  loading: false,
  error: null,
  status: "idle", // 'idle' | 'loading' | 'succeeded' | 'failed'
};

// Reducer function
function templateReducer(state, action) {
  switch (action.type) {
    case "START_LOADING":
      return { ...state, loading: true, status: "loading" };
    case "FINISH_LOADING":
      return { ...state, loading: false, status: "succeeded" };
    case "SET_TEMPLATES":
      return {
        ...state,
        templates: action.payload,
        error: null,
        loading: false,
        status: "succeeded",
      };
    case "SET_CURRENT_TEMPLATE":
      return {
        ...state,
        currentTemplate: action.payload,
        loading: false,
        status: "succeeded",
      };
    case "SET_DEFAULT_TEMPLATE_KEY":
      return {
        ...state,
        defaultTemplateKey: action.payload,
        loading: false,
        status: "succeeded",
      };
    case "SET_ERROR":
      return { ...state, error: action.payload, loading: false, status: "failed" };
    default:
      throw new Error(`Unhandled action type: ${action.type}`);
  }
}

export const TemplateProvider = ({ children }) => {
  const [state, dispatch] = useReducer(templateReducer, initialState);
  const toast = useApiToast();
  const { isInitializing } = useAppInit();


  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Set the active template.
  const selectTemplate = useCallback(
    async (templateKey, { includeDeleted = false } = {}) => {
      if (!templateKey) {
        return null;
      }

      const fromList = stateRef.current.templates.find(
        (t) => t.template_key === templateKey,
      );
      if (fromList) {
        dispatch({ type: "SET_CURRENT_TEMPLATE", payload: fromList });
        return fromList;
      }

      try {
        const template = await templateApi.getTemplateByKey(templateKey, {
          includeDeleted,
        });
        dispatch({ type: "SET_CURRENT_TEMPLATE", payload: template });
        return template;
      } catch (error) {
        console.error(
          `Failed to load template with key "${templateKey}":`,
          error,
        );
        dispatch({ type: "SET_ERROR", payload: error.message });
        toast({
          title: "Error",
          description: "Failed to load template",
          type: "error",
          duration: 3000,
        });
        return null;
      }
    },
    [toast],
  );

  // Reload the active template list and the default pointer, keeping the
  // current selection when it still exists and falling back to the default
  // otherwise.
  const refreshTemplates = useCallback(async () => {
    dispatch({ type: "START_LOADING" });
    try {
      const templatesData = await templateApi.fetchTemplates();
      dispatch({ type: "SET_TEMPLATES", payload: templatesData });

      const defaultData = await templateApi.getDefaultTemplate();
      const defaultKey = defaultData?.template_key ?? null;
      dispatch({ type: "SET_DEFAULT_TEMPLATE_KEY", payload: defaultKey });

      const prevKey = stateRef.current.currentTemplate?.template_key;
      const keepKey =
        prevKey && templatesData.some((t) => t.template_key === prevKey)
          ? prevKey
          : defaultKey;

      if (keepKey) {
        const fromList = templatesData.find((t) => t.template_key === keepKey);
        if (fromList) {
          dispatch({ type: "SET_CURRENT_TEMPLATE", payload: fromList });
        } else {
          await selectTemplate(keepKey);
        }
      }
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error.message });
      toast({
        title: "Error",
        description: "Failed to refresh templates",
        type: "error",
        duration: 3000,
      });
    }
  }, [toast, selectTemplate]);

  const setDefaultTemplate = useCallback(
    async (templateKey) => {
      if (!templateKey) {
        return;
      }
      await templateApi.setDefaultTemplate(templateKey);
      dispatch({ type: "SET_DEFAULT_TEMPLATE_KEY", payload: templateKey });
      await selectTemplate(templateKey);
    },
    [selectTemplate],
  );

  const saveTemplate = useCallback(
    async (template) => {
      const result = await templateApi.saveTemplates([template]);
      const newKey = result?.updated_keys?.[template.template_key];
      await refreshTemplates();
      if (newKey && newKey !== template.template_key) {
        await selectTemplate(newKey);
      }
      return result;
    },
    [refreshTemplates, selectTemplate],
  );

  const deleteTemplate = useCallback(
    async (templateKey) => {
      if (isDefaultTemplate(templateKey)) {
        toast({
          title: "Error",
          description: "Cannot delete default templates",
          type: "error",
          duration: 3000,
        });
        return false;
      }

      try {
        await templateApi.deleteTemplate(templateKey);
        await refreshTemplates();
        toast({
          title: "Success",
          description: "Template deleted successfully",
          type: "success",
          duration: 3000,
        });
        return true;
      } catch (error) {
        dispatch({ type: "SET_ERROR", payload: error.message });
        toast({
          title: "Error",
          description: error.message || "Failed to delete template",
          type: "error",
          duration: 3000,
        });
        return false;
      }
    },
    [toast, refreshTemplates],
  );

  // Legacy helper: ensure the default pointer is loaded and return it.
  const loadDefaultTemplate = useCallback(async () => {
    let key = stateRef.current.defaultTemplateKey;
    if (!key) {
      try {
        const data = await templateApi.getDefaultTemplate();
        key = data?.template_key ?? null;
        if (key) {
          dispatch({ type: "SET_DEFAULT_TEMPLATE_KEY", payload: key });
        }
      } catch (error) {
        dispatch({ type: "SET_ERROR", payload: error.message });
        return null;
      }
    }
    if (!key) {
      return null;
    }
    return (
      stateRef.current.templates.find((t) => t.template_key === key) ?? {
        template_key: key,
      }
    );
  }, []);

  // Initialize templates on mount
  // Skip initialization if app is still initializing (server not ready)
  useEffect(() => {
    if (isInitializing) {
      return;
    }
    refreshTemplates();
  }, [refreshTemplates, isInitializing]);

  // The full default template object, derived from the active list (the
  // /default endpoint only returns the key).
  const defaultTemplate = useMemo(() => {
    if (!state.defaultTemplateKey) {
      return null;
    }
    return (
      state.templates.find(
        (t) => t.template_key === state.defaultTemplateKey,
      ) ?? { template_key: state.defaultTemplateKey }
    );
  }, [state.templates, state.defaultTemplateKey]);

  const value = useMemo(
    () => ({
      ...state,
      defaultTemplate,
      isLoading: state.loading,
      selectTemplate,
      setActiveTemplate: selectTemplate, // legacy alias
      refreshTemplates,
      setDefaultTemplate,
      saveTemplate,
      deleteTemplate,
      loadDefaultTemplate,
    }),
    [
      state,
      defaultTemplate,
      selectTemplate,
      refreshTemplates,
      setDefaultTemplate,
      saveTemplate,
      deleteTemplate,
      loadDefaultTemplate,
    ],
  );

  return (
    <TemplateContext.Provider value={value}>
      {children}
    </TemplateContext.Provider>
  );
};

export { TemplateContext };
