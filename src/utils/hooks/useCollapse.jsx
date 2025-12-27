// Custom hook for managing collapse/expand state of a component.
import { useState } from "react";

export const useCollapse = (initialState = true) => {
    const [isCollapsed, setIsCollapsed] = useState(initialState);

    const toggle = () => setIsCollapsed((prev) => !prev);

    return {
        isCollapsed,
        setIsCollapsed,
        toggle,
    };
};
