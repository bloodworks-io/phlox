// Combines all styles for the custom theme.
import { baseStyles } from "./base";
import { sidebarStyles } from "./sidebar";
import { panelStyles } from "./panel";
import { buttonStyles } from "./button";
import { inputStyles } from "./input";
import { modalStyles } from "./modal";
import { floatingStyles } from "./floating";
import { modeSelectorStyles } from "./modeSelector";
import { toggleStyles } from "./toggle";
import { documentExplorerStyles } from "./documentExplorer";
import { checkboxStyles } from "./checkbox";
import { tabStyles } from "./tab";
import { scrollbarStyles } from "./scrollbar";
import { colors } from "../colors";
import { patientInfoStyles } from "./patientInfo";

export const styles = {
    global: (props) => ({
        ...baseStyles(props),
        ...sidebarStyles(props),
        ...panelStyles(props),
        ...buttonStyles(props),
        ...inputStyles(props),
        ...modalStyles(props),
        ...floatingStyles(props),
        ...modeSelectorStyles(props),
        ...toggleStyles(props),
        ...documentExplorerStyles(props),
        ...checkboxStyles(props),
        ...tabStyles(props),
        ...scrollbarStyles(props),
        ...patientInfoStyles(props),
        ".main-bg": {
            // Keep miscellaneous styles here or in a dedicated file
            backgroundColor:
                props.colorMode === "light"
                    ? colors.light.base
                    : colors.dark.base,
        },
        ".flex-container": {
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "50px",
        },
        ".landing-items": {
            backgroundColor:
                props.colorMode === "light"
                    ? colors.light.base
                    : colors.dark.crust,
            color:
                props.colorMode === "light"
                    ? `${colors.light.textSecondary} !important`
                    : `${colors.dark.textSecondary} !important`,
            border: "none",
            fontWeight: "normal",
        },
        ".green-icon": {
            color: `${colors.light.successButton} !important`,
        },
        ".red-icon": {
            color: `${colors.light.dangerButton} !important`,
        },
        ".yellow-icon": {
            color: `${colors.light.secondaryButton} !important`,
        },
        ".blue-icon": {
            color: `${colors.light.primaryButton} !important`,
        },
    }),
};
