// Styles for the patient information bar component
import { colors } from "../colors";

export const patientInfoStyles = (props) => ({
    ".pill-box": {
        display: "inline-flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.secondary} !important`
                : `${colors.dark.secondary} !important`,
        border: "none",
        padding: "10px 20px",
        borderRadius: "md",
    },
    ".pill-box-icons": {
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textQuaternary} !important`,
        minWidth: "16px",
        marginRight: "8px",
        flexShrink: 0, // Prevent icon from shrinking
    },

    ".input-style": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.base} !important`
                : `${colors.dark.crust} !important`,
        color:
            props.colorMode === "light"
                ? `${colors.light.textTertiary} !important`
                : `${colors.dark.textTertiary} !important`,
        border:
            props.colorMode === "light"
                ? `1px solid ${colors.light.surface} !important`
                : `${colors.dark.textTertiary} !important`,
        padding: "7px 8px !important",
        borderRadius: "md !important",
        fontSize: "0.9rem !important",
    },
    ".search-button": {
        borderLeft: "none !important",
        borderTopLeftRadius: "0 !important",
        borderBottomLeftRadius: "0 !important",
        borderTopRightRadius: "md !important",
        borderBottomRightRadius: "md !important",
        marginLeft: "-1px",
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.surface2} !important`
                : `${colors.dark.base} !important`,
        border:
            props.colorMode === "light"
                ? `1px solid ${colors.light.surface2} !important`
                : `${colors.dark.textTertiary} !important`,
        color: "#575279 !important",
        height: "32px !important",
        minWidth: "32px !important",
        flexShrink: 0, // Prevent button from shrinking
    },
    ".search-button:hover": {
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.surface} !important`
                : `${colors.dark.surface2} !important`,
    },
});
