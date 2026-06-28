import { useEffect, useCallback } from "react";
import { Steps, useBreakpointValue } from "@chakra-ui/react";
import { useCollapse } from "./useCollapse";

export const useSidebarState = () => {
    // True for base/sm breakpoints, false for larger screens
    const defaultCollapsed = useBreakpointValue({
        base: true,
        sm: true,
        md: false,
    });

    const { isCollapsed, setIsCollapsed } = useCollapse(defaultCollapsed);

    const isSmallScreen = useBreakpointValue({ base: true, md: false });

    // Update sidebar state whenever the breakpoint changes
    useEffect(() => {
        if (defaultCollapsed !== undefined) {
            setIsCollapsed(defaultCollapsed);
        }
    }, [defaultCollapsed, setIsCollapsed]);

    const toggleSidebar = useCallback(() => {
        setIsCollapsed((prev) => !prev);
    }, [setIsCollapsed]);

    return {
        isSidebarCollapsed: isCollapsed,
        setIsSidebarCollapsed: setIsCollapsed,
        toggleSidebar,
        isSmallScreen,
    };
};
