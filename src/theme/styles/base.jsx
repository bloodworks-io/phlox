// Base styles including global styles for elements like body and headings
import { colors } from "../colors";
import { typography } from "../typography";

const baseStyles = (props) => ({
    body: {
        bg: "folio.canvas",
        color: "folio.ink",
        fontFamily: "body",
    },
    ".headings": {
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textSecondary} !important`,
        fontWeight: "700",
    },
    h1: {
        ...typography.styles.h1,
        color:
            props.colorMode === "light"
                ? `${colors.light.textPrimary} !important`
                : `${colors.dark.textPrimary} !important`,
    },
    h2: {
        ...typography.styles.h2,
        color:
            props.colorMode === "light"
                ? `${colors.light.textPrimary} !important`
                : `${colors.dark.textPrimary} !important`,
    },
    h3: {
        ...typography.styles.h3,
        color:
            props.colorMode === "light"
                ? `${colors.light.textPrimary} !important`
                : `${colors.dark.textPrimary} !important`,
    },
    h4: {
        ...typography.styles.h4,
        color:
            props.colorMode === "light"
                ? colors.light.sidebar.text
                : colors.dark.sidebar.text,
    },
    h5: {
        ...typography.styles.h5,
        color:
            props.colorMode === "light"
                ? colors.light.textSecondary
                : colors.dark.textSecondary,
    },
    h6: {
        ...typography.styles.h6,
        color:
            props.colorMode === "light"
                ? colors.light.textSecondary
                : colors.dark.textSecondary,
    },
    h7: {
        ...typography.styles.h7,
        color:
            props.colorMode === "light"
                ? colors.light.textSecondary
                : colors.dark.textSecondary,
    },
    p: {
        fontFamily: "body",
        fontSize: "1rem",
        lineHeight: "1.5",
        textWrap: "pretty",
    },
});

const _lo = baseStyles({ colorMode: "light" });
const _do = baseStyles({ colorMode: "dark" });
export const baseGlobalCss = {};
for (const sel of Object.keys(_lo)) {
    baseGlobalCss[sel] = { _light: _lo[sel], _dark: _do[sel] };
}
