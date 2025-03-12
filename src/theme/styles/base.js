// Base styles including global styles for elements like body and headings
import { colors } from "../colors";
import { typography } from "../typography";

export const baseStyles = (props) => ({
    body: {
        bg: props.colorMode === "light" ? colors.light.base : colors.dark.base,
        color:
            props.colorMode === "light"
                ? colors.light.textPrimary
                : colors.dark.textPrimary,
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
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textSecondary} !important`,
    },
    h2: {
        ...typography.styles.h2,
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textSecondary} !important`,
    },
    h3: {
        ...typography.styles.h3,
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textSecondary} !important`,
    },
    h4: {
        ...typography.styles.h4,
        color:
            props.colorMode === "light"
                ? colors.light.sidebar.text
                : colors.light.sidebar.text,
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
        fontFamily: '"Roboto", sans-serif',
        fontSize: "1rem",
        lineHeight: "1.5",
    },
});
