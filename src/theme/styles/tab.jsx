// Defines visual styles for tab components within the application.
import { colors } from "../colors";

export const tabStyles = (props) => ({
    ".tab-style": {
        backgroundColor: "transparent !important",
        borderRadius: "0 !important",
        borderTopLeftRadius: "md !important",
        borderTopRightRadius: "md !important",
        marginBottom: "-1px",
        "&[aria-selected=true]": {
            backgroundColor:
                props.colorMode === "light"
                    ? `${colors.light.base} !important`
                    : `${colors.dark.crust} !important`,
            color:
                props.colorMode === "light"
                    ? `${colors.light.textSecondary} !important`
                    : `${colors.dark.textSecondary} !important`,
            border: "none",
        },
        "&[aria-selected=false]": {
            backgroundColor: "transparent !important",
            color:
                props.colorMode === "light"
                    ? `${colors.light.textTertiary} !important`
                    : `${colors.dark.textTertiary} !important`,
        },
        "&:hover": {
            backgroundColor:
                props.colorMode === "light"
                    ? `${colors.light.surface} !important`
                    : `${colors.dark.surface} !important`,
        },
    },
    ".tab-panel-container": {
        minHeight: "180px !important",
        display: "flex !important",
        alignItems: "center !important",
        justifyContent: "center !important",
    },
});
