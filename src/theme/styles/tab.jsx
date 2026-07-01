// Defines visual styles for tab components within the application.
import { colors } from "../colors";

const tabStyles = (props) => ({
    ".tab-style": {
        backgroundColor: "transparent !important",
        borderRadius: "0 !important",
        borderTopLeftRadius: "md !important",
        borderTopRightRadius: "md !important",
        marginBottom: "-1px",
        fontSize: "16px !important",
        fontWeight: "400 !important",
    },
    ".tab-style[aria-selected='true']": {
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
    ".tab-style[aria-selected='false']": {
        backgroundColor: "transparent !important",
        color:
            props.colorMode === "light"
                ? `${colors.light.textTertiary} !important`
                : `${colors.dark.textTertiary} !important`,
    },
    ".tab-style:hover": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.surface} !important`
                : `${colors.dark.surface} !important`,
    },
    ".tab-panel-container": {
        minHeight: "180px !important",
        display: "flex !important",
        alignItems: "center !important",
        justifyContent: "center !important",
    },
});

const _lo = tabStyles({ colorMode: "light" });
const _do = tabStyles({ colorMode: "dark" });
export const tabGlobalCss = {};
for (const sel of Object.keys(_lo)) {
    tabGlobalCss[sel] = { _light: _lo[sel], _dark: _do[sel] };
}
