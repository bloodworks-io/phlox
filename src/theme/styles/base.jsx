// Base styles including global styles for elements like body and headings
import { typography } from "../typography";

const baseStyles = () => ({
    body: {
        bg: "folio.canvas",
        color: "folio.ink",
        fontFamily: "body",
    },
    ".headings": {
        color: "folio.muted !important",
        fontWeight: "700",
    },
    h1: {
        ...typography.styles.h1,
        color: "folio.ink !important",
    },
    h2: {
        ...typography.styles.h2,
        color: "folio.ink !important",
    },
    h3: {
        ...typography.styles.h3,
        color: "folio.ink !important",
    },
    h4: {
        ...typography.styles.h4,
        color: "folio.sidebarInk",
    },
    h5: {
        ...typography.styles.h5,
        color: "folio.muted",
    },
    h6: {
        ...typography.styles.h6,
        color: "folio.muted",
    },
    h7: {
        ...typography.styles.h7,
        color: "folio.muted",
    },
    p: {
        fontFamily: "body",
        fontSize: "1rem",
        lineHeight: "1.5",
        textWrap: "pretty",
    },
});

const _lo = baseStyles();
const _do = baseStyles();
export const baseGlobalCss = {};
for (const sel of Object.keys(_lo)) {
    baseGlobalCss[sel] = { _light: _lo[sel], _dark: _do[sel] };
}
