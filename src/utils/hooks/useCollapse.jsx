// Custom hook for managing collapse/expand state of a component.
import { useCallback, useMemo, useState } from "react";

export const useCollapse = (initialState = true) => {
    const [isCollapsed, setIsCollapsed] = useState(initialState);

    const toggle = useCallback(() => setIsCollapsed((prev) => !prev), []);

    return useMemo(
        () => ({ isCollapsed, setIsCollapsed, toggle }),
        [isCollapsed, toggle],
    );
};
