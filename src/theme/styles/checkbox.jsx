// Styles for checkbox components
import { colors } from "../colors";

export const checkboxStyles = (props) => ({
    ".task-checkbox": {
        borderRadius: "sm !important",
    },
    ".task-checkbox .chakra-checkbox__control": {
        borderWidth: "1px !important",
        width: "16px !important",
        height: "16px !important",
        borderRadius: "2px !important",
        border:
            props.colorMode === "light"
                ? `1px solid ${colors.light.surface} !important`
                : `1px solid ${colors.dark.surface2} !important`,
        backgroundColor:
            props.colorMode === "light"
                ? `${colors.light.crust} !important`
                : `${colors.dark.crust} !important`,
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textSecondary} !important`,
    },
    ".task-checkbox .chakra-checkbox__label": {
        fontSize: "16px !important",
        lineHeight: "20px !important",
        fontWeight: "400 !important",
        color:
            props.colorMode === "light"
                ? `${colors.light.textSecondary} !important`
                : `${colors.dark.textSecondary} !important`,
    },
});
