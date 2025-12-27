// Styles for modal components.
import { colors } from "../colors";

export const modalStyles = (props) => ({
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
        borderRadius: "sm !important",
    },
    ".collapse-toggle": {
        border: "none !important",
        borderRadius: "sm !important",
        color:
            props.colorMode === "light"
                ? `${colors.light.textTertiary} !important`
                : `${colors.dark.textTertiary} !important`,
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.crust} !important`
                : `${colors.dark.base} !important`,
    },

    ".template-editor-modal": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.base} !important`
                : `${colors.dark.crust} !important`,
        borderRadius: "sm !important",
        maxHeight: "70vh", // Adjust this value as needed
        maxWidth: "800px", // Adjust this value as needed
        overflowY: "auto",
        margin: "auto", // Center the modal
    },

    ".template-editor-header": {
        padding: "1rem",
    },

    ".template-editor-body": {
        backgroundColor:
            props.colorMode === "light" ? colors.light.base : colors.dark.crust,
        padding: "1.5rem",
    },

    ".template-editor-footer": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.base} !important`
                : `${colors.dark.crust} !important`,
        padding: "1rem",
    },
});
