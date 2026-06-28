import { useState, useCallback } from "react";

export const useActivePanel = () => {
    const [activePanel, setActivePanel] = useState(null);

    const open = useCallback((name) => {
        setActivePanel(name);
    }, []);

    const toggle = useCallback((name) => {
        setActivePanel((prev) => (prev === name ? null : name));
    }, []);

    const close = useCallback((name) => {
        setActivePanel((prev) => (prev === name ? null : prev));
    }, []);

    const closeAll = useCallback(() => {
        setActivePanel(null);
    }, []);

    const isOpen = useCallback((name) => activePanel === name, [activePanel]);

    return { activePanel, open, toggle, close, closeAll, isOpen };
};
