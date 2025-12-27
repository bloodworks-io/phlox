// Styles for the application's scrollbars
import { colors } from "../colors";

export const scrollbarStyles = (props) => ({
    ".custom-scrollbar": {
        scrollbarWidth: "thin",
        scrollbarColor: `${colors.light.surface2} transparent`,
    },
    ".custom-scrollbar::-webkit-scrollbar": {
        width: "6px",
    },
    ".custom-scrollbar::-webkit-scrollbar-track": {
        background: "transparent",
    },
    ".custom-scrollbar::-webkit-scrollbar-thumb": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.surface2}B3`
                : `${colors.dark.surface2}B3`,
        borderRadius: "6px",
        border: `none`,
    },
});
