import React, {
    createContext,
    useContext,
    useReducer,
    useCallback,
} from "react";
import { useToast } from "@chakra-ui/react";
import { templateApi } from "../api/templateApi";
import { templateService } from "./templateService";
// Create context
const TemplateContext = createContext(null);

// Initial state
const initialState = {
    templates: [],
    currentTemplate: null,
    defaultTemplate: null,
    loading: false,
    error: null,
    status: "idle", // 'idle' | 'loading' | 'succeeded' | 'failed'
};

const MIN_LOADING_TIME = 300;

// Reducer function
function templateReducer(state, action) {
    switch (action.type) {
        case "START_LOADING":
            return {
                ...state,
                loading: true,
                visualLoading: true,
                status: "loading",
            };
        case "FINISH_LOADING":
            return {
                ...state,
                loading: false,
                status: state.visualLoading ? "loading" : "succeeded",
            };
        case "SET_VISUAL_LOADING":
            return {
                ...state,
                visualLoading: action.payload,
                status: action.payload ? "loading" : "succeeded",
            };
        case "SET_LOADING":
            return { ...state, loading: true, status: "loading" };
        case "SET_TEMPLATES":
            return {
                ...state,
                templates: action.payload,
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
        case "SET_DEFAULT_TEMPLATE":
            return {
                ...state,
                defaultTemplate: action.payload,
                loading: false,
                status: "succeeded",
            };
        case "DELETE_TEMPLATE":
            return {
                ...state,
                templates: state.templates.filter(
                    (t) => t.template_key !== action.payload,
                ),
                loading: false,
                status: "succeeded",
            };
        case "SET_ERROR":
            return {
                ...state,
                error: action.payload,
                loading: false,
                status: "failed",
            };
        case "RESET":
            return initialState;
        case "SET_TEMPLATE_CHANGING":
            return {
                ...state,
                isTemplateChanging: action.payload,
            };
        default:
            throw new Error(`Unhandled action type: ${action.type}`);
    }
}

export const TemplateProvider = ({ children }) => {
    const [state, dispatch] = useReducer(templateReducer, {
        ...initialState,
        loading: false,
        visualLoading: false,
    });
    const toast = useToast();

    // Load all templates
    const loadTemplates = useCallback(async () => {
        dispatch({ type: "SET_LOADING" });
        try {
            const templatesData = await templateApi.fetchTemplates();
            dispatch({ type: "SET_TEMPLATES", payload: templatesData });
        } catch (error) {
            dispatch({ type: "SET_ERROR", payload: error.message });
            toast({
                title: "Error",
                description: "Failed to load templates",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        }
    }, [toast]);

    // Load default template
    const loadDefaultTemplate = useCallback(async () => {
        dispatch({ type: "SET_LOADING" });
        try {
            const defaultTemplateData = await templateApi.getDefaultTemplate();
            dispatch({
                type: "SET_DEFAULT_TEMPLATE",
                payload: defaultTemplateData,
            });
            return defaultTemplateData;
        } catch (error) {
            dispatch({ type: "SET_ERROR", payload: error.message });
            toast({
                title: "Error",
                description: "Failed to load default template",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
            return null;
        }
    }, [toast]);

    // Set active template
    const setActiveTemplate = useCallback(
        async (templateKey, reason = "unspecified") => {
            dispatch({ type: "START_LOADING" });
            const loadingStartTime = Date.now();

            try {
                const template =
                    await templateApi.getTemplateByKey(templateKey);

                dispatch({ type: "SET_CURRENT_TEMPLATE", payload: template });
                dispatch({ type: "FINISH_LOADING" });

                // Calculate remaining time to meet minimum loading duration
                const loadingEndTime = Date.now();
                const loadingDuration = loadingEndTime - loadingStartTime;
                const remainingTime = Math.max(
                    0,
                    MIN_LOADING_TIME - loadingDuration,
                );

                // Keep visual loading state for remaining time
                if (remainingTime > 0) {
                    await new Promise((resolve) =>
                        setTimeout(resolve, remainingTime),
                    );
                }
                dispatch({ type: "SET_VISUAL_LOADING", payload: false });

                return template;
            } catch (error) {
                console.error(
                    `Failed to load template with key "${templateKey}":`,
                    error,
                );
                dispatch({ type: "SET_ERROR", payload: error.message });
                dispatch({ type: "FINISH_LOADING" });
                dispatch({ type: "SET_VISUAL_LOADING", payload: false });

                toast({
                    title: "Error",
                    description: "Failed to load template",
                    status: "error",
                    duration: 3000,
                    isClosable: true,
                });
                return null;
            }
        },
        [toast],
    );

    // Update default template
    const updateDefaultTemplate = useCallback(
        async (templateKey) => {
            dispatch({ type: "SET_LOADING" });
            try {
                await templateApi.setDefaultTemplate(templateKey);
                await loadDefaultTemplate();
                toast({
                    title: "Success",
                    description: "Default template updated successfully",
                    status: "success",
                    duration: 3000,
                    isClosable: true,
                });
            } catch (error) {
                dispatch({ type: "SET_ERROR", payload: error.message });
                toast({
                    title: "Error",
                    description: "Failed to update default template",
                    status: "error",
                    duration: 3000,
                    isClosable: true,
                });
            }
        },
        [loadDefaultTemplate, toast],
    );

    // Initialize templates on mount
    React.useEffect(() => {
        const initializeTemplates = async () => {
            try {
                dispatch({ type: "SET_LOADING" });

                // Load all templates (this is already handled by loadTemplates())
                await loadTemplates();

                // Load and set default template
                const defaultTemplate = await loadDefaultTemplate();
                if (!defaultTemplate) {
                    throw new Error("No default template found");
                }

                // Additionally set it as the current active template
                await setActiveTemplate(defaultTemplate.template_key);
            } catch (error) {
                dispatch({ type: "SET_ERROR", payload: error.message });
                toast({
                    title: "Error",
                    description: "Failed to initialize templates",
                    status: "error",
                    duration: 3000,
                    isClosable: true,
                });
            }
        };
        initializeTemplates();
    }, [loadTemplates, loadDefaultTemplate, setActiveTemplate, toast]);

    const refreshTemplates = useCallback(async () => {
        dispatch({ type: "START_LOADING" });
        try {
            // Load all templates
            await loadTemplates();
            // Load and set default template
            const defaultTemplate = await loadDefaultTemplate();
            if (defaultTemplate) {
                await setActiveTemplate(
                    defaultTemplate.template_key,
                    "refresh",
                );
            }
        } catch (error) {
            dispatch({ type: "SET_ERROR", payload: error.message });
            toast({
                title: "Error",
                description: "Failed to refresh templates",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        }
    }, [loadTemplates, loadDefaultTemplate, setActiveTemplate, toast]);

    const deleteTemplate = useCallback(
        async (templateKey) => {
            if (templateService.isDefaultTemplate(templateKey)) {
                toast({
                    title: "Error",
                    description: "Cannot delete default templates",
                    status: "error",
                    duration: 3000,
                    isClosable: true,
                });
                return false;
            }

            dispatch({ type: "SET_LOADING" });
            try {
                await templateService.deleteTemplate(templateKey);
                dispatch({ type: "DELETE_TEMPLATE", payload: templateKey });

                // Refresh templates after deletion
                await refreshTemplates();

                toast({
                    title: "Success",
                    description: "Template deleted successfully",
                    status: "success",
                    duration: 3000,
                    isClosable: true,
                });
                return true;
            } catch (error) {
                dispatch({ type: "SET_ERROR", payload: error.message });
                toast({
                    title: "Error",
                    description: error.message || "Failed to delete template",
                    status: "error",
                    duration: 3000,
                    isClosable: true,
                });
                return false;
            }
        },
        [toast, refreshTemplates],
    );

    const value = {
        ...state,
        loadTemplates,
        setActiveTemplate,
        updateDefaultTemplate,
        loadDefaultTemplate,
        refreshTemplates,
        deleteTemplate,
    };

    return (
        <TemplateContext.Provider
            value={{
                ...state,
                setActiveTemplate,
                isLoading: state.visualLoading,
                refreshTemplates,
                deleteTemplate,
            }}
        >
            {children}
        </TemplateContext.Provider>
    );
};

// Custom hook for template selection
export const useTemplateSelection = () => {
    const context = useContext(TemplateContext);
    if (!context) {
        throw new Error(
            "useTemplateSelection must be used within a TemplateProvider",
        );
    }

    const {
        currentTemplate,
        templates,
        defaultTemplate,
        status,
        error,
        setActiveTemplate,
    } = context;

    const selectTemplate = useCallback(
        async (templateKey) => {
            if (!templateKey) {
                return null;
            }

            const callStack = new Error().stack;

            try {
                const template = await setActiveTemplate(templateKey);

                return template;
            } catch (error) {
                console.error(
                    `Error selecting template with key "${templateKey}":`,
                    error,
                );
                throw error;
            }
        },
        [setActiveTemplate],
    );

    return {
        currentTemplate,
        defaultTemplate,
        templates,
        status,
        error,
        selectTemplate,
    };
};

export const useTemplate = () => {
    const context = useContext(TemplateContext);
    if (!context) {
        throw new Error("useTemplate must be used within a TemplateProvider");
    }
    return {
        ...context,
        deleteTemplate: context.deleteTemplate,
    };
};
