// Styles specifically for the document explorer user interface.
import { colors } from "../colors";

export const documentExplorerStyles = (props) => ({
    ".documentExplorer-style": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.base} !important`
                : `${colors.dark.crust} !important`,
        color:
            props.colorMode === "light"
                ? `${colors.light.textPrimary} !important`
                : `${colors.dark.textTertiary} !important`,
        border: "none !important",
        resize: "none !important",
        fontSize: "0.9rem !important",
        borderRadius: "4px !important",
        overflow: "hidden !important",
        whiteSpace: "pre-wrap !important",
        boxShadow: "none !important",
    },
    ".documentExplorer-button": {
        backgroundColor: "none !important",
        color:
            props.colorMode === "light"
                ? `${colors.light.textPrimary} !important`
                : `${colors.dark.textTertiary} !important`,
    },
    ".filelist-style": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.base} !important`
                : `${colors.dark.crust} !important`,
        color:
            props.colorMode === "light"
                ? `${colors.light.textTertiary} !important`
                : `${colors.dark.textTertiary} !important`,
    },
});
