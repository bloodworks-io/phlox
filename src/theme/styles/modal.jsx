// Styles for modal components.
import { colors } from "../colors";

const modalStyles = (props) => ({
    ".modal-style": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.secondary} !important`
                : `${colors.dark.secondary} !important`,
        border:
            props.colorMode === "light"
                ? `1px solid ${colors.light.surface} !important`
                : `1px solid ${colors.dark.surface} !important`,
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textSecondary} !important`,
        fontSize: "0.9rem !important",
        padding: "0px !important",
        borderRadius: "xl !important",
        marginBlock: "auto !important",
        boxShadow:
            props.colorMode === "light"
                ? "0 24px 60px rgba(76, 79, 105, 0.25) !important"
                : "0 24px 60px rgba(0, 0, 0, 0.45) !important",
    },
});

const _lo = modalStyles({ colorMode: "light" });
const _do = modalStyles({ colorMode: "dark" });
export const modalGlobalCss = {};
for (const sel of Object.keys(_lo)) {
    modalGlobalCss[sel] = { _light: _lo[sel], _dark: _do[sel] };
}
