import React, { useContext, useCallback } from "react";
import { TemplateContext } from "../../templates/templateContext";

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
