// Styles for checkbox components
import { colors } from "../colors";

export const checkboxStyles = (props) => ({
    ".task-checkbox": {
        borderRadius: "sm !important",
        ".chakra-checkbox__control": {
            borderWidth: "1px !important",
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
        ".chakra-checkbox__label": {
            color:
                props.colorMode === "light"
                    ? `${colors.light.textSecondary} !important`
                    : `${colors.dark.textSecondary} !important`,
        },
    },
});
